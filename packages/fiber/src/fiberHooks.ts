import { ExpirationTime, NoWork } from './expirationTime'
import {
	HookEffectTag,
	UnmountPassive,
	MountPassive,
	NoEffect as NoHookEffect,
	MountLayout,
	UnmountMutation,
} from './hookEffectTag'
import { Fiber } from './fiber'
import {
	SideEffectTag,
	Passive as PassiveEffect,
	Update as UpdateEffect,
} from '@ts-react/shared'
import {
	requestCurrentTime,
	computeExpirationTimeForFiber,
	scheduleUpdateOnFiber,
	markRenderEventTime,
} from './scheduler'
import { markWorkInProgressReceivedUpdate } from './beginwork'

export const ReactCurrentDispatcher: { current: Dispatcher | null } = {
	current: null,
}

type BasicStateAction<S> = S

type Dispatch<A> = (A: A) => void

export type Dispatcher = {
	useState<S>(initialState: S): [S, Dispatch<BasicStateAction<S>>]
	useReducer<S, I, A>(
		reducer: (S: S, A: A) => S,
		initialArg: I,
		init?: (I: I) => S
	): [S, Dispatch<A>]
	useEffect(
		create: () => (() => void) | void,
		deps: Array<any> | void | null
	): void
	useLayoutEffect(
		create: () => (() => void) | void,
		deps: Array<any> | void | null
	): void
	useCallback<T>(callback: T, deps: Array<any> | void | null): T
	useMemo<T>(nextCreate: () => T, deps: Array<any> | void | null): T
}

type Update<S, A> = {
	expirationTime: ExpirationTime
	action: A
	eagerReducer: ((S: S, A: A) => S) | null
	eagerState: S | null
	next: Update<S, A> | null
}

type UpdateQueue<S, A> = {
	last: Update<S, A> | null
	dispatch: ((A: A) => any) | null
	lastRenderedReducer: ((S: S, A: A) => S) | null
	lastRenderedState: S | null
}

export type HookType =
	| 'useState'
	| 'useReducer'
	| 'useContext'
	| 'useRef'
	| 'useEffect'
	| 'useLayoutEffect'
	| 'useCallback'
	| 'useMemo'
	| 'useImperativeHandle'

export type Hook = {
	memoizedState: any

	baseState: any
	baseUpdate: Update<any, any> | null
	queue: UpdateQueue<any, any> | null

	next: Hook | null
}

type Effect = {
	tag: HookEffectTag
	create: () => (() => void) | void
	destroy: (() => void) | void
	deps: Array<any> | null | void
	next: Effect | null
}

export type FunctionComponentUpdateQueue = {
	lastEffect: Effect | null
}

let renderExpirationTime: ExpirationTime = NoWork
let currentlyRenderingFiber: Fiber | null = null

let currentHook: Hook | null = null
let nextCurrentHook: Hook | null = null
let workInProgressHook: Hook | null = null
let firstWorkInProgressHook: Hook | null = null
let nextWorkInProgressHook: Hook | null = null
let componentUpdateQueue: FunctionComponentUpdateQueue | null = null
let remainingExpirationTime: ExpirationTime = NoWork
let sideEffectTag: SideEffectTag = 0

let didScheduleRenderPhaseUpdate: boolean = false
let numberOfReRenders: number = 0
const RE_RENDER_LIMIT = 25
let renderPhaseUpdates: Map<
	UpdateQueue<any, any>,
	Update<any, any>
> | null = null

// use memoizedState to save hook update
export function renderWithHooks(
	current: Fiber | null,
	workInProgress: Fiber,
	Component: any,
	props: any,
	nextRenderExpirationTime: ExpirationTime
) {
	renderExpirationTime = nextRenderExpirationTime
	currentlyRenderingFiber = workInProgress
	nextCurrentHook = current !== null ? current.memoizedState : null

	ReactCurrentDispatcher.current =
		current === null ? HooksDispatcherOnMount : HooksDispatcherOnUpdate

	let children = Component(props)

	// use hooks when in render function
	if (didScheduleRenderPhaseUpdate) {
		do {
			didScheduleRenderPhaseUpdate = false
			numberOfReRenders += 1

			nextCurrentHook = current !== null ? current.memoizedState : null
			nextWorkInProgressHook = firstWorkInProgressHook

			currentHook = null
			workInProgressHook = null
			componentUpdateQueue = null

			ReactCurrentDispatcher.current = HooksDispatcherOnUpdate
			children = Component(props)
		} while (didScheduleRenderPhaseUpdate)
		renderPhaseUpdates = null
		numberOfReRenders = 0
	}

	ReactCurrentDispatcher.current = ContextOnlyDispatcher

	currentlyRenderingFiber.memoizedState = firstWorkInProgressHook
	currentlyRenderingFiber.expirationTime = remainingExpirationTime
	currentlyRenderingFiber.updateQueue = componentUpdateQueue as any
	currentlyRenderingFiber.effectTag |= sideEffectTag

	renderExpirationTime = NoWork
	currentlyRenderingFiber = null
	currentHook = null
	nextCurrentHook = null
	firstWorkInProgressHook = null
	workInProgressHook = null
	nextWorkInProgressHook = null

	remainingExpirationTime = NoWork
	componentUpdateQueue = null
	sideEffectTag = 0

	return children
}

