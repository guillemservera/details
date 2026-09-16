import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMorphText, type MorphTextOptions } from '../../src/morph-text/createMorphText'
import { change, cleanup, finish, frames, row, seek, textFixture, track } from './helpers'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function setup(options: MorphTextOptions = { duration: 600 }, style = '', text = 'First phrase') {
  const { source, viewport } = textFixture(text, `font:32px/48px sans-serif;${style}`)
  const motion = track(createMorphText(source, viewport, options))
  return { source, viewport, motion }
}

describe('createMorphText', () => {
  it('preserves opacity and blur through interruptions and reversals, then settles bursts sharply', async () => {
    const { source, viewport: view } = setup()
    await frames()
    await change(source, 'Second phrase')
    seek(view, 90)
    const first = row(view, 'First phrase')
    const second = row(view, 'Second phrase')
    const firstStyle = getComputedStyle(first)
    const firstOpacity = Number(firstStyle.opacity)
    const firstBlur = firstStyle.filter
    const secondStyle = getComputedStyle(second)
    const secondOpacity = Number(secondStyle.opacity)
    const secondBlur = secondStyle.filter
    expect(firstOpacity).toBeGreaterThan(0)
    expect(firstOpacity).toBeLessThan(1)
    expect(secondOpacity).toBeGreaterThan(0)
    expect(secondOpacity).toBeLessThan(1)
    expect(Number.parseFloat(firstBlur.slice(5))).toBeGreaterThan(0)
    expect(Number.parseFloat(secondBlur.slice(5))).toBeGreaterThan(0)

    await change(source, 'Third phrase')
    expect(Number(getComputedStyle(first).opacity)).toBeCloseTo(firstOpacity, 3)
    expect(getComputedStyle(first).filter).toBe(firstBlur)
    expect(Number(getComputedStyle(second).opacity)).toBeCloseTo(secondOpacity, 3)
    expect(getComputedStyle(second).filter).toBe(secondBlur)
    await change(source, 'First phrase')
    expect(Number(getComputedStyle(first).opacity)).toBeCloseTo(firstOpacity, 3)
    expect(getComputedStyle(first).filter).toBe(firstBlur)
    await finish(view)
    expect(view.textContent).toBe('First phrase')
    expect(getComputedStyle(row(view, 'First phrase')).opacity).toBe('1')
    expect(getComputedStyle(row(view, 'First phrase')).filter).toBe('none')

    let last = ''
    for (const value of ['x', '', '  Café 👨‍👩‍👧‍👦 e\u0301  ', 'A much longer final phrase with proportional widths']) {
      await change(source, (last = value))
      seek(view, 45)
    }
    await finish(view)
    expect(view.textContent).toBe(last)
    expect(getComputedStyle(row(view, last)).opacity).toBe('1')
    expect(getComputedStyle(row(view, last)).filter).toBe('none')
    expect(source.textContent).toBe(last)
    expect(row(view, last).getBoundingClientRect().right).toBeLessThanOrEqual(view.getBoundingClientRect().right + 1)
  })

  it('settles reduced and disabled motion, applies changed getter options, handles empty text, and restores on destroy', async () => {
    const media = new EventTarget() as MediaQueryList
    let reduced = false
    Object.defineProperty(media, 'matches', { get: () => reduced })
    vi.spyOn(window, 'matchMedia').mockReturnValue(media)
    const state = { duration: 600, animated: true, blur: 0.2 }
    const { source, viewport, motion } = setup({ duration: () => state.duration, animated: () => state.animated, blur: () => state.blur })
    await frames()
    await change(source, 'In motion')
    seek(viewport, 90)
    reduced = true
    media.dispatchEvent(new Event('change'))
    expect(viewport.textContent).toBe('In motion')
    expect(getComputedStyle(viewport.firstElementChild!).opacity).toBe('1')
    expect(getComputedStyle(viewport.firstElementChild!).filter).toBe('none')
    expect(viewport.getAttribute('aria-hidden')).toBe('true')
    expect(source.getAttribute('aria-hidden')).toBeNull()

    reduced = false
    media.dispatchEvent(new Event('change'))
    await change(source, 'Interrupt again')
    seek(viewport, 90)
    motion.update()
    expect(viewport.children).toHaveLength(2)
    state.animated = false
    motion.update()
    expect(viewport.textContent).toBe('Interrupt again')
    await change(source, '')
    expect(viewport.textContent).toBe('')
    expect(source.getBoundingClientRect().height).toBeGreaterThan(0)

    state.animated = true
    state.duration = 0
    motion.update()
    await change(source, '  Exact whitespace 👩🏽‍💻  ')
    expect(viewport.textContent).toBe('  Exact whitespace 👩🏽‍💻  ')

    state.duration = 600
    state.blur = 0
    motion.update()
    await change(source, 'A sharp crossfade')
    seek(viewport, 90)
    for (const element of viewport.children) {
      const filter = getComputedStyle(element).filter
      expect(filter === 'none' || filter === 'blur(0px)').toBe(true)
    }

    await change(source, 'Destroy during motion')
    motion.destroy()
    expect(source.textContent).toBe('Destroy during motion')
    expect(source.style.opacity).toBe('')
    expect(viewport.textContent).toBe('')
    expect(viewport.getAttribute('aria-hidden')).toBeNull()
  })

  it('aligns layers with the source under RTL and padding, and caps outgoing layers during rapid updates', async () => {
    const { source, viewport } = setup({ duration: 600 }, 'direction:rtl;padding:10px 20px', 'A much longer phrase')
    await frames()
    await change(source, 'Short')
    seek(viewport, 90)
    const box = source.getBoundingClientRect()
    for (const value of ['A much longer phrase', 'Short']) {
      const rect = row(viewport, value).getBoundingClientRect()
      expect(rect.right).toBeCloseTo(box.right, 0)
      expect(rect.top).toBeCloseTo(box.top, 0)
    }

    for (let index = 0; index < 16; index++) {
      await change(source, `Update ${index}`)
      seek(viewport, 40)
    }
    expect(viewport.children.length).toBeLessThanOrEqual(3)
    await finish(viewport)
    expect(viewport.textContent).toBe('Update 15')
  })
})
