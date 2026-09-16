import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { detectPlatform } from '@guillemservera/details-core/platform'
import { usePlatform } from '../../src/platform/usePlatform'
import { mount } from './helpers'

let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

describe('usePlatform', () => {
  it('stays unknown through the first render and detects the platform after mount', async () => {
    let platform!: ReturnType<typeof usePlatform>
    const rendered: string[] = []
    mounted = mount(defineComponent(() => {
      platform = usePlatform()
      expect(platform.value).toBe('unknown')
      return () => {
        rendered.push(platform.value)
        return h('span', platform.value)
      }
    }))
    expect(mounted.host.textContent).toBe('unknown')
    await nextTick()
    expect(platform.value).toBe(detectPlatform())
    expect(platform.value).not.toBe('unknown')
    expect(rendered).toEqual(['unknown', detectPlatform()])
  })
})
