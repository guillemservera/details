import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createArrowNavigation } from '../../src/arrow-navigation/createArrowNavigation'
import { createHighlightIndicator } from '../../src/highlight-indicator/createHighlightIndicator'
import { createProximityHover } from '../../src/proximity-hover/createProximityHover'
import { createHighlightStore } from '../../src/shared/highlight'
import { append, beforePaint, cleanup, frames, h, item, track, wait } from './helpers'

afterEach(cleanup)

function setup(children: Node[], style = 'position: relative') {
  const indicator = h('div', { style: 'position: absolute; top: 0; left: 0' })
  const el = append(h('div', { style }, [indicator, ...children]))
  return { el, indicator }
}

function offsetOf(a: Element, b: Element) {
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  return Math.abs(ra.top - rb.top) + Math.abs(ra.height - rb.height)
}

const button = (label: string, active: boolean) => h('button', { 'data-active': String(active), 'style': 'display: block; height: 40px' }, [label])

const top = (el: Element) => el.getBoundingClientRect().top

/** Hides `Element.animate` from `indicator` for the `raf` case, so it takes the per-frame fallback. */
const withEngine = (indicator: HTMLElement, engine: 'waapi' | 'raf') => {
  if (engine === 'raf') Object.defineProperty(indicator, 'animate', { value: undefined, configurable: true })
  return indicator
}

