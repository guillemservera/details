import { useSyncExternalStore } from 'react'
import { detectPlatform, type Platform } from '@guillemservera/details-core/platform'

const subscribe = () => () => {}
const unknown = (): Platform => 'unknown'

/**
 * The operating system, e.g. to label shortcuts. `'unknown'` on the server and during hydration,
 * so hydration always matches the server render; client-only renders get the detected value at once.
 */
export function usePlatform(): Platform {
  return useSyncExternalStore(subscribe, detectPlatform, unknown)
}
