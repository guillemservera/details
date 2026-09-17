import { toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { createArrowNavigation, createHighlightStore, type HighlightAxis } from '@guillemservera/details-core/arrow-navigation'
import { highlightStoreComposable, sharedHighlight, watchElement, type HighlightState } from '../shared/highlight'

export interface ArrowNavigationOptions {
  /** `y`: ↑ ↓, `x`: ← →, `xy`: both pairs, in item order. */
  axis?: HighlightAxis
  /** Wrap from the last item to the first and back. */
  loop?: MaybeRefOrGetter<boolean>
  /** Keys also work while the pointer is over the container, before it has focus. */
  whileHovered?: MaybeRefOrGetter<boolean>
  /** Pixels the mouse must travel before hover takes the highlight back from the keyboard. */
  resumeDistance?: MaybeRefOrGetter<number>
  /** Total items of a virtualized list; items carry `data-index`. Disabled items are only skipped when rendered. */
  count?: MaybeRefOrGetter<number | undefined>
  /** Brings an unrendered item of a virtualized list into view. */
  scrollToIndex?: (index: number) => void
}

/** The highlight store shared by the highlight composables on `container`, with its state as refs. */
export const useHighlightStore = /* @__PURE__ */ highlightStoreComposable(createHighlightStore)

/**
 * Arrow keys, Home and End move the highlight; Enter and Space activate it.
 * Alone, it behaves like plain hover (the item under the mouse is highlighted, so keys continue from it);
 * with useProximityHover on the same container ref, that composable owns the pointer.
 * Give the container `tabindex="0"`: navigation moves focus to it, so virtualized items can unmount freely.
 */
export function useArrowNavigation(container: Readonly<Ref<HTMLElement | null>>, options: ArrowNavigationOptions = {}): HighlightState {
  const { axis, loop, whileHovered, resumeDistance, count, scrollToIndex } = options
  const { store, highlighted, source } = sharedHighlight(container, createHighlightStore)
  watchElement(container, el => createArrowNavigation(el, {
    axis,
    loop: () => toValue(loop),
    whileHovered: () => toValue(whileHovered),
    resumeDistance: () => toValue(resumeDistance),
    count: () => toValue(count),
    scrollToIndex,
    store,
  }).destroy)
  return { highlighted, source }
}
