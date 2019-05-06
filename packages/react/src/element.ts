import { REACT_ELEMENT_TYPE } from '@ts-react/shared'

const ReactElement = (
	type: any,
	key: string | undefined,
	ref: any,
	props: any
) => {
	const element: ReactElement = {
		type,
		key,
		ref,
		props,
		$$typeof: REACT_ELEMENT_TYPE,
	}
	return element
}

export type ReactElement = {
	type: any
	key: string | undefined
	ref: any
	props: any
	$$typeof: typeof REACT_ELEMENT_TYPE
}

export function createElement(type: any, config: any, children: any) {
	const props: any = {}
	let ref
	let key
	let propName

	if (config != null) {
		if (config.key !== undefined) {
			key = '' + config.key
		}
		if (config.ref !== undefined) {
			ref = config.ref
		}

		for (propName in config) {
			if (
				Object.prototype.hasOwnProperty.call(config, propName) &&
				propName !== ref &&
				propName !== key
			) {
				props[propName] = config[propName]
			}
		}
	}

	const childrenLength = arguments.length - 2
	if (childrenLength === 1) {
		props.children = children
	} else if (childrenLength > 1) {
		const childArray = new Array(childrenLength)
		for (let i = 0; i < childrenLength; i++) {
			childArray[i] = arguments[i + 2]
		}
		props.children = childArray
	}

	if (type && type.defaultProps) {
		const defaultProps = type.defaultProps
		for (propName in defaultProps) {
			if (props[propName] === undefined) {
				props[propName] = defaultProps[propName]
			}
		}
	}

	return ReactElement(type, key, ref, props)
}
