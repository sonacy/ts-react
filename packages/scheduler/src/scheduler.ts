import {
	requestHostCallback,
	cancelHostCallback,
	getCurrentTime,
	forceFrameRate,
	shouldYieldToHost,
} from './dom'

const ImmediatePriority = 1
const UserBlockingPriority = 2
const NormalPriority = 3
const LowPriority = 4
const IdlePriority = 5
const maxSigned31BitInt = 1073741823
const IMMEDIATE_PRIORITY_TIMEOUT = -1
const USER_BLOCKING_PRIORITY = 250
const NORMAL_PRIORITY_TIMEOUT = 5000
const LOW_PRIORITY_TIMEOUT = 10000
const IDLE_PRIORITY = maxSigned31BitInt

enum PriorityLevel {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority,
	IdlePriority,
}

type CallbackNode = {
	callback: (didTimeout: boolean) => any
	priorityLevel: PriorityLevel
	expirationTime: number
	next: CallbackNode | null
	previous: CallbackNode | null
}

// callback are stored as circular linked list
let firstCallbackNode: CallbackNode | null = null
let currentHostCallbackDidTimeout = false
let currentPriorityLevel = NormalPriority
let currentEventStartTime = -1
let currentExpirationTime = -1

let isPerformingWork = false
let isHostCallbackScheduled = false

const scheduleHostCallbackIfNeeded = () => {
	if (isPerformingWork) return
	if (firstCallbackNode !== null) {
		if (isHostCallbackScheduled) {
			cancelHostCallback()
		} else {
			isHostCallbackScheduled = true
		}
		requestHostCallback(flushWork, firstCallbackNode.expirationTime)
	}
}

const flushFirstCallback = () => {
	// take current node, remove from link list, update list
	const currentFlushingCallback = firstCallbackNode!
	let next = firstCallbackNode!.next
	if (firstCallbackNode === next) {
		// this is last node
		next = null
		firstCallbackNode = null
	} else {
		const lastCallbackNode = next!.previous
		firstCallbackNode = next
		lastCallbackNode!.next = firstCallbackNode
		firstCallbackNode!.previous = lastCallbackNode
	}

	currentFlushingCallback!.next = currentFlushingCallback!.previous = null

	const callback = currentFlushingCallback.callback
	const expirationTime = currentFlushingCallback.expirationTime
	const priorityLevel = currentFlushingCallback.priorityLevel
	const previousPriorityLevel = currentPriorityLevel
	const previousExpirationTime = currentExpirationTime
	currentPriorityLevel = priorityLevel
	currentExpirationTime = expirationTime
	let continuationCallback
	try {
		const didTimeout =
			currentHostCallbackDidTimeout || priorityLevel === ImmediatePriority
		continuationCallback = callback(didTimeout)
	} catch (error) {
		throw error
	} finally {
		currentExpirationTime = previousExpirationTime
		currentPriorityLevel = previousPriorityLevel
	}

	// a callback return a new callback
	// create a newNode with same priority and expiration
	if (typeof continuationCallback === 'function') {
		const continuationNode: CallbackNode = {
			callback: continuationCallback,
			priorityLevel,
			expirationTime,
			next: null,
			previous: null,
		}

		// insert to the list, sorted by expirationTime
		if (firstCallbackNode === null) {
			firstCallbackNode = continuationNode.next = continuationNode.previous = continuationNode
		} else {
			let nextAfterContinuation = null
			let node = firstCallbackNode
			do {
				if (node.expirationTime >= expirationTime) {
					nextAfterContinuation = node
					break
				}
				node = node.next!
			} while (node !== firstCallbackNode)

			if (nextAfterContinuation === null) {
				// means it should be last one
				nextAfterContinuation = firstCallbackNode
			} else if (nextAfterContinuation === firstCallbackNode) {
				// means should schedule now
				firstCallbackNode = continuationNode
				scheduleHostCallbackIfNeeded()
			}
			// insert newNode before nextAfter
			const previous = nextAfterContinuation.previous!
			previous.next = nextAfterContinuation.previous = continuationNode
			continuationNode.next = nextAfterContinuation
			continuationNode.previous = previous
		}
	}
}

const flushWork = (didTimeout: boolean) => {
	isHostCallbackScheduled = false
	isPerformingWork = true
	const previousDidTimeout = currentHostCallbackDidTimeout
	currentHostCallbackDidTimeout = didTimeout
	try {
		if (currentHostCallbackDidTimeout) {
			while (firstCallbackNode !== null) {
				const currentTime = getCurrentTime()
				if (firstCallbackNode.expirationTime <= currentTime) {
					// callback expired
					do {
						flushFirstCallback()
					} while (
						firstCallbackNode !== null &&
						firstCallbackNode.expirationTime <= currentTime
					)
					continue
				}
				break
			}
		} else {
			if (firstCallbackNode !== null) {
				do {
					flushFirstCallback()
				} while (firstCallbackNode !== null && !shouldYieldToHost())
			}
		}
	} finally {
		isPerformingWork = false
		currentHostCallbackDidTimeout = previousDidTimeout
		scheduleHostCallbackIfNeeded()
	}
}

