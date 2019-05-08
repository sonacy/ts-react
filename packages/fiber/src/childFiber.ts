import { Fiber, createWorkInProgress } from './fiber'

export function cloneChildFibers(current: Fiber | null, workInProgress: Fiber) {
	if (workInProgress.child === null) {
		return
	}

	let currentChild = workInProgress.child
	let newChild = createWorkInProgress(currentChild, currentChild.pendingProps)
	newChild.return = workInProgress
	workInProgress.child = newChild

	while (currentChild.sibling !== null) {
		currentChild = currentChild.sibling
		newChild = newChild.sibling = createWorkInProgress(
			currentChild,
			currentChild.pendingProps
		)
		newChild.return = workInProgress
	}

	newChild.sibling = null
}
