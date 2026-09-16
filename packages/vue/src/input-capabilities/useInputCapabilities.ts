import { shallowRef, watchPostEffect, type ShallowRef } from 'vue'
import { createInputCapabilities, type InputCapabilities, type InputCapabilitiesStore } from '@guillemservera/details-core/input-capabilities'

// One store for every instance, created on first use so importing stays side-effect free.
let store: InputCapabilitiesStore | undefined

/**
 * What the device's pointers can do. All `false` on the server and until mount, then kept current
 * while any instance is alive. The snapshot object is replaced only when a value changes.
 */
export function useInputCapabilities(): Readonly<ShallowRef<InputCapabilities>> {
  const capabilities = (store ??= createInputCapabilities())
  const snapshot = shallowRef(capabilities.getServerSnapshot())
  watchPostEffect((onCleanup) => {
    const sync = () => {
      snapshot.value = capabilities.getSnapshot()
    }
    onCleanup(capabilities.subscribe(sync))
    sync()
  })
  return snapshot
}
