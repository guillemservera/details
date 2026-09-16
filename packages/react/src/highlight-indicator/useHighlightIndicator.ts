import {
  createHighlightIndicator,
  createHighlightStore,
  type HighlightIndicatorOptions as CoreOptions,
} from '@guillemservera/details-core/highlight-indicator'
import { useElements, type ElementRef } from '../shared/elements'
import { sharedStore } from '../shared/highlight'

/** Changing an option re-creates the indicator. */
export type HighlightIndicatorOptions = Omit<CoreOptions, 'store'>

/**
 * Springs an indicator onto the item matching `target`, whoever marks it: pointer, keyboard, React state or a headless menu.
 * The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`.
 * Transform, size and opacity are written directly, with no renders per frame.
 */
export function useHighlightIndicator(container: ElementRef, indicator: ElementRef, options: HighlightIndicatorOptions = {}): void {
  const { target, from, motion } = options
  const store = sharedStore(container, createHighlightStore)
  useElements([container, indicator], [target, from, motion], null, ([el, ind]) =>
    createHighlightIndicator(el, ind, { target, from, motion, store }))
}
