import { useRef, useSyncExternalStore } from 'react'
import type { HighlightSource, HighlightStore } from '@guillemservera/details-core/proximity-hover'
import { useElements, type ElementRef } from './elements'

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

/** A highlight store with its state. */
export interface HighlightStoreState extends HighlightState {
  /** The store itself, for integrations that drive the highlight: `highlight`, `suspendPointer`, `nudge`... */
  store: HighlightStore
}

/** What hooks that measure geometry return besides their state. */
export interface Remeasure {
  /** Measures again, for geometry that changed without a DOM mutation or a resize (e.g. an ancestor's transform). Stable. */
  remeasure: () => void
}

/** Binds `useHighlightStore` to the calling entry's core store factory. */
export function highlightStoreHook(create: () => HighlightStore) {
  /**
   * The highlight store that the highlight hooks receiving `container` share, and its state; re-renders when the
   * highlight changes. Use it to drive the highlight from a component that owns its own model.
   */
  return (container: ElementRef): HighlightStoreState => {
    const store = sharedStore(container, create)
    useElements([container], [store], undefined, ([el]) => ({ destroy: store.attach(el) }))
    return { store, ...useHighlightState(store) }
  }
}

/** A stable `remeasure` that forwards to the current instance. */
export function useRemeasure(current: () => { remeasure: () => void } | undefined): Remeasure {
  return useRef<Remeasure>({ remeasure: () => current()?.remeasure() }).current
}

/** Re-renders when the highlight changes; `null` on the server and during hydration. */
export function useHighlightState(store: HighlightStore): HighlightState {
  const highlighted = useSyncExternalStore(store.subscribe, () => store.highlighted, () => null)
  const source = useSyncExternalStore(store.subscribe, () => store.source, () => null)
  return { highlighted, source }
}
