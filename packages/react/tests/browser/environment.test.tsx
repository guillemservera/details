import { act, useState } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { detectPlatform } from '@guillemservera/details-core/platform'
import { useInputCapabilities } from '../../src/input-capabilities/useInputCapabilities'
import { usePlatform } from '../../src/platform/usePlatform'
import { useShortcuts, type ShortcutsOptions } from '../../src/shortcuts/useShortcuts'
import { render, type Rendered } from './helpers'

let mounted: Rendered | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  vi.restoreAllMocks()
})

describe('usePlatform and useInputCapabilities', () => {
  it('hydrate with the server values, then render the client values', async () => {
    const seen: string[] = []
    function Probe() {
      const platform = usePlatform()
      const { canHover } = useInputCapabilities()
      seen.push(`${platform} ${canHover}`)
      return <span>{platform}</span>
    }
    const host = document.body.appendChild(document.createElement('div'))
    host.append(...new DOMParser().parseFromString(renderToString(<Probe />), 'text/html').body.childNodes)
    expect(host.textContent).toBe('unknown')
    seen.length = 0
    const root = await act(() => hydrateRoot(host, <Probe />))
    expect(detectPlatform()).not.toBe('unknown')
    expect(seen[0]).toBe('unknown false')
    expect(seen.at(-1)).toBe(`${detectPlatform()} ${matchMedia('(any-hover: hover)').matches}`)
    expect(host.textContent).toBe(detectPlatform())
    act(() => root.unmount())
    host.remove()
  })

  it('render the client values at once without hydration', () => {
    let platform: string | undefined
    function Probe() {
      platform = usePlatform()
      return null
    }
    mounted = render(<Probe />)
    expect(platform).toBe(detectPlatform())
  })
})

describe('useShortcuts', () => {
  const press = (key: string) => act(() => userEvent.keyboard(key))
  const dispatch = (target: EventTarget) => act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true })))
  const dispatchWith = (target: EventTarget, init: KeyboardEventInit) =>
    act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, ...init })))

  function Shortcuts({ label, ...options }: ShortcutsOptions & { label: string }) {
    const [log, setLog] = useState<string[]>([])
    useShortcuts([
      { keys: 'k', handler: () => setLog(entries => [...entries, label]) },
      { keys: 'g-d', handler: () => setLog(entries => [...entries, `${label} sequence`]) },
    ], options)
    return <output>{log.join(',')}</output>
  }
  const log = () => mounted!.host.querySelector('output')!.textContent
  const keydowns = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter(([type]) => type === 'keydown').length

  it('fires the latest bindings without re-attaching, and stops on unmount', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    mounted = render(<Shortcuts label="first" />, { strict: true })
    await press('k')
    expect(log()).toBe('first')
    mounted.rerender(<Shortcuts label="second" />)
    await press('gd')
    expect(log()).toBe('first,second sequence')
    const attached = keydowns(add)
    mounted.rerender(<Shortcuts label="third" />)
    expect(keydowns(add)).toBe(attached)

    const remove = vi.spyOn(window, 'removeEventListener')
    mounted.unmount()
    mounted = undefined
    expect(keydowns(remove)).toBe(1)
    await press('k')
  })

  it('moves to a new target and listens nowhere with null', async () => {
    const div = document.body.appendChild(document.createElement('div'))
    mounted = render(<Shortcuts label="window" />)
    mounted.rerender(<Shortcuts label="panel" target={div} />)
    await press('k')
    expect(log()).toBe('')
    dispatch(div)
    expect(log()).toBe('panel')
    mounted.rerender(<Shortcuts label="panel" target={null} />)
    dispatch(div)
    await press('k')
    expect(log()).toBe('panel')
    div.remove()
  })

  it('updates mod matching when the platform override changes', () => {
    const handler = vi.fn()
    function ModShortcut({ platform }: ShortcutsOptions) {
      useShortcuts([{ keys: 'mod_k', handler }], { platform })
      return null
    }
    mounted = render(<ModShortcut platform="unknown" />)
    dispatchWith(window, { ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)

    mounted.rerender(<ModShortcut platform="mac" />)
    dispatchWith(window, { ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
    dispatchWith(window, { metaKey: true })
    expect(handler).toHaveBeenCalledTimes(2)
  })
})
