import { createMorphText } from '@guillemservera/details-core/morph-text'
import { useElements, type ElementRef } from '../shared/elements'
import { motionGetters, type TextMotionOptions } from '../shared/textMotion'

export interface MorphTextOptions extends Pick<TextMotionOptions, 'duration' | 'animated'> {
  /** Maximum blur in em. Default 0.2; zero keeps a sharp crossfade, negative or non-finite values use the default. */
  blur?: number
}

/** Morphs whole phrases through blur and crossfade, with the markup of useRollingText. */
export function useMorphText(source: ElementRef, viewport: ElementRef, options: MorphTextOptions = {}): void {
  useElements([source, viewport], [], options, ([text, view], latest) => {
    const { duration, animated } = motionGetters(latest)
    return createMorphText(text, view, { duration, animated, blur: () => latest().blur })
  })
}
