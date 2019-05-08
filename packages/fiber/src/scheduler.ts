import {
	ExpirationTime,
	NoWork,
	msToExpirationTime,
	Sync,
	computeInteractiveExpiration,
	computeAsyncExpiration,
	Never,
	expirationTimeToMs,
} from './expirationTime'
import {
	getCurrentTime,
	getCurrentPriorityLevel,
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
	LowPriority,
	IdlePriority,
	PriorityLevel,
	cancelCallback,
	scheduleCallback,
	shouldYield,
} from '@ts-react/scheduler'
import { Fiber, createWorkInProgress } from './fiber'
import { FiberRoot } from './fiberRoot'
import { HostRoot } from '@ts-react/shared'

enum WorkPhase {
	NotWorking,
	BatchedPhase,
	LegacyUnbatchedPhase,
	FlushSyncPhase,
	RenderPhase,
	CommitPhase,
}
const NotWorking = 0
const BatchedPhase = 1
const LegacyUnbatchedPhase = 2
const FlushSyncPhase = 3
const RenderPhase = 4
const CommitPhase = 5

const RootIncomplete = 0
const RootErrored = 1
const RootSuspended = 2
const RootCompleted = 3

enum RootExitStatus {
	RootIncomplete,
	RootCompleted,
	RootErrored,
	RootSuspended,
}

let workPhase: WorkPhase = NotWorking

let workInProgressRoot: FiberRoot | null = null
let workInProgress: Fiber | null = null

let renderExpirationTime: ExpirationTime = NoWork

let workInProgressRootExitStatus: RootExitStatus = RootIncomplete

let workInProgressRootMostRecentEventTime: ExpirationTime = Sync

let interruptedBy: Fiber | null = null

let currentEventTime: ExpirationTime = NoWork

export const requestCurrentTime = () => {
	if (workPhase === RenderPhase || workPhase === CommitPhase) {
		return msToExpirationTime(getCurrentTime())
	}

	if (currentEventTime !== NoWork) {
		return currentEventTime
	}

	currentEventTime = msToExpirationTime(getCurrentTime())
	return currentEventTime
}

export const computeExpirationTimeForFiber = (currentTime: ExpirationTime) => {
	if (workPhase === RenderPhase) {
		return renderExpirationTime
	}

	const priority = getCurrentPriorityLevel()
	let expirationTime: ExpirationTime = -1
	switch (priority) {
		case ImmediatePriority:
			expirationTime = Sync
			break
		case UserBlockingPriority:
			expirationTime = computeInteractiveExpiration(currentTime)
			break
		case NormalPriority:
		case LowPriority:
			expirationTime = computeAsyncExpiration(currentTime)
			break
		case IdlePriority:
			expirationTime = Never
			break
		default:
			console.error('expected a valid priority level')
			break
	}
	// TODO: check if in same work
	return expirationTime
}

export const scheduleUpdateOnFiber = (
	fiber: Fiber,
	expirationTime: ExpirationTime
) => {
	checkForNestedUpdates()
	const root = markUpdateTimeFromFiberToRoot(fiber, expirationTime)

	if (root === null) {
		console.error('not found fiberRoot in scheduleUpdateOnFiber')
		return
	}

	root.pingTime = NoWork

	if (expirationTime === Sync) {
		// TODO: LegacyUnbatchedPhase and flushImmediateQueue
		scheduleCallbackForRoot(root, ImmediatePriority, Sync)
	} else {
		// TODO: flush for UserBlock
		const priorityLevel = getCurrentPriorityLevel()
		scheduleCallbackForRoot(root, priorityLevel, expirationTime)
	}
}

function scheduleCallbackForRoot(
	root: FiberRoot,
	priorityLevel: PriorityLevel,
	expirationTime: ExpirationTime
) {
	const exsitingExpirationTime = root.callbackExpirationTime
	if (exsitingExpirationTime < expirationTime) {
		const exsitingCallbackNode = root.callbackNode
		if (exsitingCallbackNode !== null) {
			cancelCallback(exsitingCallbackNode)
		}
		root.callbackExpirationTime = expirationTime
		let options = null
		if (expirationTime !== Sync && expirationTime !== Never) {
			let timeout = expirationTimeToMs(expirationTime) - getCurrentTime()
			if (timeout > 5000) {
				timeout = 5000
			}
			options = { timeout }
		}

		root.callbackNode = scheduleCallback(
			priorityLevel,
			runRootCallback.bind(
				null,
				root,
				renderRoot.bind(null, root, expirationTime)
			),
			options
		)
	}
}

