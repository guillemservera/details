import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref, shallowRef } from 'vue'
import { useRouletteText, type RouletteTextOptions } from '../../src/roulette-text/useRouletteText'
import { frames, mount } from './helpers'

let mounted: { unmount(): void } | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

describe('useRouletteText', () => {
  it('keeps plain motion unfiltered and makes optional blur continuous, with no effects left after settling', async () => {
    const options = reactive<RouletteTextOptions>({ duration: 800 })
    const text = ref('ABC')
    const source = shallowRef<HTMLElement | null>(null)
    const viewport = shallowRef<HTMLElement | null>(null)
    mounted = mount(defineComponent(() => {
      useRouletteText(source, viewport, options)
      return () => h('span', { style: 'position:relative;display:inline-block;font:32px/40px monospace;white-space:pre' }, [
        h('span', { ref: source }, text.value),
        h('span', { ref: viewport }),
      ])
    }))
    await frames()
    const effects = () => [...viewport.value!.querySelectorAll('span')].map(el => getComputedStyle(el))
    const pause = () => {
      for (const animation of viewport.value!.parentElement!.getAnimations({ subtree: true })) {
        animation.pause()
        animation.currentTime = 120
      }
    }
    text.value = 'XYZ'
    await frames(2)
    pause()
    expect(effects().every(style => style.filter === 'none' && style.maskImage === 'none')).toBe(true)

    options.blur = 0.15
    options.fade = 0.4
    await nextTick()
    text.value = 'QRS'
    await frames(2)
    pause()
    const before = effects().find(style => style.filter !== 'none')!.filter
    expect(parseFloat(before.slice(5))).toBeGreaterThan(0)
    expect(effects().some(style => style.maskImage.includes('linear-gradient'))).toBe(true)
    text.value = 'UVW'
    await nextTick()
    await Promise.resolve()
    const after = effects().find(style => style.filter !== 'none')!.filter
    expect(parseFloat(after.slice(5))).toBeCloseTo(parseFloat(before.slice(5)), 1)

    options.animated = false
    await nextTick()
    expect(viewport.value!.textContent).toBe('UVW')
    expect(source.value!.textContent).toBe('UVW')
    expect(effects().every(style => style.filter === 'none' && style.maskImage === 'none')).toBe(true)
  })
})
