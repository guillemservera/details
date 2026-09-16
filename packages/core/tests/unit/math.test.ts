import { describe, expect, it } from 'vitest'
import { nextIndex } from '../../src/arrow-navigation/createArrowNavigation'
import { stepSpring } from '../../src/highlight-indicator/createHighlightIndicator'
import { nearestIndex } from '../../src/proximity-hover/createProximityHover'

describe('nearestIndex', () => {
  // Three 40px rows with a gap between the second and the third.
  const rows = [0, 0, 100, 40, 0, 40, 100, 40, 0, 120, 100, 40]

  it('picks the item under the point, otherwise the nearest center', () => {
    expect(nearestIndex(rows, 50, 10, 'y')).toBe(0)
    expect(nearestIndex(rows, 999, 95, 'y')).toBe(1)
    expect(nearestIndex(rows, 50, 500, 'y')).toBe(2)
    expect(nearestIndex([], 0, 0, 'y')).toBe(-1)
    expect(nearestIndex([0, 0, 10, 10, 100, 0, 10, 10], 80, 0, 'x')).toBe(1)
    expect(nearestIndex([0, 0, 10, 10, 100, 100, 10, 10], 90, 20, 'xy')).toBe(0)
  })

  it('prefers the item under the point over a closer center', () => {
    expect(nearestIndex([0, 0, 100, 100, 100, 40, 10, 10], 95, 45, 'x')).toBe(0)
  })

  it('never picks a sliver at a scroll edge', () => {
    // The second row shows 4px of 40 inside a 50px view.
    const edge = [0, 0, 100, 40, 0, 46, 100, 40]
    const view = [0, 0, 100, 50]
    expect(nearestIndex(edge, 50, 45, 'y')).toBe(1)
    expect(nearestIndex(edge, 50, 45, 'y', view)).toBe(0)
    expect(nearestIndex(edge, 50, 48, 'y', view)).toBe(1)
    expect(nearestIndex(edge, 50, 45, 'y', [0, 0, 100, 20])).toBe(0)
    expect(nearestIndex([0, 200, 100, 40], 50, 10, 'y', view)).toBe(-1)
  })
})

describe('nextIndex', () => {
  it('steps, clamps and loops', () => {
    expect(nextIndex(-1, 5, 1, false)).toBe(0)
    expect(nextIndex(-1, 5, -1, false)).toBe(4)
    expect(nextIndex(4, 5, 1, false)).toBe(4)
    expect(nextIndex(4, 5, 1, true)).toBe(0)
    expect(nextIndex(0, 5, -1, true)).toBe(4)
    expect(nextIndex(2, 5, 'first', false)).toBe(0)
    expect(nextIndex(2, 5, 'last', false)).toBe(4)
    expect(nextIndex(0, 0, 1, true)).toBe(-1)
  })
})

describe('stepSpring', () => {
  it('settles within a few frames without overshooting', () => {
    const pos = new Float64Array(4)
    const vel = new Float64Array(4)
    const target = Float64Array.of(0, 120, 100, 40)
    let frames = 0
    while (!stepSpring(pos, vel, target, 0.1, 1 / 60)) {
      expect(pos[1]).toBeLessThanOrEqual(120)
      expect(++frames).toBeLessThan(12)
    }
    expect([...pos]).toEqual([...target])
  })

  it('is exact at any frame time', () => {
    const a = Float64Array.of(0)
    const av = Float64Array.of(0)
    const b = Float64Array.of(0)
    const bv = Float64Array.of(0)
    const target = Float64Array.of(300)
    stepSpring(a, av, target, 0.5, 0.1)
    for (let i = 0; i < 6; i++) stepSpring(b, bv, target, 0.5, 0.1 / 6)
    expect(a[0]).toBeCloseTo(b[0]!, 9)
  })
})
