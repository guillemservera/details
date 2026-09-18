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

/** A highlight store with its state mirrored into refs. */
export interface HighlightStoreState extends HighlightState {
  /** The store itself, for integrations that drive the highlight: `highlight`, `suspendPointer`, `nudge`... */
  store: HighlightStore
}

/** What composables that measure geometry return besides their state. */
export interface Remeasure {
  /** Measures again, for geometry that changed without a DOM mutation or a resize (e.g. an ancestor's transform). */
  remeasure: () => void
}

const shared = new WeakMap<object, HighlightStoreState>()

/**
 * The state can be explicitly keyed by a store when two composables use different reactive container refs for
 * the same element (for example, a bridge's computed target and a consumer's stable panel ref).
 */
export function sharedHighlight(
  container: Readonly<Ref<HTMLElement | null>>,
  create: () => HighlightStore,
  provided?: HighlightStore,
): HighlightStoreState {
  let entry = shared.get(provided ?? container)
  if (!entry) {
    const store = provided ?? create()
    const highlighted = shallowRef<HTMLElement | null>(store.highlighted)
    const source = shallowRef<HighlightSource | null>(store.source)
    store.subscribe(() => {
      highlighted.value = store.highlighted
      source.value = store.source
    })
    shared.set(store, (entry = { store, highlighted, source }))
  }
  shared.set(container, entry)
  return entry
}

/** Binds `useHighlightStore` to the calling entry's core store factory. */
export function highlightStoreComposable(create: () => HighlightStore) {
  /**
   * The highlight store that the highlight composables receiving `container` share, and its state as refs.
   * Call it with the same ref, in any order, to drive the highlight from a component that owns its own model.
   */
  return (container: Readonly<Ref<HTMLElement | null>>): HighlightStoreState => {
    const state = sharedHighlight(container, create)
    watchElement(container, el => state.store.attach(el))
    return state
  }
}

/** Keeps the latest instance `watchElement` created, for methods that forward to it. */
export function latestInstance<T extends { destroy: () => void }>() {
  let current: T | undefined
  return {
    get: () => current,
    track(instance: T) {
      current = instance
      return () => {
        instance.destroy()
        if (current === instance) current = undefined
      }
    },
  }
}
