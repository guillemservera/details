import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { useArrowNavigation } from '../../src/arrow-navigation/useArrowNavigation'
import { highlighted, item, mount } from './helpers'

let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

describe('lifecycle', () => {
  it('attaches to a container rendered later', async () => {
    const show = ref(false)
    const el = shallowRef<HTMLElement | null>(null)
    mounted = mount(defineComponent(() => {
      useArrowNavigation(el)
      return () => (show.value ? h('div', { ref: el, tabindex: 0 }, [item('A'), item('B')]) : null)
    }))
    show.value = true
    await nextTick()
    el.value!.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(highlighted(el.value!)).toBe('A')
  })

  it('moves to a replaced container and stops listening to the old one', async () => {
    const version = ref(0)
    const el = shallowRef<HTMLElement | null>(null)
    mounted = mount(defineComponent(() => {
      useArrowNavigation(el)
      return () => h('div', { key: version.value, ref: el, tabindex: 0 }, [item(`A${version.value}`), item(`B${version.value}`)])
    }))
    await nextTick()
    const old = el.value!
    version.value++
    await nextTick()
    const current = el.value!
    expect(current).not.toBe(old)
    old.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(highlighted(current)).toBeNull()
    current.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(highlighted(current)).toBe('A1')
  })

  it('reads ref options live', async () => {
    const loop = ref(false)
    const el = shallowRef<HTMLElement | null>(null)
    mounted = mount(defineComponent(() => {
      useArrowNavigation(el, { loop })
      return () => h('div', { ref: el, tabindex: 0 }, [item('A'), item('B')])
    }))
    await nextTick()
    el.value!.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(highlighted(el.value!)).toBe('B')
    loop.value = true
    await userEvent.keyboard('{ArrowDown}')
    expect(highlighted(el.value!)).toBe('A')
  })
})
