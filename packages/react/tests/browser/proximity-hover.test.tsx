import { useRef, type RefObject } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createHighlightStore } from '@guillemservera/details-core/proximity-hover'
import { useArrowNavigation } from '../../src/arrow-navigation/useArrowNavigation'
import { useProximityHover } from '../../src/proximity-hover/useProximityHover'
import { sharedStore, type HighlightState } from '../../src/shared/highlight'
import { useHighlightStore as useArrowStore } from '../../src/arrow-navigation'
import { useHighlightStore } from '../../src/proximity-hover'
import { frames, highlighted, Item, render, user, type Rendered } from './helpers'

let mounted: Rendered | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

let hover: HighlightState
let keys: HighlightState
let ref: RefObject<HTMLDivElement | null>

function Menu({ version = 0, extra = true }: { version?: number, extra?: boolean }) {
  ref = useRef<HTMLDivElement>(null)
  hover = useProximityHover(ref)
  keys = useArrowNavigation(ref)
  return (
    <div key={version} ref={ref} tabIndex={0}>
      {extra && <Extra container={ref} />}
      <Item label="A" />
      <Item label="B" />
    </div>
  )
}

// A second hook instance on the same ref, in a child that can unmount on its own.
function Extra({ container }: { container: RefObject<HTMLDivElement | null> }) {
  useProximityHover(container)
  return null
}

async function expectPointerAndKeyboard() {
  const el = ref.current!
  await user(() => userEvent.hover(el.querySelectorAll('button')[1]!))
  await user(() => frames())
  expect(hover.highlighted?.textContent).toBe('B')
  expect(hover.source).toBe('pointer')
  expect(keys.highlighted).toBe(hover.highlighted)
  el.focus()
  await user(() => userEvent.keyboard('{ArrowUp}'))
  expect(highlighted(el)).toBe('A')
  expect(hover.source).toBe('keyboard')
  expect(keys.source).toBe('keyboard')
}

describe('useProximityHover', () => {
  it('shares state between hooks on the same ref and keeps pointer ownership until the last instance unmounts', async () => {
    mounted = render(<Menu />)
    await expectPointerAndKeyboard()
    const store = sharedStore(ref, createHighlightStore)
    expect(store.pointerClaimed()).toBe(true)
    mounted.rerender(<Menu extra={false} />)
    expect(store.pointerClaimed()).toBe(true)
    mounted.unmount()
    mounted = undefined
    expect(store.pointerClaimed()).toBe(false)
    expect(store.highlighted).toBeNull()
  })

  it('mounts once under StrictMode', async () => {
    mounted = render(<Menu />, { strict: true })
    await expectPointerAndKeyboard()
    const store = sharedStore(ref, createHighlightStore)
    mounted.rerender(<Menu extra={false} />)
    expect(store.pointerClaimed()).toBe(true)
    mounted.unmount()
    mounted = undefined
    expect(store.pointerClaimed()).toBe(false)
  })

  it('follows a replaced container with the same store', async () => {
    mounted = render(<Menu />)
    const store = sharedStore(ref, createHighlightStore)
    const old = ref.current!
    mounted.rerender(<Menu version={1} />)
    expect(ref.current).not.toBe(old)
    await expectPointerAndKeyboard()
    expect(sharedStore(ref, createHighlightStore)).toBe(store)
  })

  it('passes ignore through and shares one store across entries', async () => {
    let stores: unknown[] = []
    let hover: ReturnType<typeof useProximityHover> | undefined
    function List() {
      const el = useRef<HTMLDivElement>(null)
      hover = useProximityHover(el, { ignore: '[data-label]' })
      stores = [useHighlightStore(el).store, useArrowStore(el).store, sharedStore(el, createHighlightStore)]
      return (
        <div ref={el} className="list">
          <div data-label="" style={{ height: 30 }}>Label</div>
          <Item label="A" />
        </div>
      )
    }
    mounted = render(<List />)
    expect(new Set(stores).size).toBe(1)
    const el = mounted.host.querySelector<HTMLElement>('.list')!
    await user(() => userEvent.hover(el.querySelector('[data-label]')!))
    await user(() => frames())
    expect(highlighted(el)).toBeNull()
    await user(() => userEvent.hover(el.querySelector('button')!))
    expect(highlighted(el)).toBe('A')
    hover!.remeasure()
  })
})
