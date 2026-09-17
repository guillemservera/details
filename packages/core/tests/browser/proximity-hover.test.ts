import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createArrowNavigation } from '../../src/arrow-navigation/createArrowNavigation'
import { createProximityHover } from '../../src/proximity-hover/createProximityHover'
import { createHighlightStore } from '../../src/shared/highlight'
import { append, cleanup, frames, h, highlighted, item, parkPointer, track, wait } from './helpers'

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

  it('highlights the item under the pointer in the event itself, like native :hover', async () => {
    await parkPointer()
    const el = append(h('div', { style: 'padding: 20px 0' }, [item('A'), item('B'), item('C')]))
    track(createProximityHover(el))
    const [a, , c] = el.querySelectorAll('button')
    const at = (target: Element, type: string) => {
      const box = target.getBoundingClientRect()
      target.dispatchEvent(new PointerEvent(type, { bubbles: type !== 'pointerenter', pointerType: 'mouse', clientX: box.left + 5, clientY: box.top + 5 }))
    }
    el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 0, clientY: 0 }))
    at(c!, 'pointermove')
    expect(highlighted(el)).toBe('C')
    at(a!, 'pointermove')
    expect(highlighted(el)).toBe('A')
    // A pick queued for the earlier position does not override it.
    await frames()
    expect(highlighted(el)).toBe('A')
    // Padding still takes the nearest item, a frame later.
    const box = el.getBoundingClientRect()
    el.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: box.left + 5, clientY: box.bottom - 5 }))
    await frames()
    expect(highlighted(el)).toBe('C')
  })

  it('follows rows resizing under a stationary pointer after a direct hover', async () => {
    await parkPointer()
    const a = item('A')
    const b = item('B')
    const el = append(h('div', { style: 'height: 300px; width: 200px' }, [a, b]))
    track(createProximityHover(el))
    await userEvent.hover(b)
    await frames()
    expect(highlighted(el)).toBe('B')

    a.style.height = '100px'
    await frames()
    expect(highlighted(el)).toBe('A')
  })

  it('keeps the keyboard highlight until the pointer travels, even over another item', async () => {
    await parkPointer()
    const el = append(h('div', { tabindex: '0' }, [item('A'), item('B'), item('C')]))
    track(createProximityHover(el, { resumeDistance: 20 }))
    track(createArrowNavigation(el))
    const [, b, c] = el.querySelectorAll('button')
    const move = (target: Element, dy: number) => {
      const box = target.getBoundingClientRect()
      target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: box.left + 5, clientY: box.top + dy }))
    }
    el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    move(b!, 35)
    expect(highlighted(el)).toBe('B')
    el.focus()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(highlighted(el)).toBe('C')
    // 10px further, onto B's edge: still the keyboard's.
    move(b!, 38)
    await frames()
    expect(highlighted(el)).toBe('C')
    move(b!, 10)
    expect(highlighted(el)).toBe('B')
  })

  it('highlights nothing over ignored content, and the nearest item in real gaps', async () => {
    await parkPointer()
    const heading = h('div', { style: 'height: 30px' }, ['Group'])
    const el = append(h('div', { style: 'padding-bottom: 30px' }, [heading, item('A'), item('B')]))
    track(createProximityHover(el, { ignore: 'div:not([data-highlight-item])' }))
    const [a] = el.querySelectorAll('button')
    el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    const box = a!.getBoundingClientRect()
    a!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: box.left + 5, clientY: box.top + 5 }))
    expect(highlighted(el)).toBe('A')
    const headingBox = heading.getBoundingClientRect()
    heading.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: headingBox.left + 5, clientY: headingBox.top + 5 }))
    expect(highlighted(el)).toBeNull()
    await frames()
    expect(highlighted(el)).toBeNull()
    const outer = el.getBoundingClientRect()
    el.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: outer.left + 5, clientY: outer.bottom - 5 }))
    await frames()
    expect(highlighted(el)).toBe('B')
  })

  it('measures again on remeasure() and after an ancestor animation ends', async () => {
    const el = h('div', {}, [item('A'), item('B')])
    // Items without a hit target: geometry decides.
    for (const button of el.querySelectorAll('button')) button.style.pointerEvents = 'none'
    const zoom = append(h('div', { style: 'transform-origin: 0 0' }, [el]))
    const behavior = track(createProximityHover(el))
    const at = (y: number) => {
      const box = el.getBoundingClientRect()
      el.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: box.left + 5, clientY: box.top + y }))
    }
    el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    at(10)
    await frames()
    expect(highlighted(el)).toBe('A')
    // Rects measured at scale 1 put 60px into the second row; at scale 2 it is inside the first one.
    zoom.style.transform = 'scale(2)'
    at(60)
    await frames()
    expect(highlighted(el)).toBe('B')
    behavior.remeasure()
    await frames()
    expect(highlighted(el)).toBe('A')

    zoom.style.transform = 'none'
    behavior.remeasure()
    at(10)
    await frames()
    zoom.style.transform = 'scale(2)'
    at(60)
    await frames()
    expect(highlighted(el)).toBe('B')
    // An enter zoom ends: nothing else reports it.
    zoom.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }))
    await frames()
    expect(highlighted(el)).toBe('A')
  })
})
