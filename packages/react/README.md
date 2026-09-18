# react-details

Tiny hooks for polished React interfaces.

The little interaction details React doesn't handle for you: proximity hover, keyboard navigation, gliding indicators, text transitions and keyboard shortcuts. You own the markup and styles; the hooks handle the behavior. Built on [`@guillemservera/details-core`](../core).

## Status

react-details is in an early `0.x` release. The API may change before `1.0`.

## Features

- React 18.3+ and 19 hooks built on `@guillemservera/details-core`, with no third-party runtime dependencies beyond the `react` peer dependency.
- ESM only, `sideEffects: false`, one subpath per hook: import one and bundle only that one.
- No CSS files, no visual classes; state is exposed through `data-*` attributes.
- SSR safe: no DOM access during render.
- Handles late-mounted and replaced elements, cleans up on unmount, and works under `<StrictMode>`.
- No renders per animation frame. Honors `prefers-reduced-motion`.

## Installation

```bash
npm install @guillemservera/react-details
```

```bash
pnpm add @guillemservera/react-details
```

```ts
import { useProximityHover } from '@guillemservera/react-details'
// or one subpath at a time
import { useProximityHover } from '@guillemservera/react-details/proximity-hover'
```

| Hook | Subpath | What it does |
| --- | --- | --- |
| `useProximityHover` | `/proximity-hover` | Highlights the item under the pointer, or the nearest one in gaps and padding. |
| `useArrowNavigation` | `/arrow-navigation` | Arrow keys, Home, End and Enter move and activate the highlight; works while hovered. |
| `useHighlightIndicator` | `/highlight-indicator` | Springs one indicator onto the highlighted (or selected) item, with no renders per frame. |
| `useRollingText` | `/rolling-text` | Rolls complete words or phrases as single rows, without splitting them into characters. |
| `useMorphText` | `/morph-text` | Blends complete phrases through blur and crossfade, preserving in-flight opacity and blur when interrupted. |
| `useRouletteText` | `/roulette-text` | Rolls individual graphemes through vertical slots, with optional blur and edge fade. |
| `usePlatform` | `/platform` | The operating system, e.g. to label shortcuts. |
| `useInputCapabilities` | `/input-capabilities` | Whether the device can hover, has a fine pointer or is touch-first. |
| `useShortcuts` | `/shortcuts` | Keyboard shortcuts and sequences, plus label formatters. |

## Quick Start

A list where the nearest item is always highlighted, an indicator glides to it, and the arrow keys take over:

```tsx
import { useRef } from 'react'
import { useArrowNavigation, useHighlightIndicator, useProximityHover } from '@guillemservera/react-details'

const items = ['Inbox', 'Drafts', 'Sent', 'Archive']

export function Menu() {
  const list = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)

  const { highlighted } = useProximityHover(list)
  useArrowNavigation(list)
  useHighlightIndicator(list, indicator)

  return (
    <div ref={list} className="list" role="menu" tabIndex={0} aria-activedescendant={highlighted?.id}>
      <div ref={indicator} className="indicator" aria-hidden="true" />
      {items.map((item, i) => (
        <button key={item} id={`menu-item-${i}`} data-highlight-item="" role="menuitem" tabIndex={-1}>
          {item}
        </button>
      ))}
    </div>
  )
}
```

```css
.list { position: relative; }
.indicator { position: absolute; top: 0; left: 0; border-radius: 8px; background: #0000000d; pointer-events: none; }
button { position: relative; }
```

## Refs and options

- Hooks take `RefObject`s from `useRef`. The element is attached after commit and detached on unmount.
- A ref's element is checked after every render of the component that calls the hook, so conditional rendering and keyed remounts are followed. If a child component swaps the element without the calling component re-rendering, the new element is picked up on its next render.
- Options are plain props. DOM-hook options are read from the latest render, so changing them never re-creates the behavior except for `axis`, `target`, `from` and `motion`, which re-create the relevant behavior. For `useShortcuts`, changing `target`, `capture` or `platform` re-attaches the listener; other shortcut options are read from the latest render. Inline functions such as `scrollToIndex` and shortcut handlers are fine.

## Highlight hooks

`useProximityHover`, `useArrowNavigation` and `useHighlightIndicator` work alone or together. Pass the **same ref object** to combine them: they share one highlight store. If the element is replaced, the ref still identifies the same store, but selection is not guaranteed to survive: state resets when the last container detaches, and removed DOM elements are never retained.

