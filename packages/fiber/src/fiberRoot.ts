import { Fiber } from './fiber'
import { HostRoot } from '@ts-react/shared'
import { CallbackNode } from '@ts-react/scheduler'
import { ExpirationTime, NoWork } from './expirationTime'

export class FiberRoot {
	containerInfo: any
	current: Fiber
	finishedExpirationTime: ExpirationTime
	finishedWork: Fiber | null
	firstPendingTime: ExpirationTime
	lastPendingTime: ExpirationTime
	pingTime: ExpirationTime
	pendingCommitExpirationTime: ExpirationTime
	callbackExpirationTime: ExpirationTime
	callbackNode: CallbackNode | null

	constructor(containerInfo: any) {
		this.containerInfo = containerInfo
		const rootFiber = new Fiber(HostRoot, null, null)
		this.current = rootFiber
		rootFiber.stateNode = this
		this.finishedExpirationTime = NoWork
		this.finishedWork = null
		this.firstPendingTime = NoWork
		this.lastPendingTime = NoWork
		this.pingTime = NoWork
		this.pendingCommitExpirationTime = NoWork
		this.callbackExpirationTime = NoWork
		this.callbackNode = null
	}
}
