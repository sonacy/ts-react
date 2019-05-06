import { REACT_ELEMENT_TYPE } from './ReactSymbols'

export type ReactElement = {
	type: any
	key: string | undefined
	ref: any
	props: any
	$$typeof: typeof REACT_ELEMENT_TYPE
}
