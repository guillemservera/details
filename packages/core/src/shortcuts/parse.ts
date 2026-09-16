export type Modifier = 'mod' | 'meta' | 'ctrl' | 'alt' | 'shift'

/** One key press: a key plus the modifiers held with it. */
export interface Stroke {
  key: string
  modifiers: Modifier[]
}

export const MODIFIERS = new Map<string, Modifier>([
  ['mod', 'mod'],
  ['cmd', 'mod'],
  ['command', 'mod'],
  ['meta', 'meta'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['alt', 'alt'],
  ['option', 'alt'],
  ['shift', 'shift'],
])

/** Maps a `KeyboardEvent.key` or a binding part to the lowercase binding vocabulary. */
export function normalizeKey(key: string): string {
  if (key === ' ') return 'space'
  const lower = key.toLowerCase()
  return lower === 'esc' ? 'escape' : lower
}

/**
 * Parses a binding: `_` joins a combination (`mod_k`), `-` joins a sequence (`g-d`).
 * A single character is always one key, so `-`, `_` and `?` are valid bindings.
 */
export function parseShortcut(shortcut: string): Stroke[] {
  const value = shortcut.trim().toLowerCase()
  if (value.length <= 1) return value ? [{ key: value, modifiers: [] }] : []

  const parts = value.split('_').filter(Boolean)
  const modifiers = parts.slice(0, -1).flatMap(part => MODIFIERS.get(part) ?? [])
  if (modifiers.length) return [{ key: normalizeKey(parts.at(-1)!), modifiers }]

  return value.split('-').filter(Boolean).map(key => ({ key: normalizeKey(key), modifiers: [] }))
}
