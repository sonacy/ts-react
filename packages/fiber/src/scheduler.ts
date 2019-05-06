import {
	ExpirationTime,
	NoWork,
	msToExpirationTime,
	Sync,
	computeInteractiveExpiration,
	computeAsyncExpiration,
	Never,
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
} from '@ts-react/scheduler'
import { Fiber } from './fiber'
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

let workPhase: WorkPhase = NotWorking
let renderExpirationTime: ExpirationTime = NoWork

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
) {}

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
