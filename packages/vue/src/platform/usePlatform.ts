import { shallowRef, watchPostEffect, type ShallowRef } from 'vue'
import { detectPlatform, type Platform } from '@guillemservera/details-core/platform'

/**
 * The operating system, e.g. to label shortcuts. `'unknown'` on the server and until mount,
 * so hydration always matches the server render.
 */
export function usePlatform(): Readonly<ShallowRef<Platform>> {
  const platform = shallowRef<Platform>('unknown')
  watchPostEffect(() => {
    platform.value = detectPlatform()
  })
  return platform
}