const runWithPriority = (
	priorityLevel: PriorityLevel = NormalPriority,
	eventHandler: () => any
) => {
	const previousPriorityLevel = currentPriorityLevel
	const previousEventStartTime = currentEventStartTime
	currentPriorityLevel = priorityLevel
	currentEventStartTime = getCurrentTime()
	try {
		return eventHandler()
	} catch (error) {
		scheduleHostCallbackIfNeeded()
		throw error
	} finally {
		currentEventStartTime = previousEventStartTime
		currentPriorityLevel = previousPriorityLevel
	}
}
const next = (eventHandler: () => any) => {
	let priorityLevel

	switch (currentPriorityLevel) {
		case ImmediatePriority:
		case UserBlockingPriority:
		case NormalPriority:
			priorityLevel = NormalPriority
			break
		default:
			priorityLevel = currentPriorityLevel
			break
	}

	const previousPriorityLevel = currentPriorityLevel
	const previousEventStartTime = currentEventStartTime
	currentPriorityLevel = priorityLevel
	currentEventStartTime = getCurrentTime()
	try {
		return eventHandler()
	} catch (error) {
		scheduleHostCallbackIfNeeded()
		throw error
	} finally {
		currentEventStartTime = previousEventStartTime
		currentPriorityLevel = previousPriorityLevel
	}
}
const scheduleCallback = (
	priorityLevel: PriorityLevel,
	callback: any,
	options: any
) => {
	const startTime =
		currentEventStartTime === -1 ? getCurrentTime() : currentEventStartTime
	let expirationTime
	if (
		typeof options === 'object' &&
		options !== null &&
		typeof options.timeout === 'number'
	) {
		expirationTime = startTime + options.timeout
	} else {
		switch (priorityLevel) {
			case ImmediatePriority:
				expirationTime = startTime + IMMEDIATE_PRIORITY_TIMEOUT
				break
			case UserBlockingPriority:
				expirationTime = startTime + USER_BLOCKING_PRIORITY
				break
			case IdlePriority:
				expirationTime = startTime + IDLE_PRIORITY
				break
			case LowPriority:
				expirationTime = startTime + LOW_PRIORITY_TIMEOUT
				break
			case NormalPriority:
			default:
				expirationTime = startTime + NORMAL_PRIORITY_TIMEOUT
				break
		}
	}

	const newNode: CallbackNode = {
		callback,
		priorityLevel,
		expirationTime,
		next: null,
		previous: null,
	}

	// insert by sort of expirationTime
	if (firstCallbackNode === null) {
		firstCallbackNode = newNode.next = newNode.previous = newNode
		scheduleHostCallbackIfNeeded()
	} else {
		let next = null
		let node = firstCallbackNode
		do {
			if (node.expirationTime > expirationTime) {
				next = node
				break
			}
			node = node.next!
		} while (node !== firstCallbackNode)

		if (next === null) {
			next = firstCallbackNode
		} else if (next === firstCallbackNode) {
			firstCallbackNode = newNode
			scheduleHostCallbackIfNeeded()
		}

		const previous = next.previous!
		previous.next = next.previous = newNode
		newNode.previous = previous
		newNode.next = next
	}
	return newNode
}
const cancelCallback = (callbackNode: CallbackNode) => {
	const next = callbackNode.next
	if (next === null) {
		return
	}
	if (next === callbackNode) {
		firstCallbackNode = null
	} else {
		if (callbackNode === firstCallbackNode) {
			firstCallbackNode = next
		}
		const previous = callbackNode.previous!
		previous.next = next
		next.previous = previous
	}

	callbackNode.next = callbackNode.previous = null
}
const wrapCallback = (callback: any) => {
	const parentPriorityLevel = currentPriorityLevel
	return function() {
		const previousPriorityLevel = currentPriorityLevel
		const previousEventStartTime = currentEventStartTime
		currentPriorityLevel = parentPriorityLevel
		currentEventStartTime = getCurrentTime()
		try {
			return callback.apply(this, arguments)
		} catch (error) {
			scheduleHostCallbackIfNeeded()
			throw error
		} finally {
			currentEventStartTime = previousEventStartTime
			currentPriorityLevel = previousPriorityLevel
		}
	}
}
const getCurrentPriorityLevel = () => currentPriorityLevel
const shouldYield = () => {
	return (
		!currentHostCallbackDidTimeout &&
		((firstCallbackNode !== null &&
			firstCallbackNode.expirationTime < currentExpirationTime) ||
			shouldYieldToHost())
	)
}
const getFirstCallbackNode = () => firstCallbackNode

export {
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority,
	IdlePriority,
	getCurrentTime,
	forceFrameRate,
	runWithPriority,
	next,
	scheduleCallback,
	cancelCallback,
	wrapCallback,
	getCurrentPriorityLevel,
	shouldYield,
	getFirstCallbackNode,
}
