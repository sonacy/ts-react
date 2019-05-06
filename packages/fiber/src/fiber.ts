import { WorkTag, SideEffectTag, NoEffect } from '@ts-react/shared'
import { UpdateQueue } from './updateQueue'
import { ExpirationTime, NoWork } from './expirationTime'

export class Fiber {
	tag: WorkTag
	key: null | string
	elementType: any
	type: any
	stateNode: any
	return: Fiber | null
	child: Fiber | null
	sibling: Fiber | null
	index: number
	ref: any
	pendingProps: any
	memorizedProps: any
	updateQueue: UpdateQueue<any> | null
	memorizedState: any
	effectTag: SideEffectTag
	nextEffect: Fiber | null
	firstEffect: Fiber | null
	lastEffect: Fiber | null
	expirationTime: ExpirationTime
	childExpirationTime: ExpirationTime
	alternate: Fiber | null

	constructor(tag: WorkTag, pendingProps: any, key: null | string) {
		this.tag = tag
		this.key = key
		this.elementType = null
		this.type = null
		this.stateNode = null
		this.return = null
		this.child = null
		this.sibling = null
		this.index = 0
		this.ref = null
		this.pendingProps = pendingProps
		this.memorizedProps = null
		this.updateQueue = null
		this.memorizedState = null
		this.effectTag = NoEffect
		this.nextEffect = null
		this.firstEffect = null
		this.lastEffect = null
		this.expirationTime = NoWork
		this.childExpirationTime = NoWork
		this.alternate = null
	}
}
