import { useRef } from 'react'
import {
  createHighlightIndicator,
  createHighlightStore,
  type HighlightIndicatorOptions as CoreOptions,
} from '@guillemservera/details-core/highlight-indicator'
import { useElements, type ElementRef } from '../shared/elements'
import { highlightStoreHook, sharedStore, type Remeasure } from '../shared/highlight'

/** Changing an option re-creates the indicator, except `reducedMotion`, which is read on every update. */
export interface HighlightIndicatorOptions extends Omit<CoreOptions, 'store' | 'reducedMotion'> {
  /** Jump instead of gliding; fades still run. Default: `prefers-reduced-motion: reduce`. */
  reducedMotion?: boolean
}

export interface HighlightIndicatorControls extends Remeasure {
  /** Stops observing and animating while keeping the indicator's rendered paint. */
  freeze: () => void
}

/** The highlight store shared by the highlight hooks on `container`, with its state. */
export const useHighlightStore = /* @__PURE__ */ highlightStoreHook(createHighlightStore)

/**
 * Springs an indicator onto the item matching `target`, whoever marks it: pointer, keyboard, React state or a headless menu.
 * The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`.
 * Transform, size and opacity are written directly, with no renders per frame.
 */
export function useHighlightIndicator(container: ElementRef, indicator: ElementRef, options: HighlightIndicatorOptions = {}): HighlightIndicatorControls {
  const { target, from, motion } = options
  const store = sharedStore(container, createHighlightStore)
  const current = useElements([container, indicator], [target, from, motion], options, ([el, ind], latest) =>
    createHighlightIndicator(el, ind, { target, from, motion, store, reducedMotion: () => latest().reducedMotion }))
  return useRef<HighlightIndicatorControls>({
    remeasure: () => current()?.remeasure(),
    freeze: () => current()?.freeze(),
  }).current
}