- Items carry `data-highlight-item`. In virtualized lists they also carry `data-index`.
- The highlighted item gets `data-highlighted`; the container gets `data-keyboard-navigation` while the keyboard owns the highlight.
- Items that are `:disabled`, `aria-disabled="true"` or `data-disabled` are skipped.
- Touch input is ignored: there is no hover on touch screens, so taps and swipes never leave a highlight behind. Focus and keyboard still highlight.
- `useProximityHover` and `useArrowNavigation` return `{ highlighted, source }`: the highlighted element and what highlighted it (`'pointer' | 'keyboard' | 'focus'`). The component re-renders when they change; both are `null` on the server and during hydration.

### `useProximityHover(container, options?)`

The item under the pointer is highlighted in the pointer event itself, like native `:hover`; in gaps and padding, the nearest one is, from measured geometry. While content scrolls under a still pointer, the highlight follows at once. Items mostly clipped at a scroll edge only win when nothing better is visible.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `axis` | `'x' \| 'y' \| 'xy'` | `'y'` | Axis the nearest item is measured along: lists, strips, or grids and wrapping rows. |
| `resumeDistance` | `number` | `6` | Pixels the mouse must travel before it takes the highlight back from the keyboard. |
| `gapClick` | `boolean` | `true` | A click in a gap between items clicks the highlighted item. |
| `ignore` | `string` | — | Selector of non-item content, such as group labels: the pointer over it highlights nothing, where a gap takes the nearest item. Changing it re-creates the behavior. |

Besides `{ highlighted, source }`, it returns `remeasure()`, a stable function: items are measured again when they resize, when the DOM changes and when an animation or transform transition on an ancestor ends (an enter zoom); call it for any other geometry change that has no DOM mutation.

### `useArrowNavigation(container, options?)`

↑ ↓ (or ← → on `x`), Home and End move the highlight; Enter and Space activate the highlighted item. Navigation keeps focus on the container, so give it `tabIndex={0}`; items can use `tabIndex={-1}` when the container owns focus. Only the container scrolls, never the page. Used alone, the item under the mouse is highlighted like plain hover, so keys continue from it.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `axis` | `'x' \| 'y' \| 'xy'` | `'y'` | Which arrow keys navigate. |
| `loop` | `boolean` | `false` | Wrap from the last item to the first and back. |
| `whileHovered` | `boolean` | `true` | Keys also work while the pointer is over the container, before it has focus. |
| `resumeDistance` | `number` | `6` | Pixels the mouse must travel before hover takes the highlight back. |
| `count` | `number` | — | Total items of a virtualized list; indexes belong on the actual highlighted rows. |
| `scrollToIndex` | `(index: number) => void` | — | Brings an unrendered item of a virtualized list into view, e.g. TanStack Virtual's `scrollToIndex`. |
| `isDisabled` | `(index: number) => boolean` | — | Skips disabled indexes throughout the virtual model, including unmounted rows. |
| `focusTarget` | `RefObject<HTMLElement \| null>` | — | Explicit search input whose focus is retained during navigation. |
| `currentIndex` | `number \| (() => number)` | — | Consumer-owned index to navigate from. |
| `onIndexChange` | `(index: number) => void` | — | Updates the consumer's index after keyboard navigation. |
| `store` | `HighlightStore` | Shared by container ref | Shares state explicitly with an integration using another container ref. |

Modified keys and IME composition are ignored. Keys typed into editable elements are ignored unless the element is the explicit `focusTarget`; that input keeps native Home, End and Space behavior, while arrows navigate and Enter activates the rendered highlighted row.

### `useHighlightIndicator(container, indicator, options?)`

