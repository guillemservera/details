import { afterEach, describe, expect, it, vi } from 'vitest'

import { createInputCapabilities } from '../../src/input-capabilities'

function installMedia(initial: Record<string, boolean>, maxTouchPoints: number) {
  const state = { ...initial }
  const listeners = new Set<() => void>()
  vi.stubGlobal('navigator', { maxTouchPoints })
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return state[query] ?? false
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  return {
    listeners,
    set(query: string, matches: boolean) {
      state[query] = matches
      for (const listener of [...listeners]) listener()
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createInputCapabilities', () => {
  it('distinguishes touch-first input from a touch-capable hybrid', () => {
    installMedia({ '(pointer: coarse)': true }, 5)
    expect(createInputCapabilities().getSnapshot()).toEqual({
      canHover: false,
      hasFinePointer: false,
      primaryPointerIsCoarse: true,
      hasTouch: true,
      isTouchFirst: true,
    })

    vi.unstubAllGlobals()
    installMedia({ '(any-pointer: fine)': true, '(any-hover: hover)': true }, 5)
    expect(createInputCapabilities().getSnapshot()).toEqual({
      canHover: true,
      hasFinePointer: true,
      primaryPointerIsCoarse: false,
      hasTouch: true,
      isTouchFirst: false,
    })
  })

  it('returns a stable server snapshot without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const store = createInputCapabilities()
    expect(store.getSnapshot()).toBe(store.getServerSnapshot())
    expect(Object.values(store.getSnapshot()).every(value => value === false)).toBe(true)
    expect(() => store.subscribe(() => {})()).not.toThrow()
  })

  it('keeps the snapshot identity until a value changes', () => {
    installMedia({ '(any-hover: hover)': true }, 0)
    const store = createInputCapabilities()
    expect(store.getSnapshot()).toBe(store.getSnapshot())
  })

  it('notifies subscribers when a media query changes', () => {
    const media = installMedia({ '(pointer: coarse)': true }, 5)
    const store = createInputCapabilities()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const before = store.getSnapshot()
    expect(before.isTouchFirst).toBe(true)

    // Docking a mouse on a tablet.
    media.set('(any-hover: hover)', true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).not.toBe(before)
    expect(store.getSnapshot()).toMatchObject({ canHover: true, isTouchFirst: false })

    // A change event that leaves every value the same does not notify.
    media.set('(any-hover: hover)', true)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('attaches media listeners once and removes them with the last subscriber', () => {
    const media = installMedia({}, 0)
    const store = createInputCapabilities()
    const listener = vi.fn()

    const first = store.subscribe(listener)
    const second = store.subscribe(listener)
    expect(media.listeners.size).toBe(1)

    first()
    first()
    expect(media.listeners.size).toBe(1)
    media.set('(any-pointer: fine)', true)
    expect(listener).toHaveBeenCalledTimes(1)

    second()
    expect(media.listeners.size).toBe(0)
  })
})
