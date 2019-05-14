import {
	Fiber,
	createWorkInProgress,
	createFiberFromTypeAndProps,
} from './fiber'
import { ExpirationTime } from './expirationTime'
import {
	REACT_ELEMENT_TYPE,
	Deletion,
	Placement,
	ReactElement,
	Fragment,
	REACT_FRAGMENT_TYPE,
	HostText,
} from '@ts-react/shared'

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

function ChildReconciler(shouldTrackSideEffect: boolean) {
	function deleteChild(returnFiber: Fiber, childToDelete: Fiber) {
		if (!shouldTrackSideEffect) {
			return null
		}
		const last = returnFiber.lastEffect
		if (last !== null) {
			last.nextEffect = childToDelete
			returnFiber.lastEffect = childToDelete
		} else {
			returnFiber.firstEffect = returnFiber.lastEffect = childToDelete
		}
		childToDelete.nextEffect = null
		childToDelete.effectTag = Deletion
	}

	function deleteRemainingChildren(
		returnFiber: Fiber,
		currentFirstChild: Fiber | null
	) {
		if (!shouldTrackSideEffect) {
			return null
		}
		let childToDelete = currentFirstChild
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete)
			childToDelete = childToDelete.sibling
		}
		return null
	}

	function useFiber(fiber: Fiber, pendingProps: any): Fiber {
		const clone = createWorkInProgress(fiber, pendingProps)
		clone.index = 0
		clone.sibling = null
		return clone
	}

	function placeSingleChild(newFiber: Fiber): Fiber {
		if (shouldTrackSideEffect && newFiber.alternate === null) {
			newFiber.effectTag = Placement
		}
		return newFiber
	}

	function reconcileSingleElement(
		returnFiber: Fiber,
		currentFirstChild: Fiber | null,
		element: ReactElement,
		expirationTime: ExpirationTime
	): Fiber {
		const key = element.key
		let child = currentFirstChild
		while (child !== null) {
			if (child.key === key) {
				if (
					child.tag === Fragment
						? element.type === REACT_FRAGMENT_TYPE
						: element.type === child.elementType
				) {
					deleteRemainingChildren(returnFiber, child.sibling)
					const existing = useFiber(
						child,
						element.type === REACT_FRAGMENT_TYPE
							? element.props.children
							: element.props
					)
					// TODO: ref
					existing.return = returnFiber
					return existing
				} else {
					deleteRemainingChildren(returnFiber, child)
					break
				}
			} else {
				deleteChild(returnFiber, child)
			}

			child = child.sibling
		}

		// TODO: create fragment fiber
		const created = createFiberFromTypeAndProps(
			element.type,
			element.key as any,
			element.props,
			expirationTime
		)
		// TODO: ref
		created.return = returnFiber
		return created
	}

	function reconcileSingleTextNode(
		returnFiber: Fiber,
		currentFirstChild: Fiber | null,
		textContent: string,
		expirationTime: ExpirationTime
	): Fiber {
		if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
			deleteRemainingChildren(returnFiber, currentFirstChild.sibling)
			const existing = useFiber(currentFirstChild, textContent)
			existing.return = returnFiber
			return existing
		}

		deleteRemainingChildren(returnFiber, currentFirstChild)
		const created = new Fiber(HostText, textContent, null)
		created.expirationTime = expirationTime
		created.return = returnFiber
		return created
	}

	function reconcileChildrenArray(
		returnFiber: Fiber,
		currentFirstChild: Fiber | null,
		newChildren: Array<any>,
		expirationTime: ExpirationTime
	): Fiber | null {
		let resultingFirstChild: Fiber | null = null
		let previousNewFiber: Fiber | null = null
		let oldFiber: Fiber | null = currentFirstChild
		let newIndex = 0
		let lastPlacedIndex = 0
		let nextOldFiber: Fiber | null = null

		// 1. compare from index, same index -> compare key -> update
		for (; newIndex < newChildren.length && oldFiber !== null; newIndex++) {
			if (oldFiber.index > newIndex) {
				nextOldFiber = oldFiber
				oldFiber = null
			} else {
				nextOldFiber = oldFiber.sibling
			}

			const newFiber = updateSlot(
				returnFiber,
				oldFiber,
				newChildren[newIndex],
				expirationTime
			)

			if (newFiber === null) {
				if (oldFiber === null) {
					oldFiber = nextOldFiber
				}
				break
			}

			if (shouldTrackSideEffect) {
				if (oldFiber && newFiber.alternate === null) {
					deleteChild(returnFiber, oldFiber)
				}
			}

			lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex)

			if (previousNewFiber === null) {
				resultingFirstChild = newFiber
			} else {
				previousNewFiber!.sibling = newFiber
			}
			previousNewFiber = newFiber
			oldFiber = nextOldFiber
		}
		// 2. newIndex === newChildren.length -> reconcile end
		if (newIndex === newChildren.length) {
			deleteRemainingChildren(returnFiber, oldFiber)
			return resultingFirstChild
		}
		// 3. oldFiber === null -> rest is new, create fiber
		if (oldFiber === null) {
			for (; newIndex < newChildren.length; newIndex++) {
				const newFiber = createChild(
					returnFiber,
					newChildren[newIndex],
					expirationTime
				)
				if (newFiber === null) {
					continue
				}
				lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex)

				if (previousNewFiber === null) {
					resultingFirstChild = newFiber
				} else {
					previousNewFiber!.sibling = newFiber
				}
				previousNewFiber = newFiber
			}
			return resultingFirstChild
		}
		// 4. position change -> save into exsitingMap by key
		const existingChildren = mapRemainingChildren(oldFiber)
		// 4.1 start from newIndex, key exist -> reuse or create
		for (; newIndex < newChildren.length; newIndex++) {
			const newFiber = updateFromMap(
				existingChildren,
				returnFiber,
				newIndex,
				newChildren[newIndex],
				expirationTime
			)

			if (newFiber !== null) {
				if (shouldTrackSideEffect) {
					existingChildren.delete(
						newFiber.key === null ? newIndex : newFiber.key
					)
				}
				lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIndex)

				if (previousNewFiber === null) {
					resultingFirstChild = newFiber
				} else {
					previousNewFiber!.sibling = newFiber
				}
				previousNewFiber = newFiber
			}
		}

		if (shouldTrackSideEffect) {
			existingChildren.forEach(child => deleteChild(returnFiber, child))
		}

		return resultingFirstChild
	}

	function updateTextNode(
		returnFiber: Fiber,
		current: Fiber | null,
		textContent: string,
		expirationTime: ExpirationTime
	) {
		if (current === null || current.tag !== HostText) {
			const created = new Fiber(HostText, textContent, null)
			created.expirationTime = expirationTime
			created.return = returnFiber
			return created
		} else {
			const existing = useFiber(current, textContent)
			existing.return = returnFiber
			return existing
		}
	}

	function updateElement(
		returnFiber: Fiber,
		current: Fiber | null,
		element: ReactElement,
		expirationTime: ExpirationTime
	) {
		if (current !== null && element.type === current.elementType) {
			const existing = useFiber(current, element.props)
			// TODO: ref
			existing.return = returnFiber
			return existing
		} else {
			const created = createFiberFromTypeAndProps(
				element.type,
				element.key as any,
				element.props,
				expirationTime
			)
			// TODO: ref
			created.return = returnFiber
			return created
		}
	}

	function updateFragment(
		returnFiber: Fiber,
		current: Fiber | null,
		fragment: Iterable<any>,
		expirationTime: ExpirationTime,
		key: null | string
	) {
		if (current === null || current.tag !== Fragment) {
			const created = new Fiber(Fragment, fragment, null)
			created.expirationTime = expirationTime
			created.return = returnFiber
			return created
		} else {
			const existing = useFiber(current, fragment)
			existing.return = returnFiber
			return existing
		}
	}

	function updateSlot(
		returnFiber: Fiber,
		oldFiber: Fiber | null,
		newChild: any,
		expirationTime: ExpirationTime
	): Fiber | null {
		const key = oldFiber !== null ? oldFiber.key : null

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			if (key !== null) {
				return null
			}
			return updateTextNode(
				returnFiber,
				oldFiber,
				'' + newChild,
				expirationTime
			)
		}

		if (typeof newChild === 'object' && newChild !== null) {
			if (newChild.$$typeof === REACT_ELEMENT_TYPE) {
				if (newChild.key === key) {
					// TODO: update fragment
					return updateElement(returnFiber, oldFiber, newChild, expirationTime)
				} else {
					return null
				}
			}
			// TODO: portal
		}

		if (Array.isArray(newChild)) {
			if (key !== null) {
				return null
			}
			return updateFragment(
				returnFiber,
				oldFiber,
				newChild,
				expirationTime,
				null
			)
		}

		console.error('unknow newChild: ', newChild)

		return null
	}

	function createChild(
		returnFiber: Fiber,
		newChild: any,
		expirationTime: ExpirationTime
	): Fiber | null {
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			const created = new Fiber(HostText, newChild, null)
			created.expirationTime = expirationTime
			created.return = returnFiber
			return created
		}

		if (typeof newChild === 'object' && newChild !== null) {
			// TODO: portal

			const created = createFiberFromTypeAndProps(
				newChild.type,
				newChild.key,
				newChild.props,
				expirationTime
			)
			// TODO: ref
			created.return = returnFiber
			return created
		}

		if (Array.isArray(newChild)) {
			const created = new Fiber(Fragment, newChild, null)
			created.expirationTime = expirationTime
			created.return = returnFiber
			return created
		}

		console.error('unknow newChild: ', newChild)

		return null
	}

	function updateFromMap(
		existingChildren: Map<string | number, Fiber>,
		returnFiber: Fiber,
		newIdx: number,
		newChild: any,
		expirationTime: ExpirationTime
	): Fiber | null {
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			const matchFiber = existingChildren.get(newIdx) || null
			return updateTextNode(
				returnFiber,
				matchFiber,
				'' + newChild,
				expirationTime
			)
		}

		if (typeof newChild === 'object' && newChild !== null) {
			if (newChild.$$typeof === REACT_ELEMENT_TYPE) {
				const matchFiber =
					existingChildren.get(newChild.key === null ? newIdx : newChild.key) ||
					null
				// TODO: update fragment
				return updateElement(returnFiber, matchFiber, newChild, expirationTime)
			}
			// TODO: portal
		}

		if (Array.isArray(newChild)) {
			const matchFiber = existingChildren.get(newIdx) || null

			return updateFragment(
				returnFiber,
				matchFiber,
				newChild,
				expirationTime,
				null
			)
		}

		console.error('unknow newChild: ', newChild)

		return null
	}

	function placeChild(
		newFiber: Fiber,
		lastPlacedIndex: number,
		newIndex: number
	) {
		newFiber.index = newIndex
		if (!shouldTrackSideEffect) {
			return lastPlacedIndex
		}
		const current = newFiber.alternate
		if (current !== null) {
			const oldIndex = current.index
			if (oldIndex < lastPlacedIndex) {
				newFiber.effectTag = Placement
				return lastPlacedIndex
			} else {
				return oldIndex
			}
		} else {
			newFiber.effectTag = Placement
			return lastPlacedIndex
		}
	}

	function mapRemainingChildren(currentFirstChild: Fiber | null) {
		const existingChildren: Map<string | number, Fiber> = new Map()
		let existingChild = currentFirstChild
		while (existingChild !== null) {
			if (existingChild.key !== null) {
				existingChildren.set(existingChild.key, existingChild)
			} else {
				existingChildren.set(existingChild.index, existingChild)
			}
			existingChild = existingChild.sibling
		}
		return existingChildren
	}

	function reconcileChildFibers(
		returnFiber: Fiber,
		currentFirstChild: Fiber | null,
		newChild: any,
		expirationTime: ExpirationTime
	) {
		// TODO: fragment
		const isObject = typeof newChild === 'object' && newChild !== null
		if (isObject) {
			if (newChild.$$typeof === REACT_ELEMENT_TYPE) {
				return placeSingleChild(
					reconcileSingleElement(
						returnFiber,
						currentFirstChild,
						newChild,
						expirationTime
					)
				)
			}
			// TODO: portal
		}

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(
					returnFiber,
					currentFirstChild,
					'' + newChild,
					expirationTime
				)
			)
		}

		if (Array.isArray(newChild)) {
			return reconcileChildrenArray(
				returnFiber,
				currentFirstChild,
				newChild,
				expirationTime
			)
		}

		console.error('unkown child: ', newChild)

		return deleteRemainingChildren(returnFiber, currentFirstChild)
	}
	return reconcileChildFibers
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)
