import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createArrowNavigation } from '../../src/arrow-navigation/createArrowNavigation'
import { createProximityHover } from '../../src/proximity-hover/createProximityHover'
import { createHighlightStore } from '../../src/shared/highlight'
import { append, cleanup, frames, h, highlighted, item, parkPointer, track } from './helpers'

afterEach(cleanup)

describe('createProximityHover', () => {
  it('shares the container store by default and keeps pointer ownership until the last instance is destroyed', () => {
    const el = append(h('div', {}, [item('A')]))
    const first = createProximityHover(el)
    const second = track(createProximityHover(el))
    expect(second.store).toBe(first.store)
    expect(track(createProximityHover(append(h('div')), { store: createHighlightStore() })).store).not.toBe(first.store)
    first.destroy()
    expect(second.store.pointerClaimed()).toBe(true)
    second.destroy()
    expect(second.store.pointerClaimed()).toBe(false)
  })

  it('treats a repeated destroy as a no-op, so it cannot release another instance', async () => {
    const el = append(h('div', {}, [item('A'), item('B')]))
    const first = createProximityHover(el)
    const second = track(createProximityHover(el))
    first.destroy()
    first.destroy()
    expect(second.store.pointerClaimed()).toBe(true)
    await userEvent.hover(el.querySelectorAll('button')[1]!)
    await frames()
    expect(highlighted(el)).toBe('B')
  })

  it('stops picking an item once it becomes disabled', async () => {
    const el = append(h('div', {}, [item('A'), item('B'), item('C')]))
    track(createProximityHover(el))
    const [, b, c] = el.querySelectorAll('button')
    await userEvent.hover(b!)
    await frames()
    expect(highlighted(el)).toBe('B')

    b!.setAttribute('aria-disabled', 'true')
    await frames()
    expect(highlighted(el)).not.toBe('B')
    await userEvent.hover(c!)
    await userEvent.hover(b!)
    await frames()
    expect(highlighted(el)).not.toBe('B')
  })

  it('ignores touch, so taps and swipes never leave a highlight behind', async () => {
    await parkPointer()
    const el = append(h('div', { tabindex: '0' }, [item('A'), item('B')]))
    track(createProximityHover(el))
    track(createArrowNavigation(el))
    const target = el.querySelectorAll('button')[1]!
    const box = target.getBoundingClientRect()
    const touch = { pointerType: 'touch', bubbles: true, clientX: box.left + 5, clientY: box.top + 5 }
    expect(highlighted(el)).toBeNull()
    for (const type of ['pointerenter', 'pointerdown', 'pointermove', 'pointerup']) target.dispatchEvent(new PointerEvent(type, touch))
    await frames()
    expect(highlighted(el)).toBeNull()
  })

  it('measures a large list once on the first hover', async () => {
    const el = append(h('div', { style: 'height: 300px; overflow: auto' }, Array.from({ length: 1000 }, (_, i) => item(String(i)))))
    track(createProximityHover(el))
    const original = Element.prototype.getBoundingClientRect
    let reads = 0
    Element.prototype.getBoundingClientRect = function () {
      reads++
      return original.call(this)
    }
    try {
      await userEvent.hover(el.querySelector('button')!)
      await frames(6)
    }
    finally {
      Element.prototype.getBoundingClientRect = original
    }
    expect(highlighted(el)).toBe('0')
    expect(reads).toBeLessThan(1100)
  })
})
