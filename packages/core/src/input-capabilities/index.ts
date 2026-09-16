export interface InputCapabilities {
  /** `(any-hover: hover)`: some available pointer can hover. */
  canHover: boolean
  /** `(any-pointer: fine)`: some available pointer is precise. */
  hasFinePointer: boolean
  /** `(pointer: coarse)`: the primary pointer is a finger or a stylus. */
  primaryPointerIsCoarse: boolean
  /** `navigator.maxTouchPoints > 0`. */
  hasTouch: boolean
  /** Coarse primary pointer and no hover: hover-only affordances are unreachable. */
  isTouchFirst: boolean
}

export interface InputCapabilitiesStore {
  /** Current capabilities. The object identity only changes when a value does. */
  getSnapshot: () => InputCapabilities
  /** All `false`; what the server renders and hydration starts from. */
  getServerSnapshot: () => InputCapabilities
  /**
   * Calls `listener` whenever a capability changes. Media query listeners are attached
   * on the first subscription and removed with the last one.
   */
  subscribe: (listener: () => void) => () => void
}

const QUERIES = ['(any-hover: hover)', '(any-pointer: fine)', '(pointer: coarse)']

const SERVER_SNAPSHOT: InputCapabilities = Object.freeze({
  canHover: false,
  hasFinePointer: false,
  primaryPointerIsCoarse: false,
  hasTouch: false,
  isTouchFirst: false,
})

export function createInputCapabilities(): InputCapabilitiesStore {
  const listeners = new Set<() => void>()
  let lists: MediaQueryList[] = []
  let snapshot = SERVER_SNAPSHOT

  function refresh(): boolean {
    if (typeof matchMedia === 'undefined') return false
    const [canHover, hasFinePointer, primaryPointerIsCoarse] = QUERIES.map(query => matchMedia(query).matches) as [boolean, boolean, boolean]
    const next: InputCapabilities = {
      canHover,
      hasFinePointer,
      primaryPointerIsCoarse,
      hasTouch: typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0,
      isTouchFirst: primaryPointerIsCoarse && !canHover,
    }
    if ((Object.keys(next) as (keyof InputCapabilities)[]).every(key => next[key] === snapshot[key])) return false
    snapshot = next
    return true
  }

  function onChange(): void {
    if (refresh()) for (const listener of listeners) listener()
  }

  return {
    getSnapshot() {
      // Without subscribers nothing keeps the snapshot current, so read it on demand.
      if (!lists.length) refresh()
      return snapshot
    },
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe(listener) {
      // Wrapped so subscribing the same function twice yields two independent subscriptions.
      const entry = () => listener()
      if (!listeners.size && typeof matchMedia !== 'undefined') {
        lists = QUERIES.map(query => matchMedia(query))
        for (const list of lists) list.addEventListener('change', onChange)
        refresh()
      }
      listeners.add(entry)
      return () => {
        if (!listeners.delete(entry) || listeners.size) return
        for (const list of lists) list.removeEventListener('change', onChange)
        lists = []
      }
    },
  }
}
