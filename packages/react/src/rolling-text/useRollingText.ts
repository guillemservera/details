import { createRollingText } from '@guillemservera/details-core/rolling-text'
import { useElements, type ElementRef } from '../shared/elements'
import { motionGetters, type TextMotionOptions } from '../shared/textMotion'

export type RollingTextOptions = TextMotionOptions

/**
 * Rolls complete words or phrases as single rows. The source stays React-owned and accessible; the empty sibling
 * viewport belongs to the effect. Their parent must be position:relative and inline-block.
 */
export function useRollingText(source: ElementRef, viewport: ElementRef, options: RollingTextOptions = {}): void {
  useElements([source, viewport], [], options, ([text, view], latest) => createRollingText(text, view, motionGetters(latest)))
}
