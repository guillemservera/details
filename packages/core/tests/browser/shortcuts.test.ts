import { afterEach, describe, expect, it, vi } from 'vitest'

import { createShortcutKeydownHandler, type ShortcutBinding } from '../../src/shortcuts'

function listen(bindings: ShortcutBinding[]) {
  const handler = createShortcutKeydownHandler(() => bindings, { platform: 'linux' })
  window.addEventListener('keydown', handler.handleKeydown, { capture: true })
  return () => window.removeEventListener('keydown', handler.handleKeydown, { capture: true })
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('shortcuts in the browser', () => {
  let stop = () => {}

  afterEach(() => {
    stop()
    document.body.replaceChildren()
  })

  it('ignores inputs, textareas, selects and contenteditable unless usingInput allows them', () => {
    const blocked = vi.fn()
    const allowed = vi.fn()
    stop = listen([
      { keys: 'f', handler: blocked },
      { keys: 'mod_k', handler: allowed, usingInput: true },
    ])
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    const child = document.createElement('span')
    editable.append(child)
    const fields = [document.createElement('input'), document.createElement('textarea'), document.createElement('select'), child]
    document.body.append(...fields.slice(0, 3), editable)

    for (const field of fields) {
      press(field, 'f')
      press(field, 'k', { ctrlKey: true })
    }
    press(document.body, 'f')

    expect(blocked).toHaveBeenCalledTimes(1)
    expect(allowed).toHaveBeenCalledTimes(fields.length)
  })

  it('limits usingInput strings to the named field', () => {
    const action = vi.fn()
    stop = listen([{ keys: 'escape', handler: action, usingInput: 'search' }])
    const search = Object.assign(document.createElement('input'), { name: 'search' })
    const other = Object.assign(document.createElement('input'), { name: 'email' })
    document.body.append(search, other)

    press(other, 'Escape')
    const event = press(search, 'Escape')

    expect(action).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('sees editable fields inside open shadow roots', () => {
    const action = vi.fn()
    stop = listen([{ keys: 'f', handler: action }])
    const host = document.createElement('div')
    const field = document.createElement('input')
    host.attachShadow({ mode: 'open' }).append(field)
    document.body.append(host)

    press(field, 'f')

    expect(action).not.toHaveBeenCalled()
  })
})
