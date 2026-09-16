import { detectPlatform, isApplePlatform, type Platform } from '../platform'
import { MODIFIERS, normalizeKey, parseShortcut, type Modifier } from './parse'

export interface ShortcutFormatOptions {
  /** Defaults to `detectPlatform()`. */
  platform?: Platform
  /** Word between alternative bindings (default `'or'`). */
  orLabel?: string
  /** Word between the steps of a sequence (default `'then'`). */
  thenLabel?: string
}

export type ShortcutToken =
  /** `key` is the normalized binding name (`mod`, `arrowup`, `k`), for icons or accessible names. */
  | { kind: 'key', key: string, label: string }
  | { kind: 'plus' | 'then' | 'or', label: string }

const KEY_LABELS = new Map([
  ['arrowup', '↑'],
  ['arrowdown', '↓'],
  ['arrowleft', '←'],
  ['arrowright', '→'],
  ['escape', 'Esc'],
  ['enter', 'Enter'],
  ['backspace', 'Backspace'],
  ['delete', 'Delete'],
  ['tab', 'Tab'],
  ['space', 'Space'],
  ['pageup', 'PgUp'],
  ['pagedown', 'PgDn'],
])

function modifierLabel(modifier: Modifier, platform: Platform): string {
  const apple = isApplePlatform(platform)
  switch (modifier) {
    case 'mod': return apple ? '⌘' : 'Ctrl'
    case 'meta': return apple ? '⌘' : platform === 'windows' ? 'Win' : 'Super'
    case 'ctrl': return apple ? '⌃' : 'Ctrl'
    case 'alt': return apple ? '⌥' : 'Alt'
    case 'shift': return apple ? '⇧' : 'Shift'
  }
}

/** Display label for a single key or modifier name, e.g. `arrowup` → `↑`, `mod` → `⌘` or `Ctrl`. */
export function formatShortcutKey(key: string, options: Pick<ShortcutFormatOptions, 'platform'> = {}): string {
  const name = normalizeKey(key)
  const modifier = MODIFIERS.get(name)
  if (modifier) return modifierLabel(modifier, options.platform ?? detectPlatform())
  return KEY_LABELS.get(name) ?? (key.length === 1 ? key.toUpperCase() : name.charAt(0).toUpperCase() + name.slice(1))
}

/**
 * Splits one binding or a list of alternatives into display tokens. Apple platforms
 * join a combination without separators; others put a `plus` token between keys.
 */
export function formatShortcutTokens(keys: string | readonly string[], options: ShortcutFormatOptions = {}): ShortcutToken[] {
  const platform = options.platform ?? detectPlatform()
  const tokens: ShortcutToken[] = []

  for (const shortcut of typeof keys === 'string' ? [keys] : keys) {
    const strokes = parseShortcut(shortcut)
    if (!strokes.length) continue
    if (tokens.length) tokens.push({ kind: 'or', label: options.orLabel ?? 'or' })

    strokes.forEach((stroke, index) => {
      if (index) tokens.push({ kind: 'then', label: options.thenLabel ?? 'then' })
      ;[...stroke.modifiers, stroke.key].forEach((key, keyIndex) => {
        if (keyIndex && !isApplePlatform(platform)) tokens.push({ kind: 'plus', label: '+' })
        tokens.push({ kind: 'key', key, label: formatShortcutKey(key, { platform }) })
      })
    })
  }
  return tokens
}

/** One readable string, e.g. `⌘K`, `Ctrl+Shift+P`, `G then D`, `⌘K or ?`. */
export function formatShortcutLabel(keys: string | readonly string[], options: ShortcutFormatOptions = {}): string {
  return formatShortcutTokens(keys, options)
    .map(token => token.kind === 'then' || token.kind === 'or' ? ` ${token.label} ` : token.label)
    .join('')
}
