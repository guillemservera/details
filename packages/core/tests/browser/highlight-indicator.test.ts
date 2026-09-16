import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createHighlightIndicator } from '../../src/highlight-indicator/createHighlightIndicator'
import { createProximityHover } from '../../src/proximity-hover/createProximityHover'
import { append, beforePaint, cleanup, h, item, track, wait } from './helpers'

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
})
