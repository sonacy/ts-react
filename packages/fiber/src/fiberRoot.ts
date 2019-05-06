import { Fiber } from './fiber'
import { HostRoot } from '@ts-react/shared'
import { ExpirationTime, NoWork } from './expirationTime'

export class FiberRoot {
	containerInfo: any
	current: Fiber
	finishedWork: Fiber | null
	firstPendingTime: ExpirationTime
	lastPendingTime: ExpirationTime
	pingTime: ExpirationTime

	constructor(containerInfo: any) {
		this.containerInfo = containerInfo
		const rootFiber = new Fiber(HostRoot, null, null)
		this.current = rootFiber
		rootFiber.stateNode = this
		this.finishedWork = null
		this.firstPendingTime = NoWork
		this.lastPendingTime = NoWork
		this.pingTime = NoWork
	}
}
