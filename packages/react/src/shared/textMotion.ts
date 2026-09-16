export interface TextMotionOptions {
  /** Milliseconds per transition. Default 600; zero applies changes instantly. */
  duration?: number
  /** Direction the outgoing text travels. Default 'up'. */
  direction?: 'up' | 'down'
  /** Default true. Reduced motion is always respected. */
  animated?: boolean
}

/** Core getters for the shared options, read from the latest render. */
export function motionGetters(options: () => TextMotionOptions) {
  return {
    duration: () => options().duration,
    direction: () => options().direction,
    animated: () => options().animated,
  }
}
