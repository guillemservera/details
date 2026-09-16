import { toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { createMorphText } from '@guillemservera/details-core/morph-text'
import { motionGetters, useTextMotion, type TextMotionOptions } from '../shared/textMotion'

export interface MorphTextOptions extends Pick<TextMotionOptions, 'duration' | 'animated'> {
  /** Maximum blur in em. Default 0.2; zero keeps a sharp crossfade, negative or non-finite values use the default. */
  blur?: MaybeRefOrGetter<number>
}

/** Morphs whole phrases through blur and crossfade. */
export function useMorphText(
  source: Readonly<Ref<HTMLElement | null>>,
  viewport: Readonly<Ref<HTMLElement | null>>,
  options: MorphTextOptions = {},
): void {
  useTextMotion(source, viewport, options, (text, view) => createMorphText(text, view, {
    ...motionGetters(options),
    blur: () => toValue(options.blur),
  }))
}
