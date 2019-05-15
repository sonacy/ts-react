import { Fiber } from './fiber'
import { ExpirationTime, NoWork, Never } from './expirationTime'
import {
	cloneChildFibers,
	mountChildFibers,
	reconcileChildFibers,
} from './childFiber'
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	ContentReset,
} from '@ts-react/shared'
import { renderWithHooks, bailoutHooks } from './fiberHooks'
import { shouldSetTextContent } from './domOperation'
import { processUpdateQueue } from './updateQueue'

let didReceiveUpdate: boolean = false

export function markWorkInProgressReceivedUpdate() {
	didReceiveUpdate = true
}

export function beginWork(
	current: Fiber | null,
	workInProgress: Fiber,
	renderExpirationTime: ExpirationTime
): Fiber | null {
	const updateExpirationTime = workInProgress.expirationTime
	if (current !== null) {
		const oldProps = workInProgress.memoizedProps
		const newProps = workInProgress.pendingProps
		if (oldProps !== newProps) {
			didReceiveUpdate = true
		} else if (updateExpirationTime < renderExpirationTime) {
			didReceiveUpdate = false
			// TODO: context stack push

			return bailoutOnAlreadyFinishdWork(
				current,
				workInProgress,
				renderExpirationTime
			)
		}
	} else {
		didReceiveUpdate = false
	}

	workInProgress.expirationTime = NoWork
	switch (workInProgress.tag) {
		case FunctionComponent: {
			const Component = workInProgress.type
			const resolvedProps = workInProgress.pendingProps
			// TODO: lazy component props
			return updateFunctionComponent(
				current,
				workInProgress,
				Component,
				resolvedProps,
				renderExpirationTime
			)
		}
		case HostComponent: {
			return updateHostComponent(current, workInProgress, renderExpirationTime)
		}
		case HostText: {
			return updateHostText(current, workInProgress)
		}
		case HostRoot: {
			return updateHostRoot(current, workInProgress, renderExpirationTime)
		}
		default: {
			console.warn('unkown fiber, ', workInProgress)
		}
	}

	return null
}

function updateHostRoot(
	current: Fiber | null,
	workInProgress: Fiber,
	renderExpirationTime: ExpirationTime
) {
	// TODO: push context
	const udpateQueue = workInProgress.updateQueue
	const nextProps = workInProgress.pendingProps
	const prevState = workInProgress.memoizedState
	const prevChildren = prevState !== null ? prevState.element : null
	processUpdateQueue(
		workInProgress,
		udpateQueue!,
		nextProps,
		null,
		renderExpirationTime
	)

	const nextState = workInProgress.memoizedState
	const nextChildren = nextState.element
	if (prevChildren === nextChildren) {
		// TODO: hydrate
		return bailoutOnAlreadyFinishdWork(
			current,
			workInProgress,
			renderExpirationTime
		)
	}
	// TODO: hydrate

	reconcileChildren(current, workInProgress, nextChildren, renderExpirationTime)

	return workInProgress.child
}

function updateHostComponent(
	current: Fiber | null,
	workInProgress: Fiber,
	renderExpirationTime: ExpirationTime
) {
	// TODO: push context

	const type = workInProgress.type
	const nextProps = workInProgress.pendingProps
	const prevProps = current !== null ? current.memoizedProps : null
	let nextChildren = nextProps.children
	const isDirectTextChild = shouldSetTextContent(type, nextProps)

	if (isDirectTextChild) {
		return null
	} else if (prevProps !== null && shouldSetTextContent(type, prevProps)) {
		workInProgress.effectTag |= ContentReset
	}

	// TODO: mark ref

	if (renderExpirationTime !== Never && !!nextProps.hidden) {
		// off screen
		workInProgress.expirationTime = workInProgress.childExpirationTime = Never
		return null
	}

	reconcileChildren(current, workInProgress, nextChildren, renderExpirationTime)

	return workInProgress.child
}

function updateHostText(current: Fiber | null, workInProgress: Fiber) {
	// TODO: hydrate

	return null
}

function bailoutOnAlreadyFinishdWork(
	current: Fiber | null,
	workInProgress: Fiber,
	renderExpirationTime: ExpirationTime
): Fiber | null {
	// TODO: reuse context
	if (workInProgress.childExpirationTime < renderExpirationTime) {
		// means child tree have no work
		return null
	} else {
		cloneChildFibers(current, workInProgress) // TODO why?
		return workInProgress.child
	}
}

function updateFunctionComponent(
	current: Fiber | null,
	workInProgress: Fiber,
	Component: Function,
	nextProps: any,
	renderExpirationTime: ExpirationTime
) {
	// TODO: context
	const nextChildren = renderWithHooks(
		current,
		workInProgress,
		Component,
		nextProps,
		renderExpirationTime
	)

	if (current !== null && !didReceiveUpdate) {
		bailoutHooks(current, workInProgress, renderExpirationTime)
		return bailoutOnAlreadyFinishdWork(
			current,
			workInProgress,
			renderExpirationTime
		)
	}

	reconcileChildren(current, workInProgress, nextChildren, renderExpirationTime)

	return workInProgress.child
}

function reconcileChildren(
	current: Fiber | null,
	workInProgress: Fiber,
	nextChildren: any,
	renderExpirationTime: ExpirationTime
) {
	if (current === null) {
		workInProgress.child = mountChildFibers(
			workInProgress,
			null,
			nextChildren,
			renderExpirationTime
		)
	} else {
		workInProgress.child = reconcileChildFibers(
			workInProgress,
			current.child,
			nextChildren,
			renderExpirationTime
		)
	}
}