function runRootCallback(root: FiberRoot, callback: any, isSync: boolean): any {
	const prevCallbackNode = root.callbackNode
	let continuation = null
	try {
		continuation = callback(isSync)
		if (continuation !== null) {
			return runRootCallback.bind(null, root, callback)
		} else {
			return null
		}
	} finally {
		if (continuation === null && prevCallbackNode === root.callbackNode) {
			root.callbackNode = null
			root.callbackExpirationTime = NoWork
		}
	}
}

function renderRoot(
	root: FiberRoot,
	expirationTime: ExpirationTime,
	isSync: boolean
): any {
	if (root.firstPendingTime < expirationTime) {
		return null
	}

	if (root.pendingCommitExpirationTime === expirationTime) {
		root.pendingCommitExpirationTime = NoWork
		// TODO: commitRoot
	}

	// TODO: flush effects

	if (root !== workInProgressRoot || expirationTime !== renderExpirationTime) {
		prepareFreshStack(root, expirationTime)
	}

	if (workInProgress !== null) {
		const prevWorkPhase = workPhase
		workPhase = RenderPhase
		// TODO: dispatcher

		if (isSync) {
			if (expirationTime !== Sync) {
				// expired in this frame, but not expired in expirationTime
				const currentTime = requestCurrentTime()
				if (currentTime < expirationTime) {
					workPhase = prevWorkPhase
					// TODO: reset for context and dispatcher
					return renderRoot.bind(null, root, currentTime)
				}
			}
		} else {
			currentEventTime = NoWork
		}

		do {
			try {
				if (isSync) {
					workLoopSync()
				} else {
					workLoop()
				}
				break
			} catch (thrownValue) {
				// TODO: catch suspense or fatal error
			}
		} while (true)

		workPhase = prevWorkPhase
		// TODO: reset context and dispatcher

		if (workInProgress !== null) {
			return renderRoot.bind(null, root, expirationTime)
		}
	}

	// TODO: lock? why?

	workInProgressRoot = null
	// TODO: workInProgressRootExitStatus -> commit work
}

function workLoopSync() {
	while (workInProgress !== null) {
		workInProgress = performUnitOfWork(workInProgress)
	}
}

function workLoop() {
	while (workInProgress !== null && !shouldYield()) {
		workInProgress = performUnitOfWork(workInProgress)
	}
}

function performUnitOfWork(unitOfWork: Fiber): Fiber | null {
	return null
}

function prepareFreshStack(root: FiberRoot, expirationTime: ExpirationTime) {
	root.pendingCommitExpirationTime = NoWork
	// TODO: timeoutHandle suspend

	if (workInProgress !== null) {
		// TODO: unwind work
	}

	workInProgressRoot = root
	workInProgress = createWorkInProgress(root.current, null)
	renderExpirationTime = expirationTime
	workInProgressRootExitStatus = RootIncomplete
	workInProgressRootMostRecentEventTime = Sync
}

let nestedUpdateCount: number = 0
const NESTED_UPDATE_LIMIT = 50
let rootWithNestedUpdates: FiberRoot | null

function checkForNestedUpdates() {
	if (nestedUpdateCount > nestedUpdateCount) {
		nestedUpdateCount = 0
		rootWithNestedUpdates = null
	}
}

function markUpdateTimeFromFiberToRoot(
	fiber: Fiber,
	expirationTime: ExpirationTime
) {
	// update fiber expiration time
	if (fiber.expirationTime < expirationTime) {
		fiber.expirationTime = expirationTime
	}
	let alternate = fiber.alternate
	if (alternate !== null && alternate.expirationTime < expirationTime) {
		alternate.expirationTime = expirationTime
	}

	// find root
	let node = fiber.return
	let root: FiberRoot | null = null
	if (node === null && fiber.tag === HostRoot) {
		root = fiber.stateNode
	} else {
		while (node !== null) {
			alternate = node.alternate
			if (node.childExpirationTime < expirationTime) {
				node.childExpirationTime = expirationTime
			}
			if (
				alternate !== null &&
				alternate.childExpirationTime < expirationTime
			) {
				alternate.childExpirationTime = expirationTime
			}
			if (node.return === null && node.tag === HostRoot) {
				root = node.stateNode
				break
			}
			node = node.return
		}
	}
	if (root !== null) {
		if (root.firstPendingTime < expirationTime) {
			root.firstPendingTime = expirationTime
		}
		if (
			root.lastPendingTime === NoWork ||
			root.lastPendingTime > expirationTime
		) {
			root.lastPendingTime = expirationTime
		}
	}

	return root
}
