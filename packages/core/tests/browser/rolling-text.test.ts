import { afterEach, describe, expect, it } from 'vitest'
import { createRollingText, type RollingTextOptions } from '../../src/rolling-text/createRollingText'
import { change, cleanup, finish, frames, row, seek, textFixture, track } from './helpers'

afterEach(cleanup)

function setup(options: RollingTextOptions = {}, style = '', text = 'First phrase') {
  const { source, viewport } = textFixture(text, `font:32px/48px sans-serif;${style}`)
  const motion = track(createRollingText(source, viewport, options))
  return { source, viewport, motion }
}

describe('createRollingText', () => {
  it('rolls complete phrases, preserves interrupted positions and returns to a visible earlier phrase', async () => {
    const { source, viewport: view } = setup()
    await frames()
    const sourceTop = source.getBoundingClientRect().top
    await change(source, 'Second phrase')
    seek(view, 90)
    const first = row(view, 'First phrase')
    const second = row(view, 'Second phrase')
    const firstTop = first.getBoundingClientRect().top
    const secondTop = second.getBoundingClientRect().top
    expect(firstTop).toBeLessThan(sourceTop)
    expect(secondTop).toBeGreaterThan(sourceTop)
    expect(secondTop - firstTop).toBeCloseTo(source.getBoundingClientRect().height, 1)

    await change(source, 'Third phrase')
    expect(first.getBoundingClientRect().top).toBeCloseTo(firstTop, 1)
    expect(second.getBoundingClientRect().top).toBeCloseTo(secondTop, 1)
    await change(source, 'First phrase')
    expect(first.getBoundingClientRect().top).toBeCloseTo(firstTop, 1)
    await finish(view)
    expect(view.textContent).toBe('First phrase')
    expect(row(view, 'First phrase').getBoundingClientRect().top).toBeCloseTo(sourceTop, 1)

    for (const value of ['A longer phrase', '', '  Café 👨‍👩‍👧‍👦 e\u0301  ', 'Done']) {
      await change(source, value)
      seek(view, 45)
    }
    await finish(view)
    expect(view.textContent).toBe('Done')
    expect(view.getAnimations({ subtree: true })).toEqual([])
    expect(row(view, 'Done').getBoundingClientRect().right).toBeLessThanOrEqual(view.getBoundingClientRect().right + 1)
  })

  it('supports downward rolling, instant updates, accessible Unicode text and cleanup during motion', async () => {
    const state: { animated: boolean, duration?: number } = { animated: true }
    const { source, viewport, motion } = setup({ direction: 'down', animated: () => state.animated, duration: () => state.duration })
    await frames()
    await change(source, 'Another phrase')
    seek(viewport, 90)
    expect(row(viewport, 'First phrase').getBoundingClientRect().top).toBeGreaterThan(source.getBoundingClientRect().top)
    expect(row(viewport, 'Another phrase').getBoundingClientRect().top).toBeLessThan(source.getBoundingClientRect().top)

    state.animated = false
    motion.update()
    expect(viewport.textContent).toBe('Another phrase')
    await change(source, '')
    expect(viewport.textContent).toBe('')
    state.animated = true
    state.duration = 0
    motion.update()
    const text = '  e\u0301 👩🏽‍💻  '
    await change(source, text)
    expect(viewport.textContent).toBe(text)
    expect(source.textContent).toBe(text)
    expect(source.getAttribute('aria-hidden')).toBeNull()
    expect(viewport.getAttribute('aria-hidden')).toBe('true')
    expect(viewport.getAnimations({ subtree: true })).toEqual([])

    state.duration = 600
    motion.update()
    await change(source, 'Destroy during motion')
    motion.destroy()
    expect(source.textContent).toBe('Destroy during motion')
    expect(source.style.opacity).toBe('')
    expect(viewport.textContent).toBe('')
    expect(viewport.getAnimations({ subtree: true })).toEqual([])
  })

  it('aligns rows with the source under RTL, padding and borders while rolling', async () => {
    const { source, viewport } = setup({}, 'direction:rtl;padding:10px 20px;border:3px solid', 'A much longer phrase')
    await frames()
    await change(source, 'Short')
    seek(viewport, 90)
    const box = source.getBoundingClientRect()
    for (const value of ['A much longer phrase', 'Short']) {
      const rect = row(viewport, value).getBoundingClientRect()
      expect(rect.right).toBeCloseTo(box.right, 0)
    }
    await finish(viewport)
    const rect = row(viewport, 'Short').getBoundingClientRect()
    expect(rect.left).toBeCloseTo(box.left, 1)
    expect(rect.top).toBeCloseTo(box.top, 1)
  })

  it('rejects elements that are not an empty sibling pair', () => {
    const { source, viewport } = textFixture('Text', '')
    viewport.append('x')
    expect(() => createRollingText(source, viewport)).toThrow('sibling source and empty viewport')
  })

  it('settles when the document becomes hidden', async () => {
    const { source, viewport } = setup()
    await frames()
    await change(source, 'Hidden')
    expect(viewport.getAnimations({ subtree: true })).not.toEqual([])
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    try {
      document.dispatchEvent(new Event('visibilitychange'))
      expect(viewport.textContent).toBe('Hidden')
      expect(viewport.getAnimations({ subtree: true })).toEqual([])
    }
    finally {
      delete (document as { hidden?: boolean }).hidden
    }
  })
})
