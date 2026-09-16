import { detectPlatform, isApplePlatform, type Platform } from '../platform'
import { normalizeKey, parseShortcut, type Stroke } from './parse'

export interface ShortcutBinding {
  /** Optional identifier for hosts that keep their own registry. */
  id?: string
  /** A binding or alternatives: `mod_k`, `g-d`, `?`, `['mod_k', '/']`. */
  keys: string | readonly string[]
  handler: (event: KeyboardEvent) => void
  /** `true` also fires inside editable targets; a string only inside the field with that `name`. */
  usingInput?: boolean | string
  /** A getter is read on every keystroke. Default `true`. */
  enabled?: boolean | (() => boolean)
  /** Higher wins when several bindings match; ties keep list order. Default `0`. */
  priority?: number
}

export interface ShortcutBindingMatch {
  binding: ShortcutBinding
  /** The alternative that matched. */
  key: string
}

export interface ShortcutKeydownHandlerOptions {
  /** Defaults to `detectPlatform()`, read on the first keydown. */
  platform?: Platform
  /** How long a partial sequence stays live. Default `900`. */
  sequenceTimeoutMs?: number
  /** Call `preventDefault()` on handled keys. Default `true`. */
  preventDefault?: boolean
  /** Skip events another listener already claimed. Default `true`. */
  respectDefaultPrevented?: boolean
  /** Final veto, called after a binding matched and passed its `enabled` and input checks. */
  shouldHandle?: (event: KeyboardEvent, match: ShortcutBindingMatch) => boolean
}

export interface ShortcutKeydownHandler {
  handleKeydown: (event: KeyboardEvent) => void
  /** Clears a partially typed sequence. */
  resetSequence: () => void
}

interface Entry extends ShortcutBindingMatch {
  strokes: Stroke[]
}

const BARE_MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta'])

/** Inputs, textareas, selects and contenteditable elements. */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  const element = target as HTMLElement | null | undefined
  return !!element && (/^(?:INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.isContentEditable === true)
}

function ignoresTarget(event: KeyboardEvent, usingInput: boolean | string | undefined): boolean {
  if (usingInput === true) return false
  // The first composed path entry sees through open shadow roots; `target` is retargeted to the host.
  const target = event.composedPath?.()[0] ?? event.target
  if (!isEditableTarget(target)) return false
  return typeof usingInput !== 'string' || (target as Element).getAttribute('name') !== usingInput
}

function eventKeyMatches(event: KeyboardEvent, key: string): boolean {
  const pressed = normalizeKey(event.key)
  if (pressed === key) return true
  // Option on macOS and non-Latin layouts change `key` for letters and digits in
  // modified combinations (⌥K yields `˚`); fall back to the physical key.
  return (event.altKey || event.ctrlKey || event.metaKey)
    && /^[a-z0-9]$/.test(key)
    && !/^[a-z0-9]$/.test(pressed)
    && (event.code === `Key${key.toUpperCase()}` || event.code === `Digit${key}`)
}

function matchesStroke(event: KeyboardEvent, { key, modifiers }: Stroke, platform: Platform): boolean {
  // Produced symbols such as `?` ignore Shift, which the layout may need to type them.
  if (!modifiers.length && key.length === 1 && !/[a-z0-9]/.test(key)) {
    return event.key === key && !event.metaKey && !event.ctrlKey && !event.altKey
  }
  const apple = isApplePlatform(platform)
  return eventKeyMatches(event, key)
    && event.metaKey === (modifiers.includes('meta') || (apple && modifiers.includes('mod')))
    && event.ctrlKey === (modifiers.includes('ctrl') || (!apple && modifiers.includes('mod')))
    && event.altKey === modifiers.includes('alt')
    && event.shiftKey === modifiers.includes('shift')
}

/** Whether one keydown matches one combination or single key. Sequences never match. */
export function matchesShortcutEvent(event: KeyboardEvent, shortcut: string, options: { platform?: Platform } = {}): boolean {
  const strokes = parseShortcut(shortcut)
  return strokes.length === 1 && matchesStroke(event, strokes[0]!, options.platform ?? detectPlatform())
}

/**
 * Matches keydown events against bindings, including sequences. Attach `handleKeydown`
 * to any listener; bindings are read on every keystroke.
 */
export function createShortcutKeydownHandler(
  getBindings: () => readonly ShortcutBinding[],
  options: ShortcutKeydownHandlerOptions = {},
): ShortcutKeydownHandler {
  let platform = options.platform
  let buffer: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  function resetSequence(): void {
    buffer = []
    clearTimeout(timer)
    timer = undefined
  }

  function bufferSequence(next: string[]): void {
    buffer = next
    clearTimeout(timer)
    timer = setTimeout(resetSequence, options.sequenceTimeoutMs ?? 900)
  }

  function claim(event: KeyboardEvent): void {
    if (options.preventDefault !== false) event.preventDefault()
  }

  function canBuffer(event: KeyboardEvent, { binding }: Entry): boolean {
    const enabled = typeof binding.enabled === 'function' ? binding.enabled() : binding.enabled ?? true
    return enabled && !ignoresTarget(event, binding.usingInput)
  }

  function allowed(event: KeyboardEvent, entry: Entry): boolean {
    return options.shouldHandle?.(event, { binding: entry.binding, key: entry.key }) ?? true
  }

  function run(event: KeyboardEvent, entry: Entry): void {
    resetSequence()
    claim(event)
    entry.binding.handler(event)
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.repeat || BARE_MODIFIER_KEYS.has(event.key)) return
    if ((options.respectDefaultPrevented ?? true) && event.defaultPrevented) return
    platform ??= detectPlatform()

    const entries: Entry[] = getBindings()
      .flatMap(binding => (typeof binding.keys === 'string' ? [binding.keys] : binding.keys)
        .map(key => ({ binding, key, strokes: parseShortcut(key) })))
      .sort((a, b) => (b.binding.priority ?? 0) - (a.binding.priority ?? 0))

    const runSingle = (): boolean => {
      const entry = entries.find(entry => entry.strokes.length === 1
        && matchesStroke(event, entry.strokes[0]!, platform!)
        && canBuffer(event, entry)
        && allowed(event, entry))
      if (entry) run(event, entry)
      return !!entry
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      if (!runSingle()) resetSequence()
      return
    }

    const sequences = entries.filter(entry => entry.strokes.length > 1 && canBuffer(event, entry))
    const key = normalizeKey(event.key)

    // An in-flight sequence wins over a single-key binding on its next key (`s-f` over `f`).
    if (buffer.length) {
      const next = [...buffer, key]
      const continues = (entry: Entry) => next.every((part, index) => entry.strokes[index]?.key === part)
      const complete = sequences.find(entry => entry.strokes.length === next.length && continues(entry) && allowed(event, entry))
      if (complete) return run(event, complete)
      if (sequences.some(entry => entry.strokes.length > next.length && continues(entry))) {
        bufferSequence(next)
        claim(event)
        return
      }
      resetSequence()
    }

    if (runSingle()) return
    if (sequences.some(entry => entry.strokes[0]!.key === key)) bufferSequence([key])
  }

  return { handleKeydown, resetSequence }
}
