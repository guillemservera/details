import { afterEach, describe, expect, it, vi } from 'vitest'
import { cdp } from 'vitest/browser'
import { defineComponent, effectScope, h, nextTick } from 'vue'
import { createInputCapabilities } from '@guillemservera/details-core/input-capabilities'
import { useInputCapabilities } from '../../src/input-capabilities/useInputCapabilities'
import { mount } from './helpers'

const emulateTouch = (enabled: boolean) => cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 5 })

let mounted: ReturnType<typeof mount> | undefined
afterEach(async () => {
  mounted?.unmount()
  mounted = undefined
  vi.restoreAllMocks()
  await emulateTouch(false)
})

/** Counts media query listeners attached and removed from here on. */
function trackMediaListeners() {
  const counts = { added: 0, removed: 0 }
  const matchMedia = window.matchMedia.bind(window)
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    const list = matchMedia(query)
    const add = list.addEventListener.bind(list)
    const remove = list.removeEventListener.bind(list)
    list.addEventListener = (...args: Parameters<typeof add>) => (counts.added++, add(...args))
    list.removeEventListener = (...args: Parameters<typeof remove>) => (counts.removed++, remove(...args))
    return list
  })
  return counts
}

describe('useInputCapabilities', () => {
  it('starts from the server snapshot, reads real capabilities after mount and follows touch emulation', async () => {
    let capabilities!: ReturnType<typeof useInputCapabilities>
    mounted = mount(defineComponent(() => {
      capabilities = useInputCapabilities()
      expect(capabilities.value).toEqual(createInputCapabilities().getServerSnapshot())
      return () => h('span')
    }))
    await nextTick()
    expect(capabilities.value).toMatchObject({
      canHover: matchMedia('(any-hover: hover)').matches,
      hasFinePointer: matchMedia('(any-pointer: fine)').matches,
      primaryPointerIsCoarse: false,
      isTouchFirst: false,
    })

    await emulateTouch(true)
    await expect.poll(() => capabilities.value.primaryPointerIsCoarse).toBe(true)
    expect(capabilities.value.hasTouch).toBe(true)
  })

  it('shares one set of media listeners and detaches them after the last instance is disposed', async () => {
    const counts = trackMediaListeners()
    const scope = effectScope()
    let scoped!: ReturnType<typeof useInputCapabilities>
    let component!: ReturnType<typeof useInputCapabilities>
    mounted = mount(defineComponent(() => {
      scoped = scope.run(() => useInputCapabilities())!
      component = useInputCapabilities()
      return () => h('span')
    }))
    await nextTick()
    expect(counts).toEqual({ added: 3, removed: 0 })

    scope.stop()
    expect(counts.removed).toBe(0)
    await emulateTouch(true)
    await expect.poll(() => component.value.primaryPointerIsCoarse).toBe(true)
    expect(scoped.value.primaryPointerIsCoarse).toBe(false)

    mounted.unmount()
    mounted = undefined
    expect(counts).toEqual({ added: 3, removed: 3 })
  })
})
