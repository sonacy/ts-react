import { ReactElement } from './element'
import { FiberRoot, updateContainer } from '@ts-react/fiber'

export type DOMContainer =
	| (Element & {
			_internalFiberRoot: FiberRoot | null
	  })
	| (Document & {
			_internalFiberRoot: FiberRoot | null
	  })

export const render = (
	element: ReactElement,
	container: DOMContainer,
	callback?: Function
) => {
	// remove container other child
	let rootSibling
	while ((rootSibling = container.lastChild)) {
		container.removeChild(rootSibling)
	}

	// create fiberroot, bind to container
	let fiberRoot = container._internalFiberRoot
	if (!fiberRoot) {
		fiberRoot = container._internalFiberRoot = new FiberRoot(container)
	}
	// update container
	updateContainer(element, fiberRoot, callback)
}
