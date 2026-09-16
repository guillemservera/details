import { shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import type { HighlightSource, HighlightStore } from '@guillemservera/details-core/proximity-hover'

export interface HighlightState {
  /** The highlighted item. */
  highlighted: Readonly<ShallowRef<HTMLElement | null>>
  /** What highlighted it. */
  source: Readonly<ShallowRef<HighlightSource | null>>
}

/**
 * Runs `setup` once `target` renders and again whenever it is replaced.
 * The returned cleanup runs on replacement and when the scope is disposed.
 */
export function watchElement<T extends Element>(target: Readonly<Ref<T | null>>, setup: (el: T) => () => void) {
  watch(target, (el, _, onCleanup) => {
    if (el) onCleanup(setup(el))
  }, { immediate: true, flush: 'post' })
}

const shared = new WeakMap<object, HighlightState & { store: HighlightStore }>()

/**
 * The store and mirrored state shared by every composable that receives the same container ref, so they
 * compose across element replacement. `create` comes from the caller's own core entry, which keeps entries apart.
 */
export function useHighlightStore(container: Readonly<Ref<HTMLElement | null>>, create: () => HighlightStore) {
  let entry = shared.get(container)
  if (!entry) {
    const store = create()
    const highlighted = shallowRef<HTMLElement | null>(null)
    const source = shallowRef<HighlightSource | null>(null)
    store.subscribe(() => {
      highlighted.value = store.highlighted
      source.value = store.source
    })
    shared.set(container, (entry = { store, highlighted, source }))
  }
  return entry
}
