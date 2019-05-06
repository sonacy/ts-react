import {
	IdlePriority,
	ImmediatePriority,
	UserBlockingPriority,
	NormalPriority,
} from '@ts-react/scheduler'

export type ExpirationTime = number

export const MAX_SIGNED_31_BIT_INT = 1073741823
export const NoWork = 0
export const Never = 1
export const Sync = MAX_SIGNED_31_BIT_INT
const UNIT_SIZE = 10
const MAGIC_NUMBER_OFFSET = MAX_SIGNED_31_BIT_INT - 1

export const msToExpirationTime = (ms: number) => {
	return MAGIC_NUMBER_OFFSET - ((ms / UNIT_SIZE) | 0)
}

export const expirationTimeToMs = (expirationTime: ExpirationTime) => {
	return (MAGIC_NUMBER_OFFSET - expirationTime) * UNIT_SIZE
}

const ceiling = (num: number, precision: number) => {
	return (((num / precision) | 0) + 1) * precision
}

const computeExpirationBucket = (
	currentTime: ExpirationTime,
	expirationInMs: number,
	bucketSizeMs: number
) => {
	return (
		MAGIC_NUMBER_OFFSET -
		ceiling(
			MAGIC_NUMBER_OFFSET - currentTime + expirationInMs / UNIT_SIZE,
			bucketSizeMs / UNIT_SIZE
		)
	)
}

export const LOW_PRIORITY_EXPIRATION = 5000
export const LOW_PRIORITY_BATCH_SIZE = 250

export const computeAsyncExpiration = (currentTime: ExpirationTime) => {
	return computeExpirationBucket(
		currentTime,
		LOW_PRIORITY_EXPIRATION,
		LOW_PRIORITY_BATCH_SIZE
	)
}

export const computeAsyncExpirationNoBucket = (currentTime: ExpirationTime) => {
	return currentTime - LOW_PRIORITY_EXPIRATION / UNIT_SIZE
}

export const HIGH_PRIORITY_EXPIRATION = 150
export const HIGH_PRIORITY_BATCH_SIZE = 100

export const computeInteractiveExpiration = (currentTime: ExpirationTime) => {
	return computeExpirationBucket(
		currentTime,
		HIGH_PRIORITY_EXPIRATION,
		HIGH_PRIORITY_BATCH_SIZE
	)
}

export const inferPriorityFromExpirationTime = (
	currentTime: ExpirationTime,
	expirationTime: ExpirationTime
) => {
	if (expirationTime === Sync) {
		return ImmediatePriority
	}
	if (expirationTime === Never) {
		return IdlePriority
	}

	const msUtil =
		expirationTimeToMs(expirationTime) - expirationTimeToMs(currentTime)

	if (msUtil <= 0) {
		return ImmediatePriority
	}

	if (msUtil <= HIGH_PRIORITY_EXPIRATION + HIGH_PRIORITY_BATCH_SIZE) {
		return UserBlockingPriority
	}

	if (msUtil <= LOW_PRIORITY_EXPIRATION + LOW_PRIORITY_BATCH_SIZE) {
		return NormalPriority
	}
	// TODO: LowPriority
	return IdlePriority
}
