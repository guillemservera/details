import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { useHighlightIndicator } from '../../src/highlight-indicator/useHighlightIndicator'
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
})
