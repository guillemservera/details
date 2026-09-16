import { createRouletteText } from '@guillemservera/details-core/roulette-text'
import { useElements, type ElementRef } from '../shared/elements'
import { motionGetters, type TextMotionOptions } from '../shared/textMotion'

export interface RouletteTextOptions extends TextMotionOptions {
  /** Intermediate glyphs. Defaults to `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`; targets need not be in it. */
  alphabet?: string
  /** Peak blur in em while a slot rolls. Default 0 (sharp); negative or non-finite values use the default. */
  blur?: number
  /** Window-edge fade, from 0 (none, the default) to 1 (edges fade to the center). */
  fade?: number
}

/** Rolls grapheme-sized slots, with the markup of useRollingText. */
export function useRouletteText(source: ElementRef, viewport: ElementRef, options: RouletteTextOptions = {}): void {
  useElements([source, viewport], [], options, ([text, view], latest) => createRouletteText(text, view, {
    ...motionGetters(latest),
    alphabet: () => latest().alphabet,
    blur: () => latest().blur,
    fade: () => latest().fade,
  }))
}
