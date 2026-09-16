import { watch, type Ref } from 'vue'
import {
  createHighlightIndicator,
  createHighlightStore,
  type HighlightIndicatorOptions as CoreOptions,
} from '@guillemservera/details-core/highlight-indicator'
import { useHighlightStore } from '../shared/highlight'

export type HighlightIndicatorOptions = Omit<CoreOptions, 'store'>

/**
 * Springs an indicator onto the item matching `target`, whoever marks it: pointer, keyboard, v-model or a headless menu.
 * The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`.
 * Transform, size and opacity are written directly, with no component renders per frame.
 */
export function useHighlightIndicator(
  container: Readonly<Ref<HTMLElement | null>>,
  indicator: Readonly<Ref<HTMLElement | null>>,
  options: HighlightIndicatorOptions = {},
): void {
  const { store } = useHighlightStore(container, createHighlightStore)
  watch([container, indicator], ([el, ind], _, onCleanup) => {
    if (el && ind) onCleanup(createHighlightIndicator(el, ind, { ...options, store }).destroy)
  }, { immediate: true, flush: 'post' })
}
