import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, nextTick, shallowRef } from 'vue'
import type { ShortcutBinding } from '@guillemservera/details-core/shortcuts'
import { useShortcuts, type ShortcutsOptions } from '../../src/shortcuts/useShortcuts'
import { mount, wait } from './helpers'

let mounted: ReturnType<typeof mount> | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  document.body.replaceChildren()
})

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init })
  target.dispatchEvent(event)
  return event
}

function mountShortcuts(bindings: Parameters<typeof useShortcuts>[0], options: ShortcutsOptions = {}) {
  mounted = mount(defineComponent(() => {
    useShortcuts(bindings, { platform: 'linux', ...options })
    return () => h('div')
  }))
  return nextTick()
}

describe('useShortcuts', () => {
  it('listens on window after mount and stops on unmount', async () => {
    const action = vi.fn()
    let beforeMount: KeyboardEvent | undefined
    mounted = mount(defineComponent(() => {
      useShortcuts([{ keys: 'mod_k', handler: action }], { platform: 'linux' })
      beforeMount = press(window, 'k', { ctrlKey: true })
      return () => h('div')
    }))
    expect(beforeMount!.defaultPrevented).toBe(false)
    await nextTick()

    expect(press(document.body, 'k', { ctrlKey: true }).defaultPrevented).toBe(true)
    press(document.body, 'k', { metaKey: true })
    expect(action).toHaveBeenCalledTimes(1)

    mounted.unmount()
    mounted = undefined
    press(document.body, 'k', { ctrlKey: true })
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('stops when its effect scope is stopped', async () => {
    const action = vi.fn()
    const scope = effectScope()
    scope.run(() => useShortcuts([{ keys: '?', handler: action }]))
    await nextTick()
    press(window, '?', { shiftKey: true })
    scope.stop()
    press(window, '?', { shiftKey: true })
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('reads reactive bindings and enabled getters on every keystroke', async () => {
    const first = vi.fn()
    const second = vi.fn()
    let enabled = false
    const bindings = shallowRef<ShortcutBinding[]>([{ keys: 'f', handler: first, enabled: () => enabled }])
    await mountShortcuts(bindings)

    press(document.body, 'f')
    enabled = true
    press(document.body, 'f')
    bindings.value = [{ keys: 'f', handler: second }]
    press(document.body, 'f')

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('runs sequences within the timeout', async () => {
    const action = vi.fn()
    await mountShortcuts([{ keys: 'g-d', handler: action }], { sequenceTimeoutMs: 50 })

    press(document.body, 'g')
    press(document.body, 'd')
    press(document.body, 'g')
    await wait(80)
    press(document.body, 'd')

    expect(action).toHaveBeenCalledTimes(1)
  })

  it('ignores editable targets unless usingInput allows them', async () => {
    const blocked = vi.fn()
    const allowed = vi.fn()
    await mountShortcuts([
      { keys: 'f', handler: blocked },
      { keys: 'escape', handler: allowed, usingInput: true },
    ])
    const input = document.body.appendChild(document.createElement('input'))

    press(input, 'f')
    press(input, 'Escape')

    expect(blocked).not.toHaveBeenCalled()
    expect(allowed).toHaveBeenCalledTimes(1)
  })

  it('moves to a new target and clears a partial sequence', async () => {
    const action = vi.fn()
    const a = document.body.appendChild(document.createElement('div'))
    const b = document.body.appendChild(document.createElement('div'))
    const target = shallowRef<EventTarget | null>(a)
    await mountShortcuts([{ keys: 'g-d', handler: action }], { target })

    press(document.body, 'g')
    press(document.body, 'd')
    expect(action).not.toHaveBeenCalled()

    press(a, 'g')
    target.value = b
    await nextTick()
    press(b, 'd')
    press(a, 'g')
    press(a, 'd')
    expect(action).not.toHaveBeenCalled()

    press(b, 'g')
    press(b, 'd')
    expect(action).toHaveBeenCalledTimes(1)

    target.value = null
    await nextTick()
    press(b, 'g')
    press(b, 'd')
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('listens in the bubble phase with capture: false', async () => {
    const action = vi.fn()
    const target = document.body.appendChild(document.createElement('div'))
    const child = target.appendChild(document.createElement('button'))
    child.addEventListener('keydown', event => event.preventDefault())
    await mountShortcuts([{ keys: 'f', handler: action }], { target, capture: false })

    press(child, 'f')
    expect(action).not.toHaveBeenCalled()
  })
})
