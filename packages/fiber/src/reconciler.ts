import { FiberRoot } from './fiberRoot'
import {
	requestCurrentTime,
	computeExpirationTimeForFiber,
	scheduleUpdateOnFiber,
} from './scheduler'
import { Fiber } from './fiber'
import { ExpirationTime } from './expirationTime'
import { createUpdate, enqueueUpdate } from './updateQueue'
import { ReactElement } from '@ts-react/shared'

export const updateContainer = (
	element: ReactElement,
	container: FiberRoot,
	callback?: Function
) => {
	// root fiber
	const current = container.current
	const currentTime = requestCurrentTime()
	const expirationTime = computeExpirationTimeForFiber(currentTime)

	return scheduleRootUpdate(current, element, expirationTime, callback)
}

function scheduleRootUpdate(
	current: Fiber,
	element: ReactElement,
	expirationTime: ExpirationTime,
	callback?: Function
) {
	// create update
	const update = createUpdate(expirationTime)
	update.payload = { element }
	if (typeof callback === 'function') {
		update.callback = callback
	}
	// TODO: flush effect for hooks
	// enqueue
	enqueueUpdate(current, update)
	scheduleUpdateOnFiber(current, expirationTime)
	return expirationTime
}
