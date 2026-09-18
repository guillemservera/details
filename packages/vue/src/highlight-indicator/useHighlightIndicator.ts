import { toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import {
  createHighlightIndicator,
  createHighlightStore,
  type HighlightIndicator,
  type HighlightIndicatorOptions as CoreOptions,
} from '@guillemservera/details-core/highlight-indicator'
import { highlightStoreComposable, latestInstance, sharedHighlight, type Remeasure } from '../shared/highlight'

export interface HighlightIndicatorOptions extends Omit<CoreOptions, 'store' | 'reducedMotion'> {
  /** Jump instead of gliding; fades still run. Read on every update. Default: `prefers-reduced-motion: reduce`. */
  reducedMotion?: MaybeRefOrGetter<boolean | undefined>
}

export interface HighlightIndicatorControls extends Remeasure {
  /** Stops observing and animating while keeping the indicator's rendered paint. */
  freeze: () => void
}

/** The highlight store shared by the highlight composables on `container`, with its state as refs. */
export const useHighlightStore = /* @__PURE__ */ highlightStoreComposable(createHighlightStore)

/**
 * Springs an indicator onto the item matching `target`, whoever marks it: pointer, keyboard, v-model or a headless menu.
 * The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`.
 * Transform, size and opacity are written directly, with no component renders per frame.
 */
export function useHighlightIndicator(
  container: Readonly<Ref<HTMLElement | null>>,
  indicator: Readonly<Ref<HTMLElement | null>>,
  options: HighlightIndicatorOptions = {},
): HighlightIndicatorControls {
  const { store } = sharedHighlight(container, createHighlightStore)
  const { reducedMotion } = options
  const instance = latestInstance<HighlightIndicator>()
  watch([container, indicator], ([el, ind], _, onCleanup) => {
    if (el && ind) {
      onCleanup(instance.track(createHighlightIndicator(el, ind, {
        ...options,
        reducedMotion: reducedMotion === undefined ? undefined : () => toValue(reducedMotion),
        store,
      })))
    }
  }, { immediate: true, flush: 'post' })
  return {
    remeasure: () => instance.get()?.remeasure(),
    freeze: () => instance.get()?.freeze(),
  }
}