export function bailoutHooks(
	current: Fiber,
	workInProgress: Fiber,
	expirationTime: ExpirationTime
) {
	workInProgress.updateQueue = current.updateQueue
	workInProgress.effectTag &= ~(PassiveEffect | UpdateEffect)
	if (current.expirationTime <= expirationTime) {
		current.expirationTime = NoWork
	}
}

function invalidHooks(): any {
	console.error('invalid hooks')
}

export const ContextOnlyDispatcher: Dispatcher = {
	useState: invalidHooks,
	useCallback: invalidHooks,
	useEffect: invalidHooks,
	useLayoutEffect: invalidHooks,
	useMemo: invalidHooks,
	useReducer: invalidHooks,
}
export const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useCallback: mountCallback,
	useEffect: mountEffect,
	useLayoutEffect: mountLayoutEffect,
	useMemo: mountMemo,
	useReducer: mountReducer,
}
export const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useCallback: updateCallback,
	useEffect: updateEffect,
	useLayoutEffect: updateLayoutEffect,
	useMemo: updateMemo,
	useReducer: updateReducer,
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		baseState: null,
		baseUpdate: null,
		queue: null,
		next: null,
	}
	if (workInProgressHook === null) {
		firstWorkInProgressHook = workInProgressHook = hook
	} else {
		workInProgressHook = workInProgressHook.next = hook
	}
	return workInProgressHook
}

function updateWorkInProgressHook(): Hook {
	if (nextWorkInProgressHook !== null) {
		workInProgressHook = nextWorkInProgressHook
		nextWorkInProgressHook = nextWorkInProgressHook.next

		currentHook = nextCurrentHook
		nextCurrentHook = currentHook !== null ? currentHook.next : null
	} else {
		currentHook = nextCurrentHook
		const newHook: Hook = {
			memoizedState: currentHook!.memoizedState,
			baseState: currentHook!.baseState,
			baseUpdate: currentHook!.baseUpdate,
			queue: currentHook!.queue,
			next: null,
		}
		if (workInProgressHook === null) {
			workInProgressHook = firstWorkInProgressHook = newHook
		} else {
			workInProgressHook = workInProgressHook.next = newHook
		}
		nextCurrentHook = currentHook!.next
	}
	return workInProgressHook
}

function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
	return typeof action === 'function' ? action(state) : action
}

function mountState<S>(initialState: S): [S, Dispatch<BasicStateAction<S>>] {
	const hook = mountWorkInProgressHook()
	if (typeof initialState === 'function') {
		initialState = initialState()
	}

	hook.memoizedState = hook.baseState = initialState
	const queue = (hook.queue = {
		last: null,
		dispatch: null,
		lastRenderedReducer: basicStateReducer,
		lastRenderedState: initialState,
	})
	const dispatch = (queue.dispatch = dispacthAction.bind(
		null,
		currentlyRenderingFiber as Fiber,
		queue
	) as any)
	return [hook.memoizedState, dispatch]
}

function updateState<S>(initialState: S): [S, Dispatch<BasicStateAction<S>>] {
	return updateReducer(basicStateReducer, initialState)
}

function mountReducer<S, I, A>(
	reducer: (S: S, A: A) => S,
	initialArg: I,
	init?: (I: I) => S
): [S, Dispatch<A>] {
	const hook = mountWorkInProgressHook()
	let initialState: S
	if (init !== undefined) {
		initialState = init(initialArg)
	} else {
		initialState = initialArg as any
	}

	hook.memoizedState = hook.baseState = initialState
	const queue = (hook.queue = {
		last: null,
		dispatch: null,
		lastRenderedReducer: reducer,
		lastRenderedState: initialState,
	})

	const dispatch = (queue.dispatch = dispacthAction.bind(
		null,
		currentlyRenderingFiber as Fiber,
		queue as any
	) as any)
	return [hook.memoizedState, dispatch]
}

