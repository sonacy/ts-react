import { ExpirationTime, NoWork } from './expirationTime'
import { Update, ShouldCapture, DidCapture, Callback } from '@ts-react/shared'
import { Fiber } from './fiber'
import { markRenderEventTime } from './scheduler'

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
			queue1 = fiber.updateQueue = createUpdateQueue(fiber.memoizedState)
		}
	} else {
		queue1 = fiber.updateQueue
		queue2 = alternate.updateQueue
		if (queue1 === null) {
			if (queue2 === null) {
				queue1 = fiber.updateQueue = createUpdateQueue(fiber.memoizedState)
				queue2 = alternate.updateQueue = createUpdateQueue(
					alternate.memoizedState
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

let hasForceUpdate: boolean = false

export function resetHasForceUpdateBeforeProcessing() {
	hasForceUpdate = false
}

export function checkHasForceUpdateAfterProcessing() {
	return hasForceUpdate
}

function ensureWorkInProgressQueueIsAClone<State>(
	workInProgress: Fiber,
	queue: UpdateQueue<State>
) {
	const current = workInProgress.alternate
	if (current !== null) {
		if (queue === current.updateQueue) {
			queue = workInProgress.updateQueue = cloneUpdateQueue(queue)
		}
	}
	return queue
}

function getStateFromUpdate<State>(
	workInProgress: Fiber,
	queue: UpdateQueue<State>,
	update: Update<State>,
	prevState: State,
	nextProps: any,
	instance: any
) {
	switch (update.tag) {
		case ReplaceState: {
			const payload = update.payload
			if (typeof payload === 'function') {
				const nextState = payload.call(instance, prevState, nextProps)
				return nextState
			}
			return payload
		}
		case CaptureUpdate: {
			workInProgress.effectTag =
				(workInProgress.effectTag & ~ShouldCapture) | DidCapture
		}
		case UpdateState: {
			const payload = update.payload
			let partialState
			if (typeof payload === 'function') {
				partialState = payload.call(instance, prevState, nextProps)
			} else {
				partialState = payload
			}
			if (partialState === null || partialState === undefined) {
				return prevState
			}
			return Object.assign({}, prevState, partialState)
		}
		case ForceUpdate: {
			hasForceUpdate = true
			return prevState
		}
	}
	return prevState
}

export function processUpdateQueue<State>(
	workInProgress: Fiber,
	queue: UpdateQueue<State>,
	props: any,
	instance: any,
	renderExpirationTime: ExpirationTime
) {
	hasForceUpdate = false
	queue = ensureWorkInProgressQueueIsAClone(workInProgress, queue)

	let newBaseState = queue.baseState
	let newFirstUpdate = null
	let newExpirationTime = NoWork
	let update = queue.firstUpdate
	let resultState = newBaseState

	while (update !== null) {
		const updateExpirationTime = update.expirationTime
		if (updateExpirationTime < renderExpirationTime) {
			if (newFirstUpdate === null) {
				newFirstUpdate = update
				newBaseState = resultState
			}
			if (newExpirationTime < updateExpirationTime) {
				newExpirationTime = updateExpirationTime
			}
		} else {
			markRenderEventTime(updateExpirationTime)

			resultState = getStateFromUpdate(
				workInProgress,
				queue,
				update,
				resultState,
				props,
				instance
			)

			const callback = update.callback
			if (callback !== null) {
				workInProgress.effectTag |= Callback
				update.nextEffect = null
				if (queue.lastEffect === null) {
					queue.firstEffect = queue.lastEffect = update
				} else {
					queue.lastEffect.next = update
					queue.lastEffect = update
				}
			}
		}
		update = update.next
	}

	let newFirstCapturedUpdate = null
	update = queue.firstCapturedUpdate
	while (update !== null) {
		const updateExpirationTime = update.expirationTime
		if (updateExpirationTime < renderExpirationTime) {
			if (newFirstCapturedUpdate === null) {
				newFirstCapturedUpdate = update
				if (newFirstUpdate === null) {
					newBaseState = resultState
				}
			}
			if (newExpirationTime < updateExpirationTime) {
				newExpirationTime = updateExpirationTime
			}
		} else {
			resultState = getStateFromUpdate(
				workInProgress,
				queue,
				update,
				resultState,
				props,
				instance
			)

			const callback = update.callback
			if (callback !== null) {
				workInProgress.effectTag |= Callback
				update.nextEffect = null
				if (queue.lastEffect === null) {
					queue.firstEffect = queue.lastEffect = update
				} else {
					queue.lastEffect.next = update
					queue.lastEffect = update
				}
			}
		}
		update = update.next
	}

	if (newFirstUpdate === null) {
		queue.lastUpdate = null
	}
	if (newFirstCapturedUpdate === null) {
		queue.lastCapturedUpdate = null
	} else {
		workInProgress.effectTag |= Callback
	}
	if (newFirstCapturedUpdate === null && newFirstUpdate === null) {
		newBaseState = resultState
	}
	queue.baseState = newBaseState
	queue.firstCapturedUpdate = newFirstCapturedUpdate
	queue.firstUpdate = newFirstUpdate

	workInProgress.expirationTime = newExpirationTime
	workInProgress.memoizedState = resultState
}
