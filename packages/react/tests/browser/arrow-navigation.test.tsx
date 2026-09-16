import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { useArrowNavigation, type ArrowNavigationOptions } from '../../src/arrow-navigation/useArrowNavigation'
import { highlighted, Item, render, user, type Rendered } from './helpers'

let mounted: Rendered | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
})

function List({ show = true, version = 0, ...options }: ArrowNavigationOptions & { show?: boolean, version?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useArrowNavigation(ref, options)
  if (!show) return null
  return (
    <div key={version} ref={ref} tabIndex={0}>
      <Item label={`A${version}`} />
      <Item label={`B${version}`} />
    </div>
  )
}

const list = () => mounted!.host.querySelector<HTMLElement>('[tabindex="0"]')!

describe('lifecycle', () => {
  it('attaches to a container rendered later', async () => {
    mounted = render(<List show={false} />)
    mounted.rerender(<List />)
    list().focus()
    await user(() => userEvent.keyboard('{ArrowDown}'))
    expect(highlighted(list())).toBe('A0')
  })

  it('moves to a replaced container and stops listening to the old one', async () => {
    mounted = render(<List />)
    const old = list()
    mounted.rerender(<List version={1} />)
    const current = list()
    expect(current).not.toBe(old)
    old.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(highlighted(old)).toBeNull()
    expect(highlighted(current)).toBeNull()
    current.focus()
    await user(() => userEvent.keyboard('{ArrowDown}'))
    expect(highlighted(current)).toBe('A1')
  })

  it('reads option props live without re-creating', async () => {
    mounted = render(<List />)
    list().focus()
    await user(() => userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}'))
    expect(highlighted(list())).toBe('B0')
    mounted.rerender(<List loop />)
    // Re-creating would have cleared the highlight.
    expect(highlighted(list())).toBe('B0')
    await user(() => userEvent.keyboard('{ArrowDown}'))
    expect(highlighted(list())).toBe('A0')
  })

  it('reads the latest scrollToIndex', async () => {
    const calls: string[] = []
    mounted = render(<List count={10} scrollToIndex={i => calls.push(`first ${i}`)} />)
    mounted.rerender(<List count={10} scrollToIndex={i => calls.push(`second ${i}`)} />)
    list().focus()
    await user(() => userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}'))
    // Index 0 scrolls to the start without it; the unrendered 1 and 2 need it.
    expect(calls).toEqual(['second 1', 'second 2'])
  })
})