describe('createHighlightIndicator', () => {
  it('follows any target selector', async () => {
    const [a, b] = [button('A', true), button('B', false)]
    const { el, indicator } = setup([a, b])
    track(createHighlightIndicator(el, indicator, { target: '[data-active="true"]', motion: 'fast' }))
    await wait(200)
    a.dataset.active = 'false'
    b.dataset.active = 'true'
    await wait(250)
    expect(offsetOf(indicator, b)).toBeLessThan(1)
  })

  it('stays on the highlighted item in the same frame while content scrolls under the pointer', async () => {
    const { el, indicator } = setup(Array.from({ length: 30 }, (_, i) => item(String(i))), 'position: relative; height: 200px; overflow: auto')
    track(createProximityHover(el))
    track(createHighlightIndicator(el, indicator))
    await userEvent.hover(el.querySelectorAll('button')[2]!)
    await wait(200)
    for (let step = 0; step < 5; step++) {
      el.scrollTop += 90
      await beforePaint()
      expect(offsetOf(indicator, el.querySelector('[data-highlighted]')!)).toBeLessThan(1)
    }
  })

  it('follows its target when layout moves it without resizing it', async () => {
    const spacer = h('div', { style: 'height: 20px' })
    const target = button('A', true)
    const { el, indicator } = setup([spacer, target])
    track(createHighlightIndicator(el, indicator, { target: '[data-active="true"]', motion: 'fast' }))
    await wait(200)
    spacer.style.height = '70px'
    await wait(250)
    expect(offsetOf(indicator, target)).toBeLessThan(1)
  })
  it('restores owned styles when a retained indicator node is reused', async () => {
    const target = button('A', true)
    const { el, indicator } = setup([target])
    indicator.style.opacity = '0.25'
    indicator.style.transform = 'scale(2)'
    indicator.style.width = '7px'
    indicator.style.height = '8px'

    const first = createHighlightIndicator(el, indicator, { target: '[data-active="true"]', motion: 'fast' })
    await wait(200)
    indicator.style.backgroundColor = 'red'
    first.destroy()

    expect(indicator.style.opacity).toBe('0.25')
    expect(indicator.style.transform).toBe('scale(2)')
    expect(indicator.style.width).toBe('7px')
    expect(indicator.style.height).toBe('8px')
    expect(indicator.style.backgroundColor).toBe('red')

    track(createHighlightIndicator(el, indicator, { target: '[data-active="true"]', motion: 'fast' }))
    await wait(200)
    expect(offsetOf(indicator, target)).toBeLessThan(1)
  })
  it.each(['waapi', 'raf'] as const)('collapses its hidden box without scroll overflow (%s)', async (engine) => {
    const target = button('A', true)
    const { el, indicator } = setup([target], 'position: relative; height: 40px; overflow: auto')
    track(createHighlightIndicator(el, withEngine(indicator, engine), { target: '[data-active="true"]', motion: 'fast' }))
    await wait(200)
    expect(indicator.style.height).toBe('40px')

    target.dataset.active = 'false'
    await wait(20)
    expect(indicator.style.height).toBe('40px')
    await wait(200)
    expect(getComputedStyle(indicator).opacity).toBe('0')
    expect(indicator.getBoundingClientRect().width).toBe(0)
    expect(indicator.getBoundingClientRect().height).toBe(0)

    target.dataset.active = 'true'
    await wait(100)
    target.remove()
    await beforePaint()
    expect(getComputedStyle(indicator).opacity).toBe('0')
    expect(indicator.getBoundingClientRect().width).toBe(0)
    expect(indicator.getBoundingClientRect().height).toBe(0)
    expect(el.scrollHeight).toBe(el.clientHeight)
  })


  it('glides with Web Animations by default, without writing styles on every frame', async () => {
    const [a, b] = [button('A', true), button('B', false)]
    const { el, indicator } = setup([a, b, h('div', { style: 'height: 200px' })])
    track(createHighlightIndicator(el, indicator, { target: '[data-active="true"]' }))
    await wait(100)
    let writes = 0
    const observer = new MutationObserver(records => (writes += records.length))
    observer.observe(indicator, { attributes: true, attributeFilter: ['style'] })
    a.dataset.active = 'false'
    b.dataset.active = 'true'
    await beforePaint()
    expect(indicator.getAnimations().length).toBeGreaterThan(0)
    // Moving, not there yet.
    expect(offsetOf(indicator, b)).toBeGreaterThan(1)
    expect(offsetOf(indicator, a)).toBeGreaterThan(1)
    await wait(400)
    observer.disconnect()
    expect(offsetOf(indicator, b)).toBeLessThan(1)
    // The resting value is written once when the glide starts; the finished animation is released.
    expect(writes).toBeLessThanOrEqual(2)
    expect(indicator.getAnimations()).toHaveLength(0)
  })

  it.each(['waapi', 'raf'] as const)('keeps its velocity when retargeted mid-flight (%s)', async (engine) => {
    const rows = Array.from({ length: 8 }, (_, i) => button(String(i), i === 0))
    const { el, indicator } = setup(rows)
    track(createHighlightIndicator(el, withEngine(indicator, engine), { target: '[data-active="true"]' }))
    await wait(100)
    const samples: { y: number, target: number }[] = []
    let active: HTMLElement = rows[0]!
    const move = (row: HTMLElement) => {
      active.dataset.active = 'false'
      row.dataset.active = 'true'
      active = row
    }
    for (const index of [3, 6, 1, 7, 2]) {
      move(rows[index]!)
      for (let frame = 0; frame < 3; frame++) {
        await beforePaint()
        samples.push({ y: top(indicator), target: top(active) })
      }
    }
    await wait(250)
    expect(offsetOf(indicator, active)).toBeLessThan(1)
    for (let i = 1; i < samples.length; i++) {
      const [before, after] = [samples[i - 1]!, samples[i]!]
      if (before.target !== after.target) continue
      // Never moves away from its target or past it: no jump back to an old path, no overshoot.
      expect(Math.abs(after.y - after.target)).toBeLessThanOrEqual(Math.abs(before.y - before.target) + 0.5)
      expect(Math.sign(after.y - after.target) * Math.sign(before.y - before.target)).not.toBe(-1)
    }
  })

  it('steps the per-frame spring with its own clock, not the frame timestamp', async () => {
    const [a, b] = [button('A', true), button('B', false)]
    const { el, indicator } = setup([a, b])
    let clock = 1000
    let id = 0
    const callbacks = new Map<number, FrameRequestCallback>()
    const runFrame = (stamp: number) => {
      const due = [...callbacks.values()]
      callbacks.clear()
      for (const callback of due) callback(stamp)
    }
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => (callbacks.set(++id, callback), id))
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(handle => void callbacks.delete(handle))
    try {
      track(createHighlightIndicator(el, withEngine(indicator, 'raf'), { target: '[data-active="true"]' }))
      for (let i = 0; i < 30; i++) runFrame(clock += 16)
      a.dataset.active = 'false'
      b.dataset.active = 'true'
      await wait(0) // the mutation steps the spring synchronously, at `clock`
      const stepped = top(indicator)
      const stepTime = clock
      clock += 16
      // Firefox stamps the next frame before that synchronous step: the frame must still advance by 16ms.
      runFrame(stepTime - 4)
      expect(Math.abs(top(indicator) - stepped)).toBeGreaterThan(1)
    }
    finally {
      vi.restoreAllMocks()
    }
  })

  it.each(['waapi', 'raf'] as const)('jumps while the reducedMotion getter is true, read on every update (%s)', async (engine) => {
    const [a, b] = [button('A', true), button('B', false)]
    const { el, indicator } = setup([a, b])
    let reduced = true
    track(createHighlightIndicator(el, withEngine(indicator, engine), { target: '[data-active="true"]', reducedMotion: () => reduced }))
    await wait(100)
    a.dataset.active = 'false'
    b.dataset.active = 'true'
    await beforePaint()
    expect(offsetOf(indicator, b)).toBeLessThan(1)
    expect(indicator.getAnimations()).toHaveLength(0)
    reduced = false
    b.dataset.active = 'false'
    a.dataset.active = 'true'
    await beforePaint()
    expect(offsetOf(indicator, a)).toBeGreaterThan(1)
    await wait(250)
    expect(offsetOf(indicator, a)).toBeLessThan(1)
  })

  it('falls back to the OS setting when reducedMotion is unset or its getter returns undefined', async () => {
    const [a, b] = [button('A', true), button('B', false)]
    const { el, indicator } = setup([a, b])
    const original = window.matchMedia
    window.matchMedia = query => ({ ...original.call(window, query), matches: query.includes('reduced-motion') }) as MediaQueryList
    try {
      track(createHighlightIndicator(el, indicator, { target: '[data-active="true"]', reducedMotion: () => undefined }))
    }
    finally {
      window.matchMedia = original
    }
    await wait(50)
    a.dataset.active = 'false'
    b.dataset.active = 'true'
    await beforePaint()
    expect(offsetOf(indicator, b)).toBeLessThan(1)
  })

  it('cancels its animations on destroy mid-glide', async () => {
    const [a, b] = [button('A', true), button('B', false)]
    const { el, indicator } = setup([a, b])
    const behavior = createHighlightIndicator(el, indicator, { target: '[data-active="true"]' })
    await wait(100)
    a.dataset.active = 'false'
    b.dataset.active = 'true'
    await beforePaint()
    expect(indicator.getAnimations().length).toBeGreaterThan(0)
    behavior.destroy()
    expect(indicator.getAnimations()).toHaveLength(0)
    expect(indicator.style.transform).toBe('')
    expect(indicator.hasAttribute('data-highlight-indicator')).toBe(false)
  })
  it.each(['waapi', 'raf'] as const)('freezes the rendered paint and stops future work (%s)', async (engine) => {
    const [a, b] = [button('A', true), button('B', false)]
    const { el, indicator } = setup([a, b])
    indicator.style.opacity = '0.25'
    indicator.style.transform = 'scale(2)'
    indicator.style.width = '7px'
    indicator.style.height = '8px'
    const behavior = track(createHighlightIndicator(el, withEngine(indicator, engine), { target: '[data-active="true"]' }))
    await wait(100)
    a.dataset.active = 'false'
    b.dataset.active = 'true'
    await beforePaint()
    const box = indicator.getBoundingClientRect()
    const opacity = getComputedStyle(indicator).opacity

    behavior.freeze()
    behavior.freeze()
    expect(indicator.getAnimations()).toHaveLength(0)
    const frozenBox = indicator.getBoundingClientRect()
    for (const dimension of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(frozenBox[dimension] - box[dimension])).toBeLessThan(0.1)
    }
    expect(getComputedStyle(indicator).opacity).toBe(opacity)

    b.dataset.active = 'false'
    await wait(200)
    expect(indicator.getBoundingClientRect().toJSON()).toEqual(frozenBox.toJSON())
    expect(getComputedStyle(indicator).opacity).toBe(opacity)

    behavior.destroy()
    expect(indicator.getAnimations()).toHaveLength(0)
    expect(indicator.style.opacity).toBe('0.25')
    expect(indicator.style.transform).toBe('scale(2)')
    expect(indicator.style.width).toBe('7px')
    expect(indicator.style.height).toBe('8px')
    expect(indicator.hasAttribute('data-highlight-indicator')).toBe(false)
  })


  it.each(['waapi', 'raf'] as const)('keeps its place on screen while the keyboard scrolls the list (%s)', async (engine) => {
    const el = append(h('div', { tabindex: '0', style: 'position: relative; height: 120px; overflow: auto' }, Array.from({ length: 20 }, (_, i) => item(String(i)))))
    const indicator = el.insertBefore(h('div', { style: 'position: absolute; top: 0; left: 0' }), el.firstChild)
    track(createArrowNavigation(el))
    track(createHighlightIndicator(el, withEngine(indicator, engine)))
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    await wait(250)
    const before = top(indicator)
    // Dispatched synchronously, so the next paint is the first one after the key.
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await beforePaint()
    // The list scrolled by a row; the indicator starts from where it was on screen, not from where the content went.
    expect(el.scrollTop).toBeGreaterThan(0)
    expect(Math.abs(top(indicator) - before)).toBeLessThan(3)
    await wait(250)
    expect(offsetOf(indicator, el.querySelector('[data-highlighted]')!)).toBeLessThan(1)
  })

  it('coalesces the mutations of one task into one measurement', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => button(String(i), i === 0))
    const { el, indicator } = setup(rows)
    track(createHighlightIndicator(el, indicator, { target: '[data-active="true"]' }))
    await wait(50)
    let measures = 0
    el.getBoundingClientRect = function () {
      measures++
      return HTMLElement.prototype.getBoundingClientRect.call(this)
    }
    // A framework patch and observers mirroring it: mutations spread over several microtasks.
    for (const row of rows) {
      row.title = 'x'
      await Promise.resolve()
    }
    await wait(0)
    expect(measures).toBe(1)
  })

  it.each(['waapi', 'raf'] as const)('measures again on remeasure() and after an ancestor animation ends (%s)', async (engine) => {
    const a = button('A', true)
    const indicator = h('div', { style: 'position: absolute; top: 0; left: 0' })
    const el = h('div', { style: 'position: relative' }, [indicator, a])
    const zoom = append(h('div', { style: 'transform: scale(0.5); transform-origin: 0 0' }, [el]))
    const behavior = track(createHighlightIndicator(el, withEngine(indicator, engine), { target: '[data-active="true"]' }))
    await wait(100)
    // Scaled when measured; the transform changes without any mutation inside the container.
    zoom.style.transform = 'none'
    await wait(100)
    expect(offsetOf(indicator, a)).toBeGreaterThan(1)
    behavior.remeasure()
    await wait(200)
    expect(offsetOf(indicator, a)).toBeLessThan(1)

    // An enter zoom: nothing reports its end but the animation event.
    zoom.style.transform = 'scale(0.5)'
    behavior.remeasure()
    await wait(200)
    const animation = zoom.animate([{ transform: 'scale(0.5)' }, { transform: 'none' }], 1)
    await animation.finished
    zoom.style.transform = 'none'
    zoom.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }))
    await wait(250)
    expect(offsetOf(indicator, a)).toBeLessThan(1)
  })

  it('ignores ancestor transitions that cannot scale the list', async () => {
    const a = button('A', true)
    const indicator = h('div', { style: 'position: absolute; top: 0; left: 0' })
    const el = h('div', { style: 'position: relative' }, [indicator, a])
    const wrapper = append(h('div', {}, [el]))
    track(createHighlightIndicator(el, indicator, { target: '[data-active="true"]' }))
    await wait(50)
    let measures = 0
    el.getBoundingClientRect = function () {
      measures++
      return HTMLElement.prototype.getBoundingClientRect.call(this)
    }
    wrapper.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'opacity' }))
    await frames(2)
    expect(measures).toBe(0)
    wrapper.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'transform' }))
    wrapper.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'scale' }))
    await frames(2)
    // One check a frame, and no measurement since the box did not change.
    expect(measures).toBe(1)
  })

  it('pins a custom target to the keyboard nudge when it marks the highlighted item', async () => {
    const store = createHighlightStore()
    const el = append(h('div', { tabindex: '0', style: 'position: relative; height: 120px; overflow: auto' }, Array.from({ length: 20 }, (_, i) => item(String(i)))))
    const indicator = el.insertBefore(h('div', { style: 'position: absolute; top: 0; left: 0' }), el.firstChild)
    // A host-owned marker, mirrored from the store synchronously.
    let marked: Element | null = null
    store.subscribe(() => {
      marked?.removeAttribute('data-mine')
      marked = store.highlighted
      marked?.setAttribute('data-mine', '')
    })
    track(createArrowNavigation(el, { store }))
    track(createHighlightIndicator(el, indicator, { store, target: '[data-mine]' }))
    el.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    await wait(250)
    const before = top(indicator)
    // Dispatched synchronously, so the next paint is the first one after the key.
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await beforePaint()
    expect(el.scrollTop).toBeGreaterThan(0)
    expect(Math.abs(top(indicator) - before)).toBeLessThan(3)
    expect(store.nudge).toBeUndefined()
  })
})