Springs an absolutely positioned indicator onto the item matching `target`, whoever marks it: the pointer, the keyboard, React state or a headless menu. The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`. Transform, size and opacity are written directly, and the glide runs as a Web Animation on the compositor (falling back automatically to per-frame writes where `Element.animate` is missing), with no renders per frame. With reduced motion it fades without travelling.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `target` | `string` | `'[data-highlighted]'` | Selector of the item to sit on, e.g. `'[aria-selected="true"]'` for the active tab. |
| `from` | `string` | — | A new session grows out of this item and returns into it when it ends. |
| `motion` | `'fast' \| 'smooth' \| 'moderate'` | `'smooth'` | Critically damped spring of 80, 100 or 160 ms. |
| `reducedMotion` | `boolean` | OS setting | Jump instead of gliding; fades still run. Read on every update, so an app setting can drive it; `undefined` follows `prefers-reduced-motion`. |

It returns stable `{ remeasure, freeze }` controls. `remeasure()` measures again after geometry changes without a DOM mutation. `freeze()` stops observation and animation while retaining the current rendered paint for an exit animation; it is terminal for that instance. Normal element replacement or unmount cleans up and restores the original styles.

A tab bar with a sliding selection pill:

```ts
useHighlightIndicator(tabs, pill, { target: '[aria-selected="true"]', motion: 'moderate' })
```

### `useHighlightStore(container)`

The store that the highlight hooks receiving `container` share, with its state: `{ store, highlighted, source }`. Exported from `/proximity-hover`, `/arrow-navigation`, `/highlight-indicator` and the package root. Use it when a component owns its own highlight model (a combobox, a headless menu):

- Mirror the component's active item with `store.highlight(item, 'keyboard')`, and call `store.suspendPointer()` on every non-pointer move so a resting mouse cannot take the highlight back until it travels `resumeDistance`.
- When the component writes `data-highlighted` itself, mirror the store into your own attribute from `store.subscribe` and point the indicator at it with `target`.
- To pin the indicator on screen while your own code scrolls to reveal an item, measure the scroll around it and set `store.nudge = { item, dx, dy }` before the highlight reaches the DOM.
- To keep the indicator's current frame for an exit animation, call the indicator hook's `freeze()` before the content is torn down. Normal disposal restores its original styles.

The hook attaches the store to the container even without pointer or keyboard hooks, so `store.items()` and `store.highlightIndex()` work independently. Removed items are reconciled, and the attachment is released on container replacement or unmount.

## Text effects

`useRollingText`, `useMorphText` and `useRouletteText` take a React-owned source span and an **empty sibling viewport**. The hook draws the effect in the viewport and hides the source visually, not from assistive technology. Source text renders during SSR, and changes are picked up after React commits them.

```tsx
import { useRef, useState } from 'react'
import { useMorphText } from '@guillemservera/react-details/morph-text'

export function Headline() {
  const [text, setText] = useState('Make every word count.')
  const source = useRef<HTMLSpanElement>(null)
  const viewport = useRef<HTMLSpanElement>(null)
  useMorphText(source, viewport, { duration: 600, blur: 0.2 })

  return (
    <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
      <span ref={source} style={{ display: 'inline-block', minHeight: '1lh' }}>{text}</span>
      <span ref={viewport} aria-hidden="true" />
    </span>
  )
}
```

The other two effects use the same markup:

```ts
import { useRollingText } from '@guillemservera/react-details/rolling-text'
import { useRouletteText } from '@guillemservera/react-details/roulette-text'

useRollingText(source, viewport, { direction: 'up' })
useRouletteText(source, viewport, { blur: 0.08, fade: 0.4 }) // No blur or fade by default.
```

Use one effect per source and viewport pair.

| Option | Type | Rolling | Morph | Roulette |
| --- | --- | --- | --- | --- |
| `duration` | `number` | `600` | `600` | `600` |
| `animated` | `boolean` | `true` | `true` | `true` |
| `direction` | `'up' \| 'down'` | `'up'` | — | `'up'` |
| `blur` | `number` | — | `0.2` em; `0` is a sharp crossfade | `0` em; peak blur while a slot rolls |
| `fade` | `number` | — | — | `0`; from 0 to 1, how much of the slot edges fades |
| `alphabet` | `string` | — | — | `'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'`; targets need not be in it |

- Rolling moves each phrase as one row; interruptions continue from the visible position.
- Morph is a blur and crossfade, not an interpolation of letter outlines. Rapid updates keep at most two fading layers.
- Roulette uses `Intl.Segmenter` to keep emoji and combining sequences whole, animates only the characters that change, and renders the exact target string when settled.
- Changing an option settles the current effect. `animated: false`, a zero duration, reduced motion and hidden documents apply text instantly. A negative or non-finite `duration`, `blur` or `fade` uses the default.
- Right-to-left text and padding or borders on the parent are supported.

Constraints:

- Single line only. The source must render plain text and the viewport must stay empty in your JSX.
- The parent holds only the source and the viewport, is `position: relative; display: inline-block`, and carries the typography.
- Give the parent `white-space: pre` and the source `display: inline-block; min-height: 1lh`, as above. The hook applies them on mount; without them in your markup, server-rendered empty text or leading and trailing spaces shift on hydration.
- Roulette draws each grapheme in its own slot, so while it rolls, Arabic and other cursive scripts lose letter joining, and ligatures and kerning are lost. The settled text renders normally.
- Parent padding is read when the text, its size or an option changes.
- The effects require the Web Animations API; roulette also requires `Intl.Segmenter`.

## Platform, input and shortcuts

### `usePlatform()`

Returns `'mac' | 'ios' | 'windows' | 'linux' | 'android' | 'chromeos' | 'unknown'`. It is `'unknown'` on the server and during hydration, then the detected value, so hydration always matches. `isApplePlatform(platform)` is exported alongside.

### `useInputCapabilities()`

Returns `{ canHover, hasFinePointer, primaryPointerIsCoarse, hasTouch, isTouchFirst }`, all `false` on the server and during hydration, and re-renders when a media query changes. All instances share one set of listeners.

### `useShortcuts(bindings, options?)`

```tsx
import { useShortcuts, formatShortcutLabel } from '@guillemservera/react-details/shortcuts'