function updateReducer<S, I, A>(
	reducer: (S: S, A: A) => S,
	initialArg: I,
	init?: (I: I) => S
): [S, Dispatch<A>] {
	const hook = updateWorkInProgressHook()
	const queue = hook.queue!
	queue.lastRenderedReducer = reducer
	if (numberOfReRenders > 0) {
		const dispatch: Dispatch<A> = queue.dispatch as any
		if (renderPhaseUpdates !== null) {
			const firstRenderPhaseUpdate = renderPhaseUpdates.get(queue)
			if (firstRenderPhaseUpdate !== null) {
				renderPhaseUpdates.delete(queue)
				let newState = hook.memoizedState
				let update = firstRenderPhaseUpdate
				do {
					const action = update!.action
					newState = reducer(newState, action)
					update = update!.next as any
				} while (update !== null)

				if (!Object.is(newState, hook.memoizedState)) {
					markWorkInProgressReceivedUpdate()
				}

				hook.memoizedState = newState

				if (hook.baseState === queue.last) {
					hook.baseState = newState
				}

				queue.lastRenderedState = newState
				return [newState, dispatch]
			}
		}
		return [hook.memoizedState, dispatch]
	}

	const last = queue.last
	const baseUpdate = hook.baseUpdate
	const baseState = hook.baseState

	let first
	if (baseUpdate !== null) {
		if (last !== null) {
			last.next = null
		}
		first = baseUpdate.next
	} else {
		first = last !== null ? last.next : null
	}

	if (first !== null) {
		let newState = baseState
		let newBaseState = null
		let newBaseUpdate = null
		let prevUpdate = baseUpdate
		let update: Update<S, A> | null = first
		let didSkip = false

		do {
			const updateExpirationTime = update.expirationTime
			if (updateExpirationTime < renderExpirationTime) {
				// priority insufficient
				if (!didSkip) {
					didSkip = true
					newBaseUpdate = prevUpdate
					newBaseState = newState
				}
				if (updateExpirationTime > remainingExpirationTime) {
					remainingExpirationTime = updateExpirationTime
				}
			} else {
				markRenderEventTime(updateExpirationTime)
				if (update.eagerReducer === reducer) {
					newState = update.eagerState
				} else {
					const action = update.action
					newState = reducer(newState, action)
				}

				prevUpdate = update
				update = update.next
			}
		} while (update !== null && update !== first)

		if (!didSkip) {
			newBaseUpdate = prevUpdate
			newBaseState = newState
		}

		if (!Object.is(newState, hook.memoizedState)) {
			markWorkInProgressReceivedUpdate()
		}

		hook.memoizedState = newState
		hook.baseUpdate = newBaseUpdate
		hook.baseState = newBaseState

		queue.lastRenderedState = newState
	}
	const dispatch: Dispatch<A> = queue.dispatch as any
	return [hook.memoizedState, dispatch]
}

function dispacthAction<S, A>(
	fiber: Fiber,
	queue: UpdateQueue<S, A>,
	action: A
) {
	const alternate = fiber.alternate

	if (
		fiber === currentlyRenderingFiber ||
		(alternate !== null && alternate === currentlyRenderingFiber)
	) {
		// render phase update
		didScheduleRenderPhaseUpdate = true
		const update: Update<S, A> = {
			expirationTime: renderExpirationTime,
			action,
			eagerReducer: null,
			eagerState: null,
			next: null,
		}

		if (renderPhaseUpdates === null) {
			renderPhaseUpdates = new Map()
		}

		const firstRenderPhaseUpdate = renderPhaseUpdates.get(queue)
		if (firstRenderPhaseUpdate === undefined) {
			renderPhaseUpdates.set(queue, update)
		} else {
			let lastRenderPhaseUpdate = firstRenderPhaseUpdate
			while (lastRenderPhaseUpdate.next !== null) {
				lastRenderPhaseUpdate = lastRenderPhaseUpdate.next
			}
			lastRenderPhaseUpdate.next = update
		}
	} else {
		// TODO: flush passive effect
		const currentTime = requestCurrentTime()
		const expirationTime = computeExpirationTimeForFiber(currentTime)

		const update: Update<S, A> = {
			expirationTime,
			action,
			eagerReducer: null,
			eagerState: null,
			next: null,
		}

		const last = queue.last
		if (last === null) {
			update.next = update
		} else {
			const first = last.next
			if (first !== null) {
				update.next = first
			}
			last.next = update
		}
		queue.last = update

		if (
			fiber.expirationTime === NoWork &&
			(alternate === null || alternate.expirationTime === NoWork)
		) {
			const lastRenderedReducer = queue.lastRenderedReducer
			if (lastRenderedReducer !== null) {
				try {
					const currentState = queue.lastRenderedState as S
					const eagerState = lastRenderedReducer(currentState, action)
					update.eagerReducer = lastRenderedReducer
					update.eagerState = eagerState
					if (Object.is(eagerState, currentState)) {
						return
					}
				} catch (error) {}
			}
		}
		scheduleUpdateOnFiber(fiber, expirationTime)
	}
}

