import {
	WorkTag,
	SideEffectTag,
	NoEffect,
	FunctionComponent,
	HostComponent,
} from '@ts-react/shared'
import { UpdateQueue } from './updateQueue'
import { ExpirationTime, NoWork } from './expirationTime'

export class Fiber {
	tag: WorkTag
	key: null | string
	elementType: any
	type: any
	stateNode: any
	return: Fiber | null
	child: Fiber | null
	sibling: Fiber | null
	index: number
	ref: any
	pendingProps: any
	memoizedProps: any
	updateQueue: UpdateQueue<any> | null
	memoizedState: any
	effectTag: SideEffectTag
	nextEffect: Fiber | null
	firstEffect: Fiber | null
	lastEffect: Fiber | null
	expirationTime: ExpirationTime
	childExpirationTime: ExpirationTime
	alternate: Fiber | null

	constructor(tag: WorkTag, pendingProps: any, key: null | string) {
		this.tag = tag
		this.key = key
		this.elementType = null
		this.type = null
		this.stateNode = null
		this.return = null
		this.child = null
		this.sibling = null
		this.index = 0
		this.ref = null
		this.pendingProps = pendingProps
		this.memoizedProps = null
		this.updateQueue = null
		this.memoizedState = null
		this.effectTag = NoEffect
		this.nextEffect = null
		this.firstEffect = null
		this.lastEffect = null
		this.expirationTime = NoWork
		this.childExpirationTime = NoWork
		this.alternate = null
	}
}

export const createWorkInProgress = (current: Fiber, pendingProps: any) => {
	let workInProgress = current.alternate
	if (workInProgress === null) {
		workInProgress = new Fiber(current.tag, pendingProps, current.key)
		workInProgress.stateNode = current.stateNode
		workInProgress.elementType = current.elementType
		workInProgress.type = current.type
		workInProgress.alternate = current
		current.alternate = workInProgress
	} else {
		workInProgress.pendingProps = pendingProps
		workInProgress.effectTag = NoEffect
		workInProgress.nextEffect = null
		workInProgress.lastEffect = null
		workInProgress.firstEffect = null
	}

	workInProgress.childExpirationTime = current.childExpirationTime
	workInProgress.expirationTime = current.expirationTime

	workInProgress.child = current.child
	workInProgress.memoizedProps = current.memoizedProps
	workInProgress.memoizedState = current.memoizedState
	workInProgress.updateQueue = current.updateQueue

	workInProgress.sibling = current.sibling
	workInProgress.index = current.index
	workInProgress.ref = current.ref
	return workInProgress
}

export const createFiberFromTypeAndProps = (
	type: any,
	key: null | string,
	pendingProps: any,
	expirationTime: ExpirationTime
) => {
	let fiberTag: WorkTag = FunctionComponent
	if (typeof type === 'string') {
		fiberTag = HostComponent
	}
	// TODO: other type component
	const fiber = new Fiber(fiberTag, pendingProps, key)
	fiber.elementType = type
	fiber.type = type
	fiber.expirationTime = expirationTime
	return fiber
}
