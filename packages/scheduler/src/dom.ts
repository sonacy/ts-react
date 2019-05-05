// fake requestIdleCallback
// assume in dom enviromnent
// window performance MessageChannel requestAnimationFrame exsits

// cause tab in background, requestAnimationFrame won't work, so use setTimeout fallback
let rafID: number
let timeoutID: number
const ANIMATION_FRAME_TIMEOUT = 100
const requestAnimationFrameWithTimeout = (cb: (timestamp: number) => void) => {
	rafID = requestAnimationFrame(timestamp => {
		clearTimeout(timeoutID)
		cb(timestamp)
	})
	timeoutID = setTimeout(() => {
		cancelAnimationFrame(rafID)
		cb(getCurrentTime())
	}, ANIMATION_FRAME_TIMEOUT)
}

export const getCurrentTime = () => {
	return performance.now()
}
// absolute time for a frame end
let frameDeadline = 0
// assume start with 30hz, that is 33ms per frame
let previousFrameTime = 33
let activeFrameTime = 33
// weather to lock the frame rate
let fpsLocked = false

type IdleCallback = (didTimeout: boolean) => void
// like requestIdleCallback's callback
let scheduledHostCallback: IdleCallback | null = null
// MessageChannel send
let isMessageEventScheduled = false
let timeoutTime = -1
// calling requestAnimationFrame
let isAnimationFrameScheduled = false
// expire the timeoutTime, so flush that not wait for the idle time
let isFlushingHostCallback = false

const channel = new MessageChannel()
channel.port1.onmessage = () => {
	isMessageEventScheduled = false
	const previousScheduledHostCallback = scheduledHostCallback
	const prevTimeoutTime = timeoutTime
	scheduledHostCallback = null
	timeoutTime = -1

	let didTimeout = false
	const currentTime = getCurrentTime()

	// the frame do not have idle time
	if (frameDeadline - currentTime <= 0) {
		if (prevTimeoutTime !== -1 && prevTimeoutTime <= currentTime) {
			// expire the timeout
			didTimeout = true
		} else {
			// this frame expire, run in next frame
			if (!isAnimationFrameScheduled) {
				isAnimationFrameScheduled = true
				requestAnimationFrameWithTimeout(animationTick)
			}
			scheduledHostCallback = previousScheduledHostCallback
			timeoutTime = prevTimeoutTime
			return
		}
	}

	if (previousScheduledHostCallback !== null) {
		isFlushingHostCallback = true
		try {
			previousScheduledHostCallback(didTimeout)
		} finally {
			isFlushingHostCallback = false
		}
	}
}

const animationTick = (rafTime: number) => {
	if (scheduledHostCallback !== null) {
		requestAnimationFrameWithTimeout(animationTick)
	} else {
		isAnimationFrameScheduled = false
		return
	}

	// check the frame time
	// rafTime is frame startTime
	// frameDeadline is lastFrame endTime
	// ideally nextFrameTime should equal to activeFrameTime
	let nextFrameTime = rafTime - frameDeadline + activeFrameTime
	if (
		nextFrameTime < activeFrameTime &&
		previousFrameTime < activeFrameTime &&
		!fpsLocked
	) {
		if (nextFrameTime < 8) {
			nextFrameTime = 8
		}
		activeFrameTime =
			activeFrameTime < previousFrameTime ? previousFrameTime : activeFrameTime
	} else {
		previousFrameTime = nextFrameTime
	}

	frameDeadline = rafTime + activeFrameTime

	if (!isMessageEventScheduled) {
		isMessageEventScheduled = true
		channel.port2.postMessage(undefined)
	}
}

export const requestHostCallback = (
	callback: IdleCallback,
	absoluteTimeout: number
) => {
	scheduledHostCallback = callback
	timeoutTime = absoluteTimeout
	if (isFlushingHostCallback || absoluteTimeout < 0) {
		// flushing or didtimeout, just fire the callback
		channel.port2.postMessage(undefined)
	} else if (!isAnimationFrameScheduled) {
		isAnimationFrameScheduled = true
		requestAnimationFrameWithTimeout(animationTick)
	}
}

export const cancelHostCallback = () => {
	scheduledHostCallback = null
	timeoutTime = -1
	isMessageEventScheduled = false
}

// still have idle time in this frame
export const shouldYieldToHost = () => {
	return frameDeadline <= getCurrentTime()
}

// lock the frame rate or reset to 33
export const forceFrameRate = (fps: number) => {
	if (fps < 0 || fps > 125) {
		console.error(
			'forceFrameRate takes a positive int between 0 and 125, forcing framerates higher than 125 fps is not unsupported'
		)
	}
	if (fps > 0) {
		activeFrameTime = Math.floor(1000 / fps)
		fpsLocked = true
	} else {
		activeFrameTime = 33
		fpsLocked = false
	}
}
