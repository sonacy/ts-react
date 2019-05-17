import { Fiber } from './fiber'
import { ExpirationTime } from './expirationTime'
import { HostComponent, HostRoot, HostText } from '@ts-react/shared'
import { createInstance, appendChild } from './domOperation'

function appendAllChildren(parent: Element, workInProgress: Fiber) {
	let node = workInProgress.child

	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendChild(parent, node.stateNode)
		} else if (node.child !== null) {
			node.child.return = node
			node = node.child
			continue
		}

		if (node === workInProgress) {
			return
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === workInProgress) {
				return
			}
			node = node.return
		}

		node.sibling.return = node.return
		node = node.sibling
	}
}

export function completeWork(
	current: Fiber | null,
	workInProgress: Fiber,
	renderExpirationTime: ExpirationTime
): Fiber | null {
	const newProps = workInProgress.pendingProps

	switch (workInProgress.tag) {
		case HostComponent: {
			// TODO: pop context
			const type = workInProgress.type
			if (current !== null && workInProgress.stateNode !== null) {
				updateHostComponent(current, workInProgress, type, newProps)
				// TODO: mark ref
			} else {
				if (!newProps) {
					console.error('should have newProps in mount')
					break
				}
				// TODO: context and hydrate
				const instance = createInstance(type, newProps, workInProgress)
				appendAllChildren(instance, workInProgress)

				if (finalizeInitialChildren(instance, type, newProps)) {
					markUpdate(workInProgress)
				}
				workInProgress.stateNode = instance
				// TODO: mark ref
			}
			break
		}
		case HostRoot: {
		}
		case HostText: {
		}
		// TODO: other component
	}
	console.log('complete work: ', workInProgress)

	return null
}
