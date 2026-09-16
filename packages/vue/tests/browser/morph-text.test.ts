import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref, shallowRef, type Ref } from 'vue'
import { useMorphText, type MorphTextOptions } from '../../src/morph-text/useMorphText'
import { frames, mount } from './helpers'

let mounted: { unmount(): void } | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  vi.restoreAllMocks()
})

function setup(options: MorphTextOptions) {
  const text = ref('First phrase')
  const key = ref(0)
  const source = shallowRef<HTMLElement | null>(null)
  const viewport = shallowRef<HTMLElement | null>(null)
  mounted = mount(defineComponent(() => {
    useMorphText(source, viewport, options)
    return () => h('div', { style: 'position:relative;display:inline-block;font:32px/48px sans-serif' }, [
      h('span', { key: `source-${key.value}`, ref: source }, text.value),
      h('span', { key: `viewport-${key.value}`, ref: viewport }),
    ])
  }))
  return { text, key, source, viewport }
}

async function change(text: Ref<string>, value: string) {
  text.value = value
  await nextTick()
  // Vue patches first; the source's MutationObserver then retargets before the next paint.
  await Promise.resolve()
}

function seek(viewport: HTMLElement, time: number) {
  for (const animation of viewport.getAnimations({ subtree: true })) {
    animation.pause()
    animation.currentTime = time
  }
}

describe('useMorphText', () => {
  it('settles reduced and disabled motion, handles empty text, and restores replaced or unmounted targets', async () => {
    const media = new EventTarget() as MediaQueryList
    let reduced = false
    Object.defineProperty(media, 'matches', { get: () => reduced })
    vi.spyOn(window, 'matchMedia').mockReturnValue(media)
    const options = reactive<MorphTextOptions>({ duration: 600 })
    const { text, key, source, viewport } = setup(options)
    await frames()
    await change(text, 'In motion')
    seek(viewport.value!, 90)
    reduced = true
    media.dispatchEvent(new Event('change'))
    expect(viewport.value!.textContent).toBe('In motion')
    expect(getComputedStyle(viewport.value!.firstElementChild!).opacity).toBe('1')
    expect(getComputedStyle(viewport.value!.firstElementChild!).filter).toBe('none')
    expect(viewport.value!.getAttribute('aria-hidden')).toBe('true')
    expect(source.value!.getAttribute('aria-hidden')).toBeNull()

    reduced = false
    media.dispatchEvent(new Event('change'))
    await change(text, 'Interrupt again')
    seek(viewport.value!, 90)
    options.animated = false
    await nextTick()
    expect(viewport.value!.textContent).toBe('Interrupt again')
    await change(text, '')
    expect(viewport.value!.textContent).toBe('')
    expect(source.value!.getBoundingClientRect().height).toBeGreaterThan(0)

    options.animated = true
    options.duration = 0
    await nextTick()
    await change(text, '  Exact whitespace 👩🏽‍💻  ')
    expect(viewport.value!.textContent).toBe('  Exact whitespace 👩🏽‍💻  ')
    const previousSource = source.value!
    const previousViewport = viewport.value!
    options.duration = 600
    await nextTick()
    await change(text, 'Replace during motion')
    key.value++
    await frames()
    expect(previousSource.style.opacity).toBe('')
    expect(previousViewport.textContent).toBe('')
    expect(previousViewport.getAttribute('aria-hidden')).toBeNull()
    expect(viewport.value!.textContent).toBe('Replace during motion')

    options.blur = 0
    await nextTick()
    await change(text, 'A sharp crossfade')
    seek(viewport.value!, 90)
    for (const element of viewport.value!.children) {
      const filter = getComputedStyle(element).filter
      expect(filter === 'none' || filter === 'blur(0px)').toBe(true)
    }

    await change(text, 'Unmount during motion')
    const finalSource = source.value!
    const finalViewport = viewport.value!
    mounted!.unmount()
    mounted = undefined
    expect(finalSource.textContent).toBe('Unmount during motion')
    expect(finalSource.style.opacity).toBe('')
    expect(finalViewport.textContent).toBe('')
    expect(finalViewport.getAttribute('aria-hidden')).toBeNull()
  })
})
