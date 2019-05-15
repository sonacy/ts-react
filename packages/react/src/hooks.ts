import { ReactCurrentDispatcher } from '@ts-react/fiber'

export function useState<S>(initialState: (() => S) | S) {
	return ReactCurrentDispatcher.current!.useState(initialState)
}
export function useReducer<S, I, A>(
	reducer: (S: S, A: A) => S,
	initialArg: I,
	init?: (I: I) => S
) {
	return ReactCurrentDispatcher.current!.useReducer(reducer, initialArg, init)
}
export function useEffect(
	create: () => (() => void) | void,
	deps: Array<any> | void | null
) {
	return ReactCurrentDispatcher.current!.useEffect(create, deps)
}
export function useLayoutEffect(
	create: () => (() => void) | void,
	deps: Array<any> | void | null
) {
	return ReactCurrentDispatcher.current!.useLayoutEffect(create, deps)
}
export function useCallback<T>(callback: T, deps: Array<any> | void | null) {
	return ReactCurrentDispatcher.current!.useCallback(callback, deps)
}
export function useMemo<T>(
	nextCreate: () => T,
	deps: Array<any> | void | null
) {
	return ReactCurrentDispatcher.current!.useMemo(nextCreate, deps)
}
