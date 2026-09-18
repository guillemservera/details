import { createArrowNavigation, createHighlightStore, type HighlightAxis, type HighlightStore, type MaybeGetter } from '@guillemservera/details-core/arrow-navigation'
import { useElements, type ElementRef } from '../shared/elements'
import { highlightStoreHook, sharedStore, useHighlightState, type HighlightState } from '../shared/highlight'

export interface ArrowNavigationOptions {
  /** `y`: ↑ ↓, `x`: ← →, `xy`: both pairs, in item order. Changing it re-creates the behavior. */
  axis?: HighlightAxis
  /** Wrap from the last item to the first and back. Default false. */
  loop?: boolean
  /** Keys also work while the pointer is over the container, before it has focus. Default true. */
  whileHovered?: boolean
  /** Pixels the mouse must travel before hover takes the highlight back from the keyboard. Default 6. */
  resumeDistance?: number
  /** Total items of a virtualized list; items carry `data-index`. Disabled indexes are skipped from the full model. */
  count?: number
  /** Disabled indexes in the full model, including rows that are not currently rendered. */
  isDisabled?: (index: number) => boolean
  /** Brings an unrendered item of a virtualized list into view. */
  scrollToIndex?: (index: number) => void
  /** An editable target explicitly owned by this navigation. Its focus is retained while moving. */
  focusTarget?: ElementRef
  /** Consumer-owned current index. When provided, it is the navigation starting point. */
  currentIndex?: MaybeGetter<number>
  /** Reports keyboard moves to a consumer-owned index model. */
  onIndexChange?: (index: number) => void
  /** Shared highlight state. Defaults to the container's own store. */
  store?: HighlightStore
}

/** The highlight store shared by the highlight hooks on `container`, with its state. */
export const useHighlightStore = /* @__PURE__ */ highlightStoreHook(createHighlightStore)

/**
 * Arrow keys, Home and End move the highlight; Enter and Space activate it.
 * Alone, it behaves like plain hover (the item under the mouse is highlighted, so keys continue from it);
 * with useProximityHover on the same container ref, that hook owns the pointer.
 * Give the container `tabIndex={0}`: navigation moves focus to it, so virtualized items can unmount freely.
 */
export function useArrowNavigation(container: ElementRef, options: ArrowNavigationOptions = {}): HighlightState {
  const store = options.store ?? sharedStore(container, createHighlightStore)
  useElements([container], [options.axis, options.store], options, ([el], latest) => createArrowNavigation(el, {
    axis: options.axis,
    loop: () => latest().loop,
    whileHovered: () => latest().whileHovered,
    resumeDistance: () => latest().resumeDistance,
    count: () => latest().count,
    isDisabled: index => latest().isDisabled?.(index) ?? false,
    scrollToIndex: index => latest().scrollToIndex?.(index),
    focusTarget: () => latest().focusTarget?.current ?? null,
    currentIndex: () => {
      const value = latest().currentIndex
      return typeof value === 'function' ? value() : value
    },
    onIndexChange: index => latest().onIndexChange?.(index),
    store,
  }))
  return useHighlightState(store)
}
