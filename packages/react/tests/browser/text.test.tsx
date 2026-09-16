import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useMorphText, type MorphTextOptions } from '../../src/morph-text/useMorphText'
import { useRollingText, type RollingTextOptions } from '../../src/rolling-text/useRollingText'
import { useRouletteText, type RouletteTextOptions } from '../../src/roulette-text/useRouletteText'
import { frames, render, type Rendered } from './helpers'

let mounted: Rendered | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

type Effect = 'rolling' | 'morph' | 'roulette'
type Props = RollingTextOptions & MorphTextOptions & RouletteTextOptions & { effect: Effect, text: string, show?: boolean, version?: number }

function Text({ effect, text, show = true, version = 0, ...options }: Props) {
  const source = useRef<HTMLSpanElement>(null)
  const viewport = useRef<HTMLSpanElement>(null)
  // One effect per component instance; the hooks are never switched at runtime.
  const hook = { rolling: useRollingText, morph: useMorphText, roulette: useRouletteText }[effect]
  hook(source, viewport, options)
  if (!show) return null
  return (
    <span style={{ position: 'relative', display: 'inline-block', font: '32px/48px monospace', whiteSpace: 'pre' }}>
      <span key={`source-${version}`} ref={source} className="source">{text}</span>
      <span key={`viewport-${version}`} ref={viewport} className="viewport" />
    </span>
  )
}

const source = () => mounted!.host.querySelector<HTMLElement>('.source')!
const viewport = () => mounted!.host.querySelector<HTMLElement>('.viewport')!
const animations = () => viewport().getAnimations({ subtree: true })

function seek(time: number) {
  for (const animation of animations()) {
    animation.pause()
    animation.currentTime = time
  }
}

async function change(props: Props) {
  mounted!.rerender(<Text {...props} />)
  // React commits first; the source's MutationObserver then retargets in a microtask.
  await Promise.resolve()
}

describe.each<Effect>(['rolling', 'morph', 'roulette'])('%s text', (effect) => {
  it('animates React-owned text, applies option props, follows replaced elements and cleans up on unmount', async () => {
    mounted = render(<Text effect={effect} text="ABC" show={false} />, { strict: true })
    await change({ effect, text: 'ABC', duration: 300 })
    expect(viewport().getAttribute('aria-hidden')).toBe('true')
    expect(viewport().textContent).toBe('ABC')
    await frames()

    await change({ effect, text: 'XYZ', duration: 300 })
    expect(animations().length).toBeGreaterThan(0)
    expect(animations()[0]!.effect!.getTiming().duration).toBe(300)
    seek(90)

    // An option change settles the running effect on the current text.
    await change({ effect, text: 'XYZ', duration: 300, animated: false })
    expect(animations()).toEqual([])
    expect(viewport().textContent).toBe('XYZ')
    await change({ effect, text: 'QRS', duration: 300, animated: false })
    expect(viewport().textContent).toBe('QRS')

    const previousSource = source()
    const previousViewport = viewport()
    await change({ effect, text: 'QRS', version: 1 })
    expect(previousSource.style.opacity).toBe('')
    expect(previousViewport.textContent).toBe('')
    expect(previousViewport.getAttribute('aria-hidden')).toBeNull()
    expect(viewport()).not.toBe(previousViewport)
    expect(viewport().textContent).toBe('QRS')

    await change({ effect, text: 'UVW', version: 1 })
    const finalSource = source()
    const finalViewport = viewport()
    mounted.unmount()
    mounted = undefined
    expect(finalSource.style.opacity).toBe('')
    expect(finalViewport.textContent).toBe('')
    expect(finalViewport.getAttribute('aria-hidden')).toBeNull()
    expect(finalViewport.getAnimations({ subtree: true })).toEqual([])
  })
})

it('rolls in the direction from props', async () => {
  mounted = render(<Text effect="rolling" text="First" direction="down" />)
  await frames()
  await change({ effect: 'rolling', text: 'Second', direction: 'down' })
  seek(90)
  const row = Array.from(viewport().children).find(element => element.textContent === 'Second')!
  expect(row.getBoundingClientRect().top).toBeLessThan(source().getBoundingClientRect().top)
})

it('applies roulette blur and fade from props', async () => {
  mounted = render(<Text effect="roulette" text="ABC" duration={800} />)
  await frames()
  const styles = () => [...viewport().querySelectorAll('span')].map(el => getComputedStyle(el))
  await change({ effect: 'roulette', text: 'XYZ', duration: 800 })
  seek(120)
  expect(styles().every(style => style.filter === 'none' && style.maskImage === 'none')).toBe(true)
  await change({ effect: 'roulette', text: 'QRS', duration: 800, blur: 0.15, fade: 0.4 })
  seek(120)
  expect(styles().some(style => style.filter.startsWith('blur'))).toBe(true)
  expect(styles().some(style => style.maskImage.includes('linear-gradient'))).toBe(true)
})
