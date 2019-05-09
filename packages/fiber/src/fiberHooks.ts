import { ExpirationTime, NoWork } from './expirationTime'
import { HookEffectTag } from './hookEffectTag'
import { Fiber } from './fiber'
import { SideEffectTag, Passive, Update } from '@ts-react/shared'

export const ReactCurrentDispatcher: { current: Dispatcher | null } = {
	current: null,
}

type BasicStateAction<S> = ((S: S) => S) | S

type Dispatch<A> = (A: A) => void

export type Dispatcher = {
	useState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>]
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
	useImperativeHandle<T>(
		ref: { current: T | null } | ((inst: T | null) => any) | null | void,
		create: () => T,
		deps: Array<any> | void | null
	): void
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
	deps: Array<any> | null
	next: Effect
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
	workInProgress.effectTag &= ~(Passive | Update)
	if (current.expirationTime <= expirationTime) {
		current.expirationTime = NoWork
	}
}

function invalidHooks(): any {
	console.error('invalid hooks')
}

const ContextOnlyDispatcher: Dispatcher = {
	useState: invalidHooks,
	useCallback: invalidHooks,
	useEffect: invalidHooks,
	useImperativeHandle: invalidHooks,
	useLayoutEffect: invalidHooks,
	useMemo: invalidHooks,
	useReducer: invalidHooks,
}
const HooksDispatcherOnMount: Dispatcher = {}
const HooksDispatcherOnUpdate: Dispatcher = {}