useShortcuts([
  { keys: 'mod_k', handler: () => setOpen(true) },
  { keys: 'g-d', handler: () => navigate('/dashboard') },
  { keys: ['?', 'f1'], handler: showHelp, enabled: !open },
])

formatShortcutLabel('mod_k') // ⌘K on Apple platforms, Ctrl+K elsewhere
```

`_` joins a combination and `-` a sequence; `mod` is ⌘ on Apple platforms and Ctrl elsewhere. Bindings and options are read from the latest render on every keystroke, so inline arrays and handlers never re-attach the listener; changing `target`, `capture` or `platform` re-attaches it. Keys typed into editable fields are ignored unless a binding sets `usingInput`.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `target` | `EventTarget \| null` | `window` | Where to listen for `keydown`; `null` listens nowhere. Changing it re-attaches the listener. |
| `capture` | `boolean` | `true` | Listen in the capture phase, before handlers inside the page. |
| `platform` | `Platform` | detected | Platform for `mod`, read when the listener attaches; changing it re-attaches the listener. |
| `sequenceTimeoutMs` | `number` | `900` | How long a partial sequence stays live. |
| `preventDefault` | `boolean` | `true` | Call `preventDefault()` on handled keys. |
| `respectDefaultPrevented` | `boolean` | `true` | Skip events another listener already claimed. |
| `shouldHandle` | `(event, match) => boolean` | — | Final veto after a binding matched. |

`formatShortcutLabel`, `formatShortcutTokens` and `formatShortcutKey` turn bindings into labels or tokens for `<kbd>` elements. In an SSR-rendered client component, pass `platform: usePlatform()` so labels use a hydration-stable server value and update after hydration. The React package re-exports these formatters from core; in an RSC server module, import them from `@guillemservera/details-core/shortcuts` instead.

## Accessibility

- The hooks add behavior, not semantics. Give your widget the roles it needs (for example `menu`/`menuitem` or `listbox`/`option`) and point `aria-activedescendant` at `highlighted`.
- Keyboard navigation keeps focus on the container, so virtualized items can unmount without losing focus.
- Indicators are decorative: mark them `aria-hidden="true"`.
- Text effects keep the source text in the accessibility tree and hide only their visual viewport.

## SSR

All hooks are safe to call during server rendering: they only touch the DOM in effects after commit. Text effects render the source text on the server, and `usePlatform`, `useInputCapabilities` and the highlight state render their defaults during hydration. Every emitted React module, including the root entry and every subpath, starts with `'use client'` for React Server Component frameworks. The shortcut label formatters are implemented by `@guillemservera/details-core`; import them from `@guillemservera/details-core/shortcuts` in RSC server modules because the React package entries are client-marked.

## Known issues

### Rows shimmer by 1px while keyboard navigation scrolls at fractional device pixel ratios

At a device pixel ratio such as 1.1 or 1.375 (display scaling combined with browser zoom), a row pitch like 44 CSS px is 60.5 device px. Rows therefore sit alternately on whole and half device pixels, while scroll offsets always snap to whole device pixels. Each step that scrolls the list lands the highlighted row half a device pixel higher or lower than the previous one, and text snapping turns that into a visible ±1px shimmer at the top and bottom edges. Nothing moves in the middle of the list, because nothing scrolls there.

This is not caused by the hooks: native `scrollIntoView({ block: 'nearest' })` on the same markup flickers identically, and it disappears at ratios where the row pitch is a whole number of device pixels (1, 1.25 and 1.5 for 44px rows).

Mitigations are on the app side: a row pitch (height + gap) that is a whole number of device pixels at the ratios you target (for example 48px at 1.375), or 100% browser zoom.

## Local Development

| Command | What it runs |
| --- | --- |
| `pnpm test` | Unit tests, including server rendering |
| `pnpm test:browser` | Browser tests in Chrome |
| `pnpm typecheck` | Type checking |
| `pnpm size` | Build and per-entry gzip budgets |
| `pnpm run ci` | Everything CI runs |

## Credits

The proximity hover idea and spring tiers follow [Fluid Functionalism](https://www.fluidfunctionalism.com/docs/fluid-hover) (MIT).

## License

MIT © 2026 Guillem Servera
