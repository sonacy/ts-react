import { Fiber } from './fiber'
import { ExpirationTime, NoWork } from './expirationTime'
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
} from '@ts-react/shared'
import { renderWithHooks, bailoutHooks } from './fiberHooks'

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
			// TODO: update host component
		}
		case HostText: {
			// TODO: update host text
		}
		case HostRoot: {
			// TODO: update host root
		}
		default: {
			console.warn('unkown fiber, ', workInProgress)
		}
	}

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
