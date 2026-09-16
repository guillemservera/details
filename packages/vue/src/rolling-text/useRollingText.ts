import type { Ref } from 'vue'
import { createRollingText } from '@guillemservera/details-core/rolling-text'
import { motionGetters, useTextMotion, type TextMotionOptions } from '../shared/textMotion'

export type RollingTextOptions = TextMotionOptions

/** Rolls complete words or phrases as single rows. */
export function useRollingText(
  source: Readonly<Ref<HTMLElement | null>>,
  viewport: Readonly<Ref<HTMLElement | null>>,
  options: RollingTextOptions = {},
): void {
  useTextMotion(source, viewport, options, (text, view) => createRollingText(text, view, motionGetters(options)))
}
