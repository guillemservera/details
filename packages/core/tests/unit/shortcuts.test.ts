import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createShortcutKeydownHandler,
  formatShortcutKey,
  formatShortcutLabel,
  formatShortcutTokens,
  isEditableTarget,
  matchesShortcutEvent,
  type ShortcutBinding,
} from '../../src/shortcuts'

// Node has no KeyboardEvent; the handler only reads these fields.
function keyboardEvent(key: string, init: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    defaultPrevented: false,
    target: null,
    preventDefault() {
      (this as { defaultPrevented: boolean }).defaultPrevented = true
    },
    ...init,
  } as KeyboardEvent
}

const input = (name = '') => ({ tagName: 'INPUT', isContentEditable: false, getAttribute: () => name }) as unknown as EventTarget

describe('matchesShortcutEvent', () => {
  it('resolves mod to Command on Apple platforms and Control elsewhere', () => {
    expect(matchesShortcutEvent(keyboardEvent('k', { metaKey: true }), 'mod_k', { platform: 'mac' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('k', { metaKey: true }), 'mod_k', { platform: 'ios' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('k', { ctrlKey: true }), 'mod_k', { platform: 'windows' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('k', { ctrlKey: true }), 'mod_k', { platform: 'linux' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('k', { metaKey: true }), 'mod_k', { platform: 'windows' })).toBe(false)
    expect(matchesShortcutEvent(keyboardEvent('k', { ctrlKey: true }), 'mod_k', { platform: 'mac' })).toBe(false)
  })

  it('keeps cmd and command as mod aliases', () => {
    expect(matchesShortcutEvent(keyboardEvent('k', { ctrlKey: true }), 'cmd_k', { platform: 'windows' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('k', { metaKey: true }), 'command_k', { platform: 'mac' })).toBe(true)
  })

  it('matches literal meta against metaKey on every platform', () => {
    for (const platform of ['mac', 'ios', 'windows', 'linux', 'chromeos', 'android', 'unknown'] as const) {
      expect(matchesShortcutEvent(keyboardEvent('k', { metaKey: true }), 'meta_k', { platform })).toBe(true)
      expect(matchesShortcutEvent(keyboardEvent('k', { ctrlKey: true }), 'meta_k', { platform })).toBe(false)
    }
  })

  it('requires exactly the modifiers in the binding', () => {
    expect(matchesShortcutEvent(keyboardEvent('P', { ctrlKey: true, shiftKey: true }), 'ctrl_shift_p', { platform: 'linux' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('p', { ctrlKey: true }), 'ctrl_shift_p', { platform: 'linux' })).toBe(false)
    expect(matchesShortcutEvent(keyboardEvent('k', { metaKey: true, ctrlKey: true }), 'mod_k', { platform: 'mac' })).toBe(false)
    expect(matchesShortcutEvent(keyboardEvent('k', { ctrlKey: true }), 'control_k', { platform: 'mac' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('f', { shiftKey: true }), 'f')).toBe(false)
    expect(matchesShortcutEvent(keyboardEvent('Escape'), 'esc')).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent(' '), 'space')).toBe(true)
  })

  it('matches produced symbols without rejecting shift', () => {
    expect(matchesShortcutEvent(keyboardEvent('?', { shiftKey: true }), '?', { platform: 'mac' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('?', { shiftKey: true, metaKey: true }), '?', { platform: 'mac' })).toBe(false)
    expect(matchesShortcutEvent(keyboardEvent('-'), '-')).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('-', { ctrlKey: true }), 'mod_-', { platform: 'windows' })).toBe(true)
  })

  it('falls back to the physical key when a modifier changes the produced character', () => {
    expect(matchesShortcutEvent(keyboardEvent('˚', { altKey: true, code: 'KeyK' }), 'alt_k', { platform: 'mac' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('л', { ctrlKey: true, code: 'KeyK' }), 'mod_k', { platform: 'linux' })).toBe(true)
    expect(matchesShortcutEvent(keyboardEvent('&', { code: 'Digit1' }), '1')).toBe(false)
  })

  it('never matches sequences or empty bindings', () => {
    expect(matchesShortcutEvent(keyboardEvent('g'), 'g-d')).toBe(false)
    expect(matchesShortcutEvent(keyboardEvent('g'), '  ')).toBe(false)
  })
})

describe('formatting', () => {
  it('labels mod, meta, ctrl, alt and shift per platform', () => {
    expect(formatShortcutLabel('mod_k', { platform: 'mac' })).toBe('⌘K')
    expect(formatShortcutLabel('mod_k', { platform: 'windows' })).toBe('Ctrl+K')
    expect(formatShortcutLabel('meta_k', { platform: 'mac' })).toBe('⌘K')
    expect(formatShortcutLabel('meta_k', { platform: 'ios' })).toBe('⌘K')
    expect(formatShortcutLabel('meta_k', { platform: 'windows' })).toBe('Win+K')
    expect(formatShortcutLabel('meta_k', { platform: 'linux' })).toBe('Super+K')
    expect(formatShortcutLabel('meta_k', { platform: 'chromeos' })).toBe('Super+K')
    expect(formatShortcutLabel('ctrl_alt_shift_p', { platform: 'mac' })).toBe('⌃⌥⇧P')
    expect(formatShortcutLabel('ctrl_option_shift_p', { platform: 'linux' })).toBe('Ctrl+Alt+Shift+P')
  })

  it('formats sequences, alternatives and named keys', () => {
    expect(formatShortcutLabel('g-s', { platform: 'mac' })).toBe('G then S')
    expect(formatShortcutLabel(['mod_k', '?'], { platform: 'windows', orLabel: 'o' })).toBe('Ctrl+K o ?')
    expect(formatShortcutLabel('alt_arrowdown', { platform: 'linux' })).toBe('Alt+↓')
    expect(formatShortcutLabel('g-d', { thenLabel: 'después' })).toBe('G después D')
    expect(formatShortcutLabel('')).toBe('')
  })

  it('formats single keys through one table', () => {
    const labels = ['ArrowUp', 'arrowdown', 'ArrowLeft', 'arrowright', 'Escape', 'esc', 'Enter', 'Backspace', 'Delete', 'Tab', ' ', 'space', 'f1', 'k', '?']
      .map(key => formatShortcutKey(key, { platform: 'linux' }))
    expect(labels).toEqual(['↑', '↓', '←', '→', 'Esc', 'Esc', 'Enter', 'Backspace', 'Delete', 'Tab', 'Space', 'Space', 'F1', 'K', '?'])
    expect(formatShortcutKey('mod', { platform: 'mac' })).toBe('⌘')
    expect(formatShortcutKey('mod', { platform: 'windows' })).toBe('Ctrl')
    expect(formatShortcutKey('option', { platform: 'mac' })).toBe('⌥')
  })

  it('emits typed tokens for separate kbd rendering', () => {
    expect(formatShortcutTokens('mod_k', { platform: 'windows' })).toEqual([
      { kind: 'key', key: 'mod', label: 'Ctrl' },
      { kind: 'plus', label: '+' },
      { kind: 'key', key: 'k', label: 'K' },
    ])
    expect(formatShortcutTokens(['mod_k', 'o-s'], { platform: 'mac' }).map(token => token.kind))
      .toEqual(['key', 'key', 'or', 'key', 'then', 'key'])
  })
})

describe('isEditableTarget', () => {
  it('recognizes form fields and contenteditable', () => {
    expect(isEditableTarget(input())).toBe(true)
    expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true)
    expect(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true)
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true)
    expect(isEditableTarget({ tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget)).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('createShortcutKeydownHandler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs sequences and resets them after the timeout', () => {
    vi.useFakeTimers()
    const action = vi.fn()
    const bindings: ShortcutBinding[] = [{ keys: 'g-s', handler: action }]
    const handler = createShortcutKeydownHandler(() => bindings, { sequenceTimeoutMs: 50 })

    handler.handleKeydown(keyboardEvent('g'))
    vi.advanceTimersByTime(51)
    handler.handleKeydown(keyboardEvent('s'))
    expect(action).not.toHaveBeenCalled()

    handler.handleKeydown(keyboardEvent('g'))
    handler.handleKeydown(keyboardEvent('s'))
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('runs sequences of three steps and claims intermediate keys', () => {
    const action = vi.fn()
    const handler = createShortcutKeydownHandler(() => [{ keys: 'a-b-c', handler: action }])
    const first = keyboardEvent('a')
    const second = keyboardEvent('b')

    handler.handleKeydown(first)
    handler.handleKeydown(second)
    handler.handleKeydown(keyboardEvent('c'))

    expect(action).toHaveBeenCalledTimes(1)
    expect(first.defaultPrevented).toBe(false)
    expect(second.defaultPrevented).toBe(true)
  })

  it('does not break a sequence when Shift is pressed to type a symbol', () => {
    const action = vi.fn()
    const handler = createShortcutKeydownHandler(() => [{ keys: 'g-?', handler: action }])

    handler.handleKeydown(keyboardEvent('g'))
    handler.handleKeydown(keyboardEvent('Shift', { shiftKey: true }))
    handler.handleKeydown(keyboardEvent('?', { shiftKey: true }))

    expect(action).toHaveBeenCalledTimes(1)
  })

  it('prefers an in-flight sequence over a single-key binding on the same trailing key', () => {
    const sequenceAction = vi.fn()
    const singleAction = vi.fn()
    const handler = createShortcutKeydownHandler(() => [
      { keys: 'f', handler: singleAction },
      { keys: 's-f', handler: sequenceAction },
    ])
    const completing = keyboardEvent('f')

    handler.handleKeydown(keyboardEvent('s'))
    handler.handleKeydown(completing)

    expect(sequenceAction).toHaveBeenCalledTimes(1)
    expect(singleAction).not.toHaveBeenCalled()
    expect(completing.defaultPrevented).toBe(true)
  })

  it('still runs a single-key binding when no sequence is in flight', () => {
    const sequenceAction = vi.fn()
    const singleAction = vi.fn()
    const handler = createShortcutKeydownHandler(() => [
      { keys: 'f', handler: singleAction },
      { keys: 's-f', handler: sequenceAction },
    ])
    const event = keyboardEvent('f')

    handler.handleKeydown(event)

    expect(singleAction).toHaveBeenCalledTimes(1)
    expect(sequenceAction).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('falls back to a single key when the next key does not continue the sequence', () => {
    const single = vi.fn()
    const handler = createShortcutKeydownHandler(() => [
      { keys: 'g-d', handler: vi.fn() },
      { keys: 'x', handler: single },
    ])

    handler.handleKeydown(keyboardEvent('g'))
    handler.handleKeydown(keyboardEvent('x'))

    expect(single).toHaveBeenCalledTimes(1)
  })

  it('matches alternatives and resolves mod with the platform option', () => {
    const action = vi.fn()
    const handler = createShortcutKeydownHandler(() => [{ keys: ['mod_k', '/'], handler: action }], { platform: 'windows' })

    handler.handleKeydown(keyboardEvent('k', { metaKey: true }))
    handler.handleKeydown(keyboardEvent('k', { ctrlKey: true }))
    handler.handleKeydown(keyboardEvent('/'))

    expect(action).toHaveBeenCalledTimes(2)
  })

  it('runs the highest priority binding, then list order', () => {
    const calls: string[] = []
    const handler = createShortcutKeydownHandler(() => [
      { keys: 'k', handler: () => calls.push('first') },
      { keys: 'k', handler: () => calls.push('second') },
      { keys: 'k', handler: () => calls.push('high'), priority: 1, enabled: () => calls.length === 0 },
    ])

    handler.handleKeydown(keyboardEvent('k'))
    handler.handleKeydown(keyboardEvent('k'))

    expect(calls).toEqual(['high', 'first'])
  })

  it('ignores editable targets unless usingInput allows them', () => {
    const blocked = vi.fn()
    const any = vi.fn()
    const named = vi.fn()
    const handler = createShortcutKeydownHandler(() => [
      { keys: 'f', handler: blocked },
      { keys: 'g', handler: any, usingInput: true },
      { keys: 'h', handler: named, usingInput: 'search' },
    ])

    handler.handleKeydown(keyboardEvent('f', { target: input() }))
    handler.handleKeydown(keyboardEvent('g', { target: input() }))
    handler.handleKeydown(keyboardEvent('h', { target: input('other') }))
    handler.handleKeydown(keyboardEvent('h', { target: input('search') }))

    expect(blocked).not.toHaveBeenCalled()
    expect(any).toHaveBeenCalledTimes(1)
    expect(named).toHaveBeenCalledTimes(1)
  })

  it('does not prime sequences from editable targets', () => {
    const action = vi.fn()
    const handler = createShortcutKeydownHandler(() => [{ keys: 'g-a', handler: action }])

    handler.handleKeydown(keyboardEvent('g', { target: input() }))
    handler.handleKeydown(keyboardEvent('a'))

    expect(action).not.toHaveBeenCalled()
  })

  it('ignores repeats and already claimed events unless configured otherwise', () => {
    const action = vi.fn()
    const handler = createShortcutKeydownHandler(() => [{ keys: 'f', handler: action }])

    handler.handleKeydown(keyboardEvent('f', { repeat: true }))
    handler.handleKeydown(keyboardEvent('f', { defaultPrevented: true }))
    expect(action).not.toHaveBeenCalled()

    createShortcutKeydownHandler(() => [{ keys: 'f', handler: action }], { respectDefaultPrevented: false })
      .handleKeydown(keyboardEvent('f', { defaultPrevented: true }))
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('lets consumers veto a shortcut before preventDefault runs', () => {
    const action = vi.fn()
    const shouldHandle = vi.fn(() => false)
    const handler = createShortcutKeydownHandler(() => [{ keys: '?', handler: action }], { shouldHandle })
    const event = keyboardEvent('?', { shiftKey: true })

    handler.handleKeydown(event)

    expect(action).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    expect(shouldHandle).toHaveBeenCalledWith(event, expect.objectContaining({ key: '?' }))
  })

  it('can leave the default action alone', () => {
    const handler = createShortcutKeydownHandler(() => [{ keys: 'f', handler: () => {} }], { preventDefault: false })
    const event = keyboardEvent('f')
    handler.handleKeydown(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
