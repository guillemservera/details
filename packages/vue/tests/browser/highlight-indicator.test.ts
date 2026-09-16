import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { useHighlightIndicator } from '../../src/highlight-indicator/useHighlightIndicator'
import { useProximityHover } from '../../src/proximity-hover/useProximityHover'
import { beforePaint, item, mount, wait } from './helpers'

let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

function offsetOf(a: Element, b: Element) {
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  return Math.abs(ra.top - rb.top) + Math.abs(ra.height - rb.height)
}

describe('useHighlightIndicator', () => {
  it('stays on the highlighted item in the same frame while content scrolls under the pointer', async () => {
    const el = shallowRef<HTMLElement | null>(null)
    const indicator = shallowRef<HTMLElement | null>(null)
    mounted = mount(defineComponent(() => {
      useProximityHover(el)
      useHighlightIndicator(el, indicator)
      return () => h('div', { ref: el, style: 'position: relative; height: 200px; overflow: auto' }, [
        h('div', { ref: indicator, style: 'position: absolute; top: 0; left: 0' }),
        ...Array.from({ length: 30 }, (_, i) => item(String(i))),
      ])
    }))
    await nextTick()
    await userEvent.hover(el.value!.querySelectorAll('button')[2]!)
    await wait(200)
    for (let step = 0; step < 5; step++) {
      el.value!.scrollTop += 90
      await beforePaint()
      const highlightedItem = el.value!.querySelector('[data-highlighted]')!
      expect(offsetOf(indicator.value!, highlightedItem)).toBeLessThan(1)
    }
  })

  it('releases the indicator when it is removed', async () => {
    const el = shallowRef<HTMLElement | null>(null)
    const indicator = shallowRef<HTMLElement | null>(null)
    const show = shallowRef(true)
    mounted = mount(defineComponent(() => {
      useHighlightIndicator(el, indicator)
      return () => h('div', { ref: el, style: 'position: relative' }, show.value ? [h('div', { ref: indicator })] : [])
    }))
    await nextTick()
    const old = indicator.value!
    expect(old.hasAttribute('data-highlight-indicator')).toBe(true)
    show.value = false
    await nextTick()
    expect(old.hasAttribute('data-highlight-indicator')).toBe(false)
  })
})
