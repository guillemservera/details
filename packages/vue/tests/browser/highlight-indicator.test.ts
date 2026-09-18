import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { useHighlightIndicator, useHighlightStore, type HighlightIndicatorControls, type HighlightStoreState } from '../../src/highlight-indicator'
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

  it('reads a reducedMotion ref on every update and remeasures on demand', async () => {
    const el = shallowRef<HTMLElement | null>(null)
    const indicator = shallowRef<HTMLElement | null>(null)
    const zoom = shallowRef<HTMLElement | null>(null)
    const reduced = shallowRef(true)
    const active = shallowRef(0)
    let controls!: HighlightIndicatorControls
    mounted = mount(defineComponent(() => {
      controls = useHighlightIndicator(el, indicator, { target: '[data-active]', reducedMotion: reduced })
      return () => h('div', { ref: zoom, style: 'transform-origin: 0 0' }, [
        h('div', { ref: el, style: 'position: relative' }, [
          h('div', { ref: indicator, style: 'position: absolute; top: 0; left: 0' }),
          ...[0, 1].map(i => item(String(i), { 'data-active': active.value === i ? '' : undefined })),
        ]),
      ])
    }))
    await nextTick()
    await wait(50)
    const rows = el.value!.querySelectorAll('button')
    active.value = 1
    await beforePaint()
    expect(offsetOf(indicator.value!, rows[1]!)).toBeLessThan(1)
    reduced.value = false
    active.value = 0
    await beforePaint()
    expect(offsetOf(indicator.value!, rows[0]!)).toBeGreaterThan(1)
    await wait(250)
    // Measured while an ancestor is scaled, then the scale goes away without any mutation inside the list.
    zoom.value!.style.transform = 'scale(0.5)'
    controls.remeasure()
    await wait(250)
    zoom.value!.style.transform = 'none'
    await wait(50)
    expect(offsetOf(indicator.value!, rows[0]!)).toBeGreaterThan(1)
    controls.remeasure()
    await wait(250)
    expect(offsetOf(indicator.value!, rows[0]!)).toBeLessThan(1)
  })
  it('freezes the current paint and destroys cleanly', async () => {
    const el = shallowRef<HTMLElement | null>(null)
    const indicator = shallowRef<HTMLElement | null>(null)
    const active = shallowRef(0)
    let controls!: HighlightIndicatorControls
    mounted = mount(defineComponent(() => {
      controls = useHighlightIndicator(el, indicator, { target: '[data-active]' })
      return () => h('div', { ref: el, style: 'position: relative' }, [
        h('div', { ref: indicator, style: 'position: absolute; top: 0; left: 0' }),
        ...[0, 1].map(i => item(String(i), { 'data-active': active.value === i ? '' : undefined })),
      ])
    }))
    await nextTick()
    await wait(100)
    const old = indicator.value!
    const paint = [getComputedStyle(old).opacity, getComputedStyle(old).transform, getComputedStyle(old).width, getComputedStyle(old).height]
    controls.freeze()
    controls.freeze()
    active.value = 1
    await beforePaint()
    expect([getComputedStyle(old).opacity, getComputedStyle(old).transform, getComputedStyle(old).width, getComputedStyle(old).height]).toEqual(paint)
    mounted.unmount()
    mounted = undefined
    expect(old.style.opacity).toBe('')
    expect(old.style.transform).toBe('')
    expect(old.style.width).toBe('')
    expect(old.style.height).toBe('')
  })


  it('tracks indexed items, removal and container replacement without pointer or keyboard hooks', async () => {
    const el = shallowRef<HTMLElement | null>(null)
    const indicator = shallowRef<HTMLElement | null>(null)
    const show = shallowRef(true)
    const version = shallowRef(0)
    let state!: HighlightStoreState
    mounted = mount(defineComponent(() => {
      useHighlightIndicator(el, indicator)
      state = useHighlightStore(el)
      return () => h('div', { key: version.value, ref: el, style: 'position: relative' }, [
        h('div', { ref: indicator, style: 'position: absolute; top: 0; left: 0' }),
        show.value ? item('A', { 'data-index': '0' }) : null,
      ])
    }))
    await nextTick()
    const a = el.value!.querySelector('button')!
    state.store.highlightIndex(0, 'keyboard')
    expect(state.highlighted.value).toBe(a)
    expect(state.source.value).toBe('keyboard')
    await wait(50)
    expect(offsetOf(indicator.value!, a)).toBeLessThan(1)

    show.value = false
    await nextTick()
    expect(state.highlighted.value).toBeNull()

    version.value++
    show.value = true
    await nextTick()
    const replacement = el.value!.querySelector('button')!
    state.store.highlightIndex(0, 'keyboard')
    expect(state.highlighted.value).toBe(replacement)
    expect(replacement.hasAttribute('data-highlighted')).toBe(true)

    mounted.unmount()
    mounted = undefined
    expect(state.highlighted.value).toBeNull()
    expect(replacement.hasAttribute('data-highlighted')).toBe(false)
  })
})
