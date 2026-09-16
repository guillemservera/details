import { afterEach, describe, expect, it } from 'vitest'
import { createRouletteText, type RouletteTextOptions } from '../../src/roulette-text/createRouletteText'
import { change, cleanup, frames, textFixture, track, wait } from './helpers'

afterEach(cleanup)

function setup(text: string, options: RouletteTextOptions) {
  const { source, viewport } = textFixture(text, 'font:32px/40px monospace;white-space:pre')
  const motion = track(createRouletteText(source, viewport, options))
  return { source, viewport, motion }
}

function renderedText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const result: { text: string; rect: DOMRect }[] = []
  while (walker.nextNode()) {
    const range = document.createRange()
    range.selectNodeContents(walker.currentNode)
    result.push({ text: walker.currentNode.textContent!, rect: range.getBoundingClientRect() })
  }
  return result
}

describe('createRouletteText', () => {
  it('keeps emoji and combining sequences whole while rolling and settles exact whitespace and empty text', async () => {
    const { source, viewport } = setup('e\u0301 👨‍👩‍👧‍👦', { duration: 240, alphabet: '🧑🏽‍🚀e\u0301 ' })
    await frames()
    source.textContent = '🦊  🇫🇷'
    await frames(2)
    const allowed = ['e\u0301', ' ', '👨‍👩‍👧‍👦', '🧑🏽‍🚀', '🦊', '🇫🇷']
    const glyphs = renderedText(viewport).map(part => part.text)
    expect(glyphs).toContain('🧑🏽‍🚀')
    for (const glyph of glyphs) expect(allowed).toContain(glyph)
    expect(source.getAttribute('aria-hidden')).toBeNull()
    expect(viewport.getAttribute('aria-hidden')).toBe('true')
    await wait(350)
    expect(viewport.textContent).toBe('🦊  🇫🇷')
    source.textContent = ''
    await wait(350)
    expect(viewport.textContent).toBe('')
    source.textContent = '  e\u0301 🦊 '
    await wait(350)
    expect(viewport.textContent).toBe('  e\u0301 🦊 ')
  })

  it('retargets from the visible strip position and settles the latest burst without leaving motion behind', async () => {
    const { source, viewport, motion } = setup('A', { duration: 400, direction: 'down', alphabet: 'BCDE' })
    await frames()
    source.textContent = 'Z'
    await frames(2)
    for (const animation of viewport.getAnimations({ subtree: true })) {
      animation.pause()
      animation.currentTime = 80
    }
    const bounds = viewport.getBoundingClientRect()
    const visible = renderedText(viewport).find(part => part.text !== 'Z' && part.rect.bottom > bounds.top + 1 && part.rect.top < bounds.bottom - 1)!
    expect(visible.text).not.toBe('Z')
    await change(source, 'Q')
    const continued = renderedText(viewport).find(part => part.text === visible.text && Math.abs(part.rect.top - visible.rect.top) < 0.5)
    expect(continued).toBeDefined()
    for (const value of ['AB', 'A', 'ZYX', 'Q', 'FINISH']) {
      source.textContent = value
      await frames(1)
    }
    await wait(500)
    expect(viewport.textContent).toBe('FINISH')
    expect(viewport.getAnimations({ subtree: true })).toEqual([])
    motion.destroy()
    expect(viewport.textContent).toBe('')
    expect(viewport.getAnimations({ subtree: true })).toEqual([])
  })

  it('keeps plain motion unfiltered and makes optional blur continuous, with no effects left after settling', async () => {
    const state: { animated?: boolean, blur?: number, fade?: number } = {}
    const { source, viewport, motion } = setup('ABC', { duration: 800, animated: () => state.animated, blur: () => state.blur, fade: () => state.fade })
    await frames()
    const effects = () => [...viewport.querySelectorAll('span')].map(el => getComputedStyle(el))
    const pause = () => {
      for (const animation of viewport.parentElement!.getAnimations({ subtree: true })) {
        animation.pause()
        animation.currentTime = 120
      }
    }
    source.textContent = 'XYZ'
    await frames(2)
    pause()
    expect(effects().every(style => style.filter === 'none' && style.maskImage === 'none')).toBe(true)

    state.blur = 0.15
    state.fade = 0.4
    motion.update()
    source.textContent = 'QRS'
    await frames(2)
    pause()
    const before = effects().find(style => style.filter !== 'none')!.filter
    expect(parseFloat(before.slice(5))).toBeGreaterThan(0)
    expect(effects().some(style => style.maskImage.includes('linear-gradient'))).toBe(true)
    await change(source, 'UVW')
    const after = effects().find(style => style.filter !== 'none')!.filter
    expect(parseFloat(after.slice(5))).toBeCloseTo(parseFloat(before.slice(5)), 1)

    state.animated = false
    motion.update()
    expect(viewport.textContent).toBe('UVW')
    expect(source.textContent).toBe('UVW')
    expect(effects().every(style => style.filter === 'none' && style.maskImage === 'none')).toBe(true)
  })

  it('animates only the slots that change', async () => {
    const { source, viewport } = setup('ABC', { duration: 400 })
    await frames()
    await change(source, 'ABD')
    const animations = viewport.parentElement!.getAnimations({ subtree: true })
    expect(animations).toHaveLength(1)
    expect((animations[0]!.effect as KeyframeEffect).target!.textContent).toContain('D')
  })
})
