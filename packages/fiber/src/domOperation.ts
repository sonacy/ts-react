export type Props = {
	autoFocus?: boolean
	children?: any
	hidden?: boolean
	suppressHydrationWarning?: boolean
	dangerouslySetInnerHTML?: any
	style?: {
		display?: string
	}
	bottom?: null | number
	left?: null | number
	right?: null | number
	top?: null | number
}

export function shouldSetTextContent(type: string, props: Props): boolean {
	return (
		type === 'textarea' ||
		type === 'option' ||
		type === 'noscript' ||
		typeof props.children === 'string' ||
		typeof props.children === 'number' ||
		(typeof props.dangerouslySetInnerHTML === 'object' &&
			props.dangerouslySetInnerHTML !== null &&
			props.dangerouslySetInnerHTML.__html != null)
	)
}
