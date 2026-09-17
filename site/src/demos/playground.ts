// Shared by the Vue and React playgrounds: both hook APIs take the same options, so the copy and snippets match.
export type PlaygroundMode = 'proximity' | 'keyboard' | 'compare'

export interface PlaygroundState {
  axis: 'x' | 'y'
  renderer: 'plain' | 'virtual'
  count: number
  keyboard: boolean
  resumeDistance: number
  loop: boolean
  whileHovered: boolean
  /** Forces reduced motion on the indicator; off follows the OS setting. */
  reducedMotion: boolean
}

export const DEFAULTS = { resumeDistance: 6, loop: false, whileHovered: true }
export const PLAIN_MAX = 10000
export const initialState: PlaygroundState = { axis: 'y', renderer: 'virtual', count: 10000, keyboard: true, reducedMotion: false, ...DEFAULTS }

export const axes = [{ value: 'y', label: 'y' }, { value: 'x', label: 'x' }] as const
export const renderers = (count: number) => [
  { value: 'plain', label: 'plain', disabled: count > PLAIN_MAX },
  { value: 'virtual', label: 'virtual' },
] as const
export const counts = [6, 100, 1000, 10000, 100000].map(value => ({ value, label: value.toLocaleString('en-US') }))

export const copy = {
  proximity: {
    title: 'useProximityHover',
    text: 'The item under the pointer, or the nearest one in gaps, is highlighted and one indicator glides to it.',
  },
  keyboard: {
    title: 'useArrowNavigation',
    text: 'Plain hover plus arrow keys. Hover the list and press ↑ ↓ (← → on x), Home, End; Enter clicks. No click needed. The mouse takes over again once it really moves.',
  },
  compare: {
    title: ':hover vs useProximityHover',
    text: 'Same list twice. Move slowly across the gaps: plain :hover blinks off between items, proximity hover never leaves one and glides.',
  },
}

export const itemLabel = (i: number) => `Item ${(i + 1).toLocaleString('en-US')}`

export function playgroundSnippet(mode: PlaygroundMode, s: PlaygroundState) {
  const opts = (o: (string | false)[]) => {
    const set = o.filter(Boolean)
    return set.length ? `, { ${set.join(', ')} }` : ''
  }
  const axis = s.axis === 'x' && `axis: 'x'`
  const resume = s.resumeDistance !== DEFAULTS.resumeDistance && `resumeDistance: ${s.resumeDistance}`
  const nav = `useArrowNavigation(list${opts([
    axis,
    s.loop && 'loop: true',
    !s.whileHovered && 'whileHovered: false',
    mode === 'keyboard' && resume,
    s.renderer === 'virtual' && 'count, scrollToIndex',
  ])})`
  if (mode === 'keyboard') return `${nav}\n\n/* CSS */\n[data-highlighted] { background: var(--chip) }`
  if (mode === 'compare') {
    return [
      '/* left: CSS only */',
      '.item:hover { background: var(--chip) }',
      '',
      '/* right */',
      `useProximityHover(list${opts([axis])})`,
      'useHighlightIndicator(list, indicator)',
    ].join('\n')
  }
  return [
    `useProximityHover(list${opts([axis, resume])})`,
    `useHighlightIndicator(list, indicator${opts([s.reducedMotion && 'reducedMotion: true'])})`,
    s.keyboard && nav,
  ].filter(Boolean).join('\n')
}

export const textExamples = ['Hello, world.', 'Small details. Big difference.', 'Café 👩🏽‍💻', '  Room to breathe.  ']
export const rouletteExamples = ['PLAY', 'PAUSE', 'JACKPOT 777', 'Café 👩🏽‍🚀', 'é  👨‍👩‍👧‍👦', '']
export const rouletteBurst = ['READY', 'ROLL', 'READY', 'GO 777', 'Café 👩🏽‍🚀']
export const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
