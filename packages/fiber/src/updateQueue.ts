import { ExpirationTime } from './expirationTime'
import { Update } from '@ts-react/shared'
import { Fiber } from './fiber'

export const UpdateState = 0
export const ReplaceState = 1
export const ForceUpdate = 2
export const CaptureUpdate = 3

enum UpdateTag {
	UpdateState,
	ReplaceState,
	ForceUpdate,
	CaptureUpdate,
}

export type Update<State> = {
	expirationTime: number
	tag: UpdateTag
	payload: any
	callback: any
	next: Update<State> | null
	nextEffect: Update<State> | null
}

export type UpdateQueue<State> = {
	baseState: State
	firstUpdate: Update<State> | null
	lastUpdate: Update<State> | null
	firstCapturedUpdate: Update<State> | null
	lastCapturedUpdate: Update<State> | null
	firstEffect: Update<State> | null
	lastEffect: Update<State> | null
	firstCapturedEffect: Update<State> | null
	lastCapturedEffect: Update<State> | null
}

export const createUpdate = (expirationTime: ExpirationTime) => {
	const update: Update<any> = {
		expirationTime,
		tag: UpdateState,
		payload: null,
		callback: null,
		next: null,
		nextEffect: null,
	}
	return update
}

export const createUpdateQueue = <State>(baseState: State) => {
	const queue: UpdateQueue<State> = {
		baseState,
		firstUpdate: null,
		lastUpdate: null,
		firstCapturedUpdate: null,
		lastCapturedUpdate: null,
		firstEffect: null,
		lastEffect: null,
		firstCapturedEffect: null,
		lastCapturedEffect: null,
	}
	return queue
}

export const cloneUpdateQueue = <State>(currentQueue: UpdateQueue<State>) => {
	const queue: UpdateQueue<State> = {
		baseState: currentQueue.baseState,
		firstUpdate: currentQueue.firstUpdate,
		lastUpdate: currentQueue.lastUpdate,
		firstCapturedUpdate: currentQueue.firstCapturedUpdate,
		lastCapturedUpdate: currentQueue.lastCapturedUpdate,
		firstEffect: currentQueue.firstEffect,
		lastEffect: currentQueue.lastEffect,
		firstCapturedEffect: currentQueue.firstCapturedEffect,
		lastCapturedEffect: currentQueue.lastCapturedEffect,
	}
	return queue
}

const appendUpdateToQueue = <State>(
	queue: UpdateQueue<State>,
	update: Update<State>
) => {
	if (queue.lastUpdate === null) {
		queue.firstUpdate = queue.lastUpdate = update
	} else {
		queue.lastUpdate.next = update
		queue.lastUpdate = update
	}
}

export const enqueueUpdate = <State>(fiber: Fiber, update: Update<State>) => {
	const alternate = fiber.alternate
	let queue1
	let queue2
	if (alternate === null) {
		queue1 = fiber.updateQueue
		queue2 = null
		if (queue1 === null) {
			queue1 = fiber.updateQueue = createUpdateQueue(fiber.memorizedState)
		}
	} else {
		queue1 = fiber.updateQueue
		queue2 = alternate.updateQueue
		if (queue1 === null) {
			if (queue2 === null) {
				queue1 = fiber.updateQueue = createUpdateQueue(fiber.memorizedState)
				queue2 = alternate.updateQueue = createUpdateQueue(
					alternate.memorizedState
				)
			} else {
				queue1 = fiber.updateQueue = cloneUpdateQueue(queue2)
			}
		} else {
			if (queue2 === null) {
				queue2 = alternate.updateQueue = cloneUpdateQueue(queue1)
			}
		}
	}

	if (queue2 === null || queue1 === queue2) {
		appendUpdateToQueue(queue1, update)
	} else {
		if (queue1.lastUpdate === null || queue2.lastUpdate === null) {
			appendUpdateToQueue(queue1, update)
			appendUpdateToQueue(queue2, update)
		} else {
			appendUpdateToQueue(queue1, update)
			queue2.lastUpdate = update
		}
	}
}
