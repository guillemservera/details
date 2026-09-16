import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, effectScope, h, nextTick, shallowRef } from 'vue'
import { createHighlightStore } from '@guillemservera/details-core/proximity-hover'
import { useArrowNavigation } from '../../src/arrow-navigation/useArrowNavigation'
import { useProximityHover } from '../../src/proximity-hover/useProximityHover'
import { useHighlightStore } from '../../src/shared/highlight'
import { frames, highlighted, item, mount } from './helpers'

let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

describe('useProximityHover', () => {
  it('shares mirrored state between composables on the same ref and keeps pointer ownership until the last instance is disposed', async () => {
    const el = shallowRef<HTMLElement | null>(null)
    const scope = effectScope()
    let hover!: ReturnType<typeof useProximityHover>
    let keys!: ReturnType<typeof useArrowNavigation>
    mounted = mount(defineComponent(() => {
      scope.run(() => useProximityHover(el))
      hover = useProximityHover(el)
      keys = useArrowNavigation(el)
      return () => h('div', { ref: el, tabindex: 0 }, [item('A'), item('B')])
    }))
    await nextTick()
    expect(keys.highlighted).toBe(hover.highlighted)
    expect(keys.source).toBe(hover.source)
    await userEvent.hover(el.value!.querySelectorAll('button')[1]!)
    await frames()
    expect(hover.highlighted.value?.textContent).toBe('B')
    expect(hover.source.value).toBe('pointer')
    el.value!.focus()
    await userEvent.keyboard('{ArrowUp}')
    expect(highlighted(el.value!)).toBe('A')
    expect(hover.source.value).toBe('keyboard')

    const { store } = useHighlightStore(el, createHighlightStore)
    expect(store.pointerClaimed()).toBe(true)
    scope.stop()
    expect(store.pointerClaimed()).toBe(true)
    mounted.unmount()
    mounted = undefined
    expect(store.pointerClaimed()).toBe(false)
    expect(hover.highlighted.value).toBeNull()
  })
})
