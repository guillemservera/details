import { toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { createHighlightStore, createProximityHover, type HighlightAxis } from '@guillemservera/details-core/proximity-hover'
import { useHighlightStore, watchElement, type HighlightState } from '../shared/highlight'

export interface ProximityHoverOptions {
  /** Axis the nearest item is measured along: `y` for lists, `x` for strips, `xy` for grids and wrapping rows. */
  axis?: HighlightAxis
  /** Pixels the mouse must travel before it takes the highlight back from the keyboard. */
  resumeDistance?: MaybeRefOrGetter<number>
  /** A click in a gap between items clicks the highlighted item. */
  gapClick?: MaybeRefOrGetter<boolean>
}

/**
 * Highlights the item under the pointer or, in gaps and padding, the nearest one.
 * Items carry `data-highlight-item` (and `data-index` when virtualized); disabled items are skipped.
 * Pass the same container ref to useArrowNavigation and useHighlightIndicator to combine them.
 */
export function useProximityHover(container: Readonly<Ref<HTMLElement | null>>, options: ProximityHoverOptions = {}): HighlightState {
  const { axis, resumeDistance, gapClick } = options
  const { store, highlighted, source } = useHighlightStore(container, createHighlightStore)
  watchElement(container, el => createProximityHover(el, {
    axis,
    resumeDistance: () => toValue(resumeDistance),
    gapClick: () => toValue(gapClick),
    store,
  }).destroy)
  return { highlighted, source }
}
