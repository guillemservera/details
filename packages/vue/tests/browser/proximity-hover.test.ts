import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, effectScope, h, nextTick, shallowRef } from 'vue'
import { useArrowNavigation } from '../../src/arrow-navigation/useArrowNavigation'
import { useProximityHover } from '../../src/proximity-hover/useProximityHover'
import { useHighlightStore as useArrowStore } from '../../src/arrow-navigation'
import * as root from '../../src/index'
import { useHighlightStore, type HighlightStoreState } from '../../src/proximity-hover'
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
    let state!: HighlightStoreState
    mounted = mount(defineComponent(() => {
      scope.run(() => useProximityHover(el))
      hover = useProximityHover(el)
      keys = useArrowNavigation(el)
      state = useHighlightStore(el)
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

    const { store } = state
    expect(store.pointerClaimed()).toBe(true)
    scope.stop()
    expect(store.pointerClaimed()).toBe(true)
    mounted.unmount()
    mounted = undefined
    expect(store.pointerClaimed()).toBe(false)
    expect(hover.highlighted.value).toBeNull()
  })

  it('exports one shared store from every entry, and passes ignore and remeasure through', async () => {
    const el = shallowRef<HTMLElement | null>(null)
    let hover!: ReturnType<typeof useProximityHover>
    let stores: HighlightStoreState[] = []
    mounted = mount(defineComponent(() => {
      hover = useProximityHover(el, { ignore: '[data-label]' })
      stores = [useHighlightStore(el), useArrowStore(el), root.useHighlightStore(el)]
      return () => h('div', { ref: el }, [h('div', { 'data-label': '', 'style': 'height: 30px' }, 'Label'), item('A')])
    }))
    await nextTick()
    expect(stores[0]!.store).toBe(stores[1]!.store)
    expect(stores[0]).toBe(stores[2])
    const label = el.value!.querySelector('[data-label]')!
    await userEvent.hover(label)
    await frames()
    expect(highlighted(el.value!)).toBeNull()
    await userEvent.hover(el.value!.querySelector('button')!)
    expect(highlighted(el.value!)).toBe('A')
    hover.remeasure()
  })
})
