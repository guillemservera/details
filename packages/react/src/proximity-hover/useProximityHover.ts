import { createHighlightStore, createProximityHover, type HighlightAxis } from '@guillemservera/details-core/proximity-hover'
import { useElements, type ElementRef } from '../shared/elements'
import { highlightStoreHook, sharedStore, useHighlightState, useRemeasure, type HighlightState, type Remeasure } from '../shared/highlight'

export interface ProximityHoverOptions {
  /** Axis the nearest item is measured along: `y` for lists, `x` for strips, `xy` for grids and wrapping rows. Changing it re-creates the behavior. */
  axis?: HighlightAxis
  /** Pixels the mouse must travel before it takes the highlight back from the keyboard. Default 6. */
  resumeDistance?: number
  /** A click in a gap between items clicks the highlighted item. Default true. */
  gapClick?: boolean
  /**
   * Non-item content, such as group labels: the pointer over it highlights nothing, where a gap takes the nearest
   * item. Changing it re-creates the behavior.
   */
  ignore?: string
}

/** The highlight store shared by the highlight hooks on `container`, with its state. */
export const useHighlightStore = /* @__PURE__ */ highlightStoreHook(createHighlightStore)

/**
 * Highlights the item under the pointer or, in gaps and padding, the nearest one.
 * Items carry `data-highlight-item` (and `data-index` when virtualized); disabled items are skipped.
 * Pass the same container ref to useArrowNavigation and useHighlightIndicator to combine them.
 */
export function useProximityHover(container: ElementRef, options: ProximityHoverOptions = {}): HighlightState & Remeasure {
  const store = sharedStore(container, createHighlightStore)
  const current = useElements([container], [options.axis, options.ignore], options, ([el], latest) => createProximityHover(el, {
    axis: options.axis,
    resumeDistance: () => latest().resumeDistance,
    gapClick: () => latest().gapClick,
    ignore: options.ignore,
    store,
  }))
  const { remeasure } = useRemeasure(current)
  return { ...useHighlightState(store), remeasure }
}
