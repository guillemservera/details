import { useSyncExternalStore } from 'react'
import type { HighlightSource, HighlightStore } from '@guillemservera/details-core/proximity-hover'

export interface HighlightState {
  /** The highlighted item. */
  highlighted: HTMLElement | null
  /** What highlighted it. */
  source: HighlightSource | null
}

const stores = new WeakMap<object, HighlightStore>()

/**
 * The store shared by every hook that receives the same container ref, so they compose across element
 * replacement. `create` comes from the caller's own core entry, which keeps entries apart.
 */
export function sharedStore(container: object, create: () => HighlightStore): HighlightStore {
  let store = stores.get(container)
  if (!store) stores.set(container, (store = create()))
  return store
}

/** Re-renders when the highlight changes; `null` on the server and during hydration. */
export function useHighlightState(store: HighlightStore): HighlightState {
  const highlighted = useSyncExternalStore(store.subscribe, () => store.highlighted, () => null)
  const source = useSyncExternalStore(store.subscribe, () => store.source, () => null)
  return { highlighted, source }
}
