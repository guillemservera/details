import { toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { TextMotion } from '@guillemservera/details-core/rolling-text'

export interface TextMotionOptions {
  /** Milliseconds per transition. Default 600; zero applies changes instantly. */
  duration?: MaybeRefOrGetter<number>
  /** Direction the outgoing text travels. Default 'up'. */
  direction?: MaybeRefOrGetter<'up' | 'down'>
  /** Default true. Reduced motion is always respected. */
  animated?: MaybeRefOrGetter<boolean>
}

/** Core getters for the shared options, read through `options` so reactive objects can gain keys later. */
export function motionGetters(options: TextMotionOptions) {
  return {
    duration: () => toValue(options.duration),
    direction: () => toValue(options.direction),
    animated: () => toValue(options.animated),
  }
}

/**
 * The source stays Vue-owned and accessible; the empty sibling viewport belongs to the renderer.
 * Their parent must be position:relative and inline-block. No DOM work runs during SSR.
 */
export function useTextMotion(
  source: Readonly<Ref<HTMLElement | null>>,
  viewport: Readonly<Ref<HTMLElement | null>>,
  options: object,
  create: (source: HTMLElement, viewport: HTMLElement) => TextMotion,
) {
  watch([source, viewport], ([text, view], _, onCleanup) => {
    if (!text || !view) return
    const motion = create(text, view)
    // Tracks every option, including keys added to a reactive object later; the core ignores unchanged values.
    const stopOptions = watch(() => Object.values(options).map(value => toValue(value)), () => motion.update(), { flush: 'post' })
    onCleanup(() => {
      stopOptions()
      motion.destroy()
    })
  }, { immediate: true, flush: 'post' })
}
