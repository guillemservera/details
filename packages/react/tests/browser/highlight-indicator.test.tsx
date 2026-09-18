import { useRef, type RefObject } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { useHighlightIndicator, useHighlightStore, type HighlightIndicatorControls, type HighlightStoreState } from '../../src/highlight-indicator'
import { useProximityHover } from '../../src/proximity-hover/useProximityHover'
import { beforePaint, Item, render, user, wait, type Rendered } from './helpers'

let mounted: Rendered | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

function offsetOf(a: Element, b: Element) {
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  return Math.abs(ra.top - rb.top) + Math.abs(ra.height - rb.height)
}

describe('useHighlightIndicator', () => {
  it('stays on the highlighted item in the same frame while content scrolls under the pointer', async () => {
    let renders = 0
    function List() {
      renders++
      const el = useRef<HTMLDivElement>(null)
      const indicator = useRef<HTMLDivElement>(null)
      useProximityHover(el)
      useHighlightIndicator(el, indicator)
      return (
        <div ref={el} className="list" style={{ position: 'relative', height: 200, overflow: 'auto' }}>
          <div ref={indicator} className="indicator" style={{ position: 'absolute', top: 0, left: 0 }} />
          {Array.from({ length: 30 }, (_, i) => <Item key={i} label={String(i)} />)}
        </div>
      )
    }
    mounted = render(<List />, { strict: true })
    const el = mounted.host.querySelector<HTMLElement>('.list')!
    const indicator = mounted.host.querySelector<HTMLElement>('.indicator')!
    await user(() => userEvent.hover(el.querySelectorAll('button')[2]!))
    await wait(200)
    const settledRenders = renders
    await wait(200)
    // The spring writes styles directly: no renders while nothing changes.
    expect(renders).toBe(settledRenders)
    for (let step = 0; step < 5; step++) {
      el.scrollTop += 90
      await beforePaint()
      expect(offsetOf(indicator, el.querySelector('[data-highlighted]')!)).toBeLessThan(1)
    }
  })

  it('releases the indicator when it is removed and attaches a late one', async () => {
    function Tabs({ show }: { show: boolean }) {
      const el = useRef<HTMLDivElement>(null)
      const indicator = useRef<HTMLDivElement>(null)
      useHighlightIndicator(el, indicator, { target: '[aria-selected="true"]' })
      return <div ref={el} style={{ position: 'relative' }}>{show && <div ref={indicator} className="indicator" />}</div>
    }
    mounted = render(<Tabs show={false} />)
    mounted.rerender(<Tabs show />)
    const old = mounted.host.querySelector('.indicator')!
    expect(old.hasAttribute('data-highlight-indicator')).toBe(true)
    mounted.rerender(<Tabs show={false} />)
    expect(old.hasAttribute('data-highlight-indicator')).toBe(false)
  })

  it('tracks indexed items, removal and container replacement without pointer or keyboard hooks', async () => {
    let state!: HighlightStoreState
    function List({ show = true, version = 0 }) {
      const el = useRef<HTMLDivElement>(null)
      const indicator = useRef<HTMLDivElement>(null)
      useHighlightIndicator(el, indicator)
      state = useHighlightStore(el)
      return (
        <div key={version} ref={el} style={{ position: 'relative' }}>
          <div ref={indicator} style={{ position: 'absolute', top: 0, left: 0 }} />
          {show && <Item label="A" data-index="0" />}
        </div>
      )
    }
    mounted = render(<List />, { strict: true })
    const a = mounted.host.querySelector('button')!
    await user(async () => state.store.highlightIndex(0, 'keyboard'))
    expect(state.highlighted).toBe(a)
    expect(a.hasAttribute('data-highlighted')).toBe(true)

    await user(async () => mounted!.rerender(<List show={false} />))
    expect(state.highlighted).toBeNull()

    mounted.rerender(<List version={1} />)
    const replacement = mounted.host.querySelector('button')!
    await user(async () => state.store.highlightIndex(0, 'keyboard'))
    expect(state.highlighted).toBe(replacement)
    expect(replacement.hasAttribute('data-highlighted')).toBe(true)

    const { store } = state
    mounted.unmount()
    mounted = undefined
    expect(store.highlighted).toBeNull()
    expect(replacement.hasAttribute('data-highlighted')).toBe(false)
  })

  it('reads the latest reducedMotion prop, keeps remeasure stable and exposes the shared store', async () => {
    let controls: HighlightIndicatorControls | undefined
    let state!: ReturnType<typeof useHighlightStore>
    let list!: RefObject<HTMLDivElement | null>
    const seen = new Set<unknown>()
    function Tabs({ active, reduced }: { active: number, reduced?: boolean }) {
      list = useRef<HTMLDivElement>(null)
      const indicator = useRef<HTMLDivElement>(null)
      controls = useHighlightIndicator(list, indicator, { target: '[data-active]', reducedMotion: reduced })
      seen.add(controls.remeasure)
      state = useHighlightStore(list)
      return (
        <div className="zoom" style={{ transformOrigin: '0 0' }}>
          <div ref={list} style={{ position: 'relative' }}>
            <div ref={indicator} className="indicator" style={{ position: 'absolute', top: 0, left: 0 }} />
            {[0, 1].map(i => <Item key={i} label={String(i)} data-active={active === i ? '' : undefined} />)}
          </div>
        </div>
      )
    }
    mounted = render(<Tabs active={0} reduced />)
    const indicator = mounted.host.querySelector<HTMLElement>('.indicator')!
    const rows = mounted.host.querySelectorAll('button')
    await wait(50)
    mounted.rerender(<Tabs active={1} reduced />)
    await beforePaint()
    expect(offsetOf(indicator, rows[1]!)).toBeLessThan(1)
    mounted.rerender(<Tabs active={0} />)
    await beforePaint()
    expect(offsetOf(indicator, rows[0]!)).toBeGreaterThan(1)
    await wait(250)
    const zoom = mounted.host.querySelector<HTMLElement>('.zoom')!
    zoom.style.transform = 'scale(0.5)'
    controls!.remeasure()
    await wait(250)
    zoom.style.transform = 'none'
    await wait(50)
    expect(offsetOf(indicator, rows[0]!)).toBeGreaterThan(1)
    controls!.remeasure()
    await wait(250)
    expect(offsetOf(indicator, rows[0]!)).toBeLessThan(1)
    expect(seen.size).toBe(1)
    await user(async () => state.store.highlight(rows[1] as HTMLElement, 'keyboard'))
    expect(state.highlighted).toBe(rows[1])
    expect(state.source).toBe('keyboard')
    expect(list.current).toBeTruthy()
  })
  it('freezes the current paint and destroys cleanly', async () => {
    let controls!: HighlightIndicatorControls
    function Tabs({ active }: { active: number }) {
      const list = useRef<HTMLDivElement>(null)
      const indicator = useRef<HTMLDivElement>(null)
      controls = useHighlightIndicator(list, indicator, { target: '[data-active]' })
      return (
        <div ref={list} style={{ position: 'relative' }}>
          <div ref={indicator} className="indicator" style={{ position: 'absolute', top: 0, left: 0 }} />
          {[0, 1].map(i => <Item key={i} label={String(i)} data-active={active === i ? '' : undefined} />)}
        </div>
      )
    }
    mounted = render(<Tabs active={0} />)
    await wait(100)
    const old = mounted.host.querySelector<HTMLElement>('.indicator')!
    const paint = [getComputedStyle(old).opacity, getComputedStyle(old).transform, getComputedStyle(old).width, getComputedStyle(old).height]
    controls.freeze()
    controls.freeze()
    mounted.rerender(<Tabs active={1} />)
    await beforePaint()
    expect([getComputedStyle(old).opacity, getComputedStyle(old).transform, getComputedStyle(old).width, getComputedStyle(old).height]).toEqual(paint)
    mounted.unmount()
    mounted = undefined
    expect(old.style.opacity).toBe('')
    expect(old.style.transform).toBe('')
    expect(old.style.width).toBe('')
    expect(old.style.height).toBe('')
  })

})
