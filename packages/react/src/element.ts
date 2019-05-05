import { REACT_ELEMENT_TYPE } from '@ts-react/shared'

const ReactElement = (
	type: any,
	key: number | string,
	ref: any,
	owner: any,
	props: any
) => {
	const element = {
		type,
		key,
		ref,
		owner,
		props,
		$$typeof: REACT_ELEMENT_TYPE,
	}
	return element
}
