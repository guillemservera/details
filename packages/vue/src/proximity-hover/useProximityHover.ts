import { toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { createHighlightStore, createProximityHover, type HighlightAxis } from '@guillemservera/details-core/proximity-hover'
import { highlightStoreComposable, latestInstance, sharedHighlight, watchElement, type HighlightState, type Remeasure } from '../shared/highlight'

export interface ProximityHoverOptions {
  /** Axis the nearest item is measured along: `y` for lists, `x` for strips, `xy` for grids and wrapping rows. */
  axis?: HighlightAxis
  /** Pixels the mouse must travel before it takes the highlight back from the keyboard. */
  resumeDistance?: MaybeRefOrGetter<number>
  /** A click in a gap between items clicks the highlighted item. */
  gapClick?: MaybeRefOrGetter<boolean>
  /** Non-item content, such as group labels: the pointer over it highlights nothing, where a gap takes the nearest item. */
  ignore?: string
}

/** The highlight store shared by the highlight composables on `container`, with its state as refs. */
export const useHighlightStore = /* @__PURE__ */ highlightStoreComposable(createHighlightStore)

/**
 * Highlights the item under the pointer or, in gaps and padding, the nearest one.
 * Items carry `data-highlight-item` (and `data-index` when virtualized); disabled items are skipped.
 * Pass the same container ref to useArrowNavigation and useHighlightIndicator to combine them.
 */
export function useProximityHover(container: Readonly<Ref<HTMLElement | null>>, options: ProximityHoverOptions = {}): HighlightState & Remeasure {
  const { axis, resumeDistance, gapClick, ignore } = options
  const { store, highlighted, source } = sharedHighlight(container, createHighlightStore)
  const instance = latestInstance<ReturnType<typeof createProximityHover>>()
  watchElement(container, el => instance.track(createProximityHover(el, {
    axis,
    resumeDistance: () => toValue(resumeDistance),
    gapClick: () => toValue(gapClick),
    ignore,
    store,
  })))
  return { highlighted, source, remeasure: () => instance.get()?.remeasure() }
}
