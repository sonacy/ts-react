import { Fiber } from './fiber'
import { ExpirationTime, NoWork } from './expirationTime'
import { cloneChildFibers } from './childFiber'
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
} from '@ts-react/shared'

let didReceiveUpdate: boolean = false

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
			// TODO: update function component
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
