import { Fiber } from './fiber'

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

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'
const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

export function getIntrinsicNamespace(type: string): string {
	switch (type) {
		case 'svg':
			return SVG_NAMESPACE
		case 'math':
			return MATH_NAMESPACE
		default:
			return HTML_NAMESPACE
	}
}

export function createElement(type: string) {
	// TODO:  web component script
	const ns = getIntrinsicNamespace(type)
	if (ns === HTML_NAMESPACE) {
		return document.createElement(type)
	} else {
		return document.createElementNS(ns, type)
	}
}

const randomKey = Math.random()
	.toString(36)
	.slice(2)
const internalInstanceKey = '__reactInternalInstance$' + randomKey
const internalEventHandlersKey = '__reactEventHandlers$' + randomKey

export function createInstance(type: string, props: Props, fiber: Fiber) {
	const element: any = createElement(type)
	element[internalInstanceKey] = fiber
	element[internalEventHandlersKey] = props
	return element
}

export function appendChild(parent: Element, child: Element) {
	parent.appendChild(child)
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

export function finalizeInitialChildren(
	domElement: Element,
	type: string,
	props: Props
) {
	setInitialProperties(domElement, type, props)
	return shouldAutoFocusHostComponent(type, props)
}

function shouldAutoFocusHostComponent(type: string, props: Props): boolean {
	switch (type) {
		case 'button':
		case 'input':
		case 'select':
		case 'textarea':
			return !!props.autoFocus
	}
	return false
}

function setInitialProperties(domElement: Element, tag: string, nextProps: Object) {

}

function setValueForProperty(node: Element, name: string, value: any) {
	// TODO: namespace and boolean
	if (value === null || value === undefined) {
		node.removeAttribute(name)
	} else {
		node.setAttribute(name, value)
	}
}
