import { Fiber } from './fiber'
import { HostRoot } from '@ts-react/shared'

export class FiberRoot {
	containerInfo: any
	current: Fiber
	finishedWork: Fiber | null

	constructor(containerInfo: any) {
		this.containerInfo = containerInfo
		const rootFiber = new Fiber(HostRoot, null, null)
		this.current = rootFiber
		rootFiber.stateNode = this
		this.finishedWork = null
	}
}
