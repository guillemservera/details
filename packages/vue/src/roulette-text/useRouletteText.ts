import { toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { createRouletteText } from '@guillemservera/details-core/roulette-text'
import { motionGetters, useTextMotion, type TextMotionOptions } from '../shared/textMotion'

export interface RouletteTextOptions extends TextMotionOptions {
  /** Intermediate glyphs. Defaults to `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`; targets need not be in it. */
  alphabet?: MaybeRefOrGetter<string>
  /** Peak blur in em while a slot rolls. Default 0 (sharp); negative or non-finite values use the default. */
  blur?: MaybeRefOrGetter<number>
  /** Window-edge fade, from 0 (none, the default) to 1 (edges fade to the center). */
  fade?: MaybeRefOrGetter<number>
}

/** Rolls grapheme-sized slots in an empty, aria-hidden sibling of a Vue-owned plain-text source. */
export function useRouletteText(
  source: Readonly<Ref<HTMLElement | null>>,
  viewport: Readonly<Ref<HTMLElement | null>>,
  options: RouletteTextOptions = {},
): void {
  useTextMotion(source, viewport, options, (text, view) => createRouletteText(text, view, {
    ...motionGetters(options),
    alphabet: () => toValue(options.alphabet),
    blur: () => toValue(options.blur),
    fade: () => toValue(options.fade),
  }))
}
