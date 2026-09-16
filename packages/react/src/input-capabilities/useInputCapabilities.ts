import { useSyncExternalStore } from 'react'
import { createInputCapabilities, type InputCapabilities, type InputCapabilitiesStore } from '@guillemservera/details-core/input-capabilities'

// One store for every instance, created on first use so importing stays side-effect free.
let store: InputCapabilitiesStore | undefined

/**
 * What the device's pointers can do. All `false` on the server and during hydration, then kept current
 * while any instance is mounted. The snapshot object is replaced only when a value changes.
 */
export function useInputCapabilities(): InputCapabilities {
  const capabilities = (store ??= createInputCapabilities())
  return useSyncExternalStore(capabilities.subscribe, capabilities.getSnapshot, capabilities.getServerSnapshot)
}
