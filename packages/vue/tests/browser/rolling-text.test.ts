import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, effectScope, h, nextTick, ref, useTemplateRef, type Ref } from 'vue'
import { useRollingText } from '../../src/rolling-text/useRollingText'
import { frames, mount } from './helpers'

let mounted: { unmount(): void } | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

describe('useRollingText', () => {
  it('accepts ref and getter options, attaches to a late v-if ref and cleans up when its scope stops', async () => {
    const text = ref('First')
    const show = ref(false)
    const scope = effectScope()
    let source: Readonly<Ref<HTMLElement | null>>
    let viewport: Readonly<Ref<HTMLElement | null>>
    mounted = mount(defineComponent(() => {
      source = useTemplateRef<HTMLElement>('source')
      viewport = useTemplateRef<HTMLElement>('viewport')
      scope.run(() => useRollingText(source, viewport, { duration: ref(300), direction: () => 'down' }))
      return () => show.value && h('span', { style: 'position:relative;display:inline-block;font:32px/48px sans-serif' }, [
        h('span', { ref: 'source' }, text.value),
        h('span', { ref: 'viewport' }),
      ])
    }))
    await frames()
    show.value = true
    await frames()
    const view = viewport!.value!
    expect(view.getAttribute('aria-hidden')).toBe('true')
    text.value = 'Second'
    await nextTick()
    await Promise.resolve()
    const [animation] = view.getAnimations({ subtree: true })
    expect(animation!.effect!.getTiming().duration).toBe(300)
    for (const running of view.getAnimations({ subtree: true })) {
      running.pause()
      running.currentTime = 90
    }
    const row = Array.from(view.children).find(element => element.textContent === 'Second')!
    expect(row.getBoundingClientRect().top).toBeLessThan(source!.value!.getBoundingClientRect().top)

    scope.stop()
    expect(view.textContent).toBe('')
    expect(view.getAttribute('aria-hidden')).toBeNull()
    expect(view.getAnimations({ subtree: true })).toEqual([])
    expect(source!.value!.style.opacity).toBe('')
    text.value = 'Third'
    await nextTick()
    await Promise.resolve()
    expect(view.textContent).toBe('')
  })
})