function mountEffect(
	create: () => (() => void) | void,
	deps: Array<any> | void | null
) {
	const fiberEffectTag = UpdateEffect | PassiveEffect
	const hookEffectTag = UnmountPassive | MountPassive
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	sideEffectTag |= fiberEffectTag
	hook.memoizedState = pushEffect(hookEffectTag, create, undefined, nextDeps)
}

function updateEffect(
	create: () => (() => void) | void,
	deps: Array<any> | void | null
) {
	const fiberEffectTag = UpdateEffect | PassiveEffect
	const hookEffectTag = UnmountPassive | MountPassive
	const hook = updateWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	let destroy = undefined
	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState
		destroy = prevEffect.destroy
		if (nextDeps !== null) {
			const prevDeps = prevEffect.deps
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				pushEffect(NoHookEffect, create, destroy, nextDeps)
				return
			}
		}
	}
	sideEffectTag |= fiberEffectTag
	hook.memoizedState = pushEffect(hookEffectTag, create, destroy, nextDeps)
}

function mountLayoutEffect(
	create: () => (() => void) | void,
	deps: Array<any> | void | null
) {
	const fiberEffectTag = UpdateEffect
	const hookEffectTag = UnmountMutation | MountLayout
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	sideEffectTag |= fiberEffectTag
	hook.memoizedState = pushEffect(hookEffectTag, create, undefined, nextDeps)
}

function updateLayoutEffect(
	create: () => (() => void) | void,
	deps: Array<any> | void | null
) {
	const fiberEffectTag = UpdateEffect
	const hookEffectTag = UnmountMutation | MountLayout
	const hook = updateWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	let destroy = undefined
	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState
		destroy = prevEffect.destroy
		if (nextDeps !== null) {
			const prevDeps = prevEffect.deps
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				pushEffect(NoHookEffect, create, destroy, nextDeps)
				return
			}
		}
	}
	sideEffectTag |= fiberEffectTag
	hook.memoizedState = pushEffect(hookEffectTag, create, destroy, nextDeps)
}

function mountCallback<T>(callback: T, deps: Array<any> | void | null): T {
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	hook.memoizedState = [callback, nextDeps]
	return callback
}

function updateCallback<T>(callback: T, deps: Array<any> | void | null): T {
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	const prevState = hook.memoizedState
	if (prevState !== null) {
		if (nextDeps !== null) {
			const prevDeps = prevState[1]
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				return prevState[0]
			}
		}
	}
	hook.memoizedState = [callback, nextDeps]
	return callback
}

function mountMemo<T>(nextCreate: () => T, deps: Array<any> | void | null): T {
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	const nextValue = nextCreate()
	hook.memoizedState = [nextValue, nextDeps]
	return nextValue
}

function updateMemo<T>(nextCreate: () => T, deps: Array<any> | void | null): T {
	const hook = mountWorkInProgressHook()
	const nextDeps = deps === undefined ? null : deps
	const prevState = hook.memoizedState
	if (prevState !== null) {
		if (nextDeps !== null) {
			const prevDeps = prevState[1]
			if (areHookInputsEqual(nextDeps, prevDeps)) {
				return prevState[0]
			}
		}
	}
	const nextValue = nextCreate()
	hook.memoizedState = [nextValue, nextDeps]
	return nextValue
}

function pushEffect(
	tag: HookEffectTag,
	create: () => (() => void) | void,
	destroy: (() => void) | void,
	deps: Array<any> | void | null
) {
	const effect: Effect = {
		tag,
		create,
		destroy,
		deps,
		next: null,
	}

	if (componentUpdateQueue === null) {
		componentUpdateQueue = createFunctionComponentUpdateQueue()
		componentUpdateQueue.lastEffect = effect.next = effect
	} else {
		const lastEffect = componentUpdateQueue.lastEffect
		if (lastEffect === null) {
			componentUpdateQueue.lastEffect = effect.next = effect
		} else {
			const firstEffect = lastEffect.next
			lastEffect.next = effect
			effect.next = firstEffect
			componentUpdateQueue.lastEffect = effect
		}
	}
	return effect
}

function createFunctionComponentUpdateQueue() {
	return {
		lastEffect: null,
	}
}

function areHookInputsEqual(nextDeps: Array<any>, prevDeps: Array<any> | null) {
	if (prevDeps === null) {
		return false
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue
		}
		return false
	}
	return true
}
