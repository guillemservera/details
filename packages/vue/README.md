# vue-details

Tiny composables for polished Vue interfaces.

The little interaction details Vue doesn't handle for you: proximity hover, keyboard navigation, gliding indicators and text transitions. You own the markup and styles; the composables handle the behavior.

## Status

vue-details is in an early `0.x` release. The API may change before `1.0`.

## Features

- Vue 3.5+ composables built on `@guillemservera/details-core`, with no third-party runtime dependencies beyond the `vue` peer dependency.
- ESM only, `sideEffects: false`, one subpath per composable: import one and bundle only that one.
- No CSS files, no visual classes; state is exposed through `data-*` attributes.
- SSR safe: no DOM access during setup.
- Handles late-mounted and replaced template refs, and cleans up on scope disposal.
- Honors `prefers-reduced-motion`.

## Installation

```bash
npm install @guillemservera/vue-details
```

```bash
pnpm add @guillemservera/vue-details
```

```ts
import { useProximityHover } from '@guillemservera/vue-details'
// or one subpath at a time
import { useProximityHover } from '@guillemservera/vue-details/proximity-hover'
```

| Composable | Subpath | What it does |
| --- | --- | --- |
| `useProximityHover` | `/proximity-hover` | Highlights the item under the pointer, or the nearest one in gaps and padding. |
| `useArrowNavigation` | `/arrow-navigation` | Arrow keys, Home, End and Enter move and activate the highlight; works while hovered. |
| `useHighlightIndicator` | `/highlight-indicator` | Springs one indicator onto the highlighted (or selected) item, with no renders per frame. |
| `useRollingText` | `/rolling-text` | Rolls complete words or phrases as single rows, without splitting them into characters. |
| `useMorphText` | `/morph-text` | Blends complete phrases through blur and crossfade, preserving in-flight opacity and blur when interrupted. |
| `useRouletteText` | `/roulette-text` | Rolls individual graphemes through vertical slots, with optional blur and edge fade. |
| `useShortcuts` | `/shortcuts` | Keyboard shortcuts and sequences, with platform-aware `mod` and labels. |
| `usePlatform` | `/platform` | The operating system, detected after mount so hydration matches. |
| `useInputCapabilities` | `/input-capabilities` | Hover, pointer precision and touch, kept current from media queries. |

## Quick Start

A list where the nearest item is always highlighted, an indicator glides to it, and the arrow keys take over:

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useArrowNavigation, useHighlightIndicator, useProximityHover } from '@guillemservera/vue-details'

const items = ['Inbox', 'Drafts', 'Sent', 'Archive']
const list = useTemplateRef<HTMLElement>('list')

const { highlighted } = useProximityHover(list)
useArrowNavigation(list)
useHighlightIndicator(list, useTemplateRef('indicator'))
</script>

<template>
  <div
    ref="list"
    class="list"
    role="menu"
    tabindex="0"
    :aria-activedescendant="highlighted?.id"
  >
    <div ref="indicator" class="indicator" aria-hidden="true" />
    <button
      v-for="(item, i) in items"
      :id="`menu-item-${i}`"
      :key="item"
      data-highlight-item
      role="menuitem"
      tabindex="-1"
    >
      {{ item }}
    </button>
  </div>
</template>

<style>
.list { position: relative; }
.indicator { position: absolute; top: 0; left: 0; border-radius: 8px; background: #0000000d; pointer-events: none; }
button { position: relative; }
</style>
```

## Highlight composables

`useProximityHover`, `useArrowNavigation` and `useHighlightIndicator` work alone or together. Pass the **same container ref** to combine them: they share one highlight store. If the container is replaced, the ref still identifies the same store, but selection is not guaranteed to survive: state resets when the last container detaches, and removed DOM elements are never retained.

- Items carry `data-highlight-item`. In virtualized lists they also carry `data-index`.
- The highlighted item gets `data-highlighted`; the container gets `data-keyboard-navigation` while the keyboard owns the highlight.
- Items that are `:disabled`, `aria-disabled="true"` or `data-disabled` are skipped.
- Touch input is ignored: there is no hover on touch screens, so taps and swipes never leave a highlight behind. Focus and keyboard still highlight.
- `useProximityHover` and `useArrowNavigation` return `{ highlighted, source }`: the highlighted element and what highlighted it (`'pointer' | 'keyboard' | 'focus'`).

### `useProximityHover(container, options?)`

The item under the pointer is highlighted; in gaps and padding, the nearest one is. While content scrolls under a still pointer, the highlight follows at once, like native `:hover`. Items mostly clipped at a scroll edge only win when nothing better is visible.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `axis` | `'x' \| 'y' \| 'xy'` | `'y'` | Axis the nearest item is measured along: lists, strips, or grids and wrapping rows. |
| `resumeDistance` | `MaybeRefOrGetter<number>` | `6` | Pixels the mouse must travel before it takes the highlight back from the keyboard. |
| `gapClick` | `MaybeRefOrGetter<boolean>` | `true` | A click in a gap between items clicks the highlighted item. |

### `useArrowNavigation(container, options?)`

↑ ↓ (or ← → on `x`), Home and End move the highlight; Enter and Space activate the highlighted item. Navigation keeps focus on the container, so give it `tabindex="0"` (React uses `tabIndex={0}`); items can use `tabindex="-1"` when the container owns focus. Only the container scrolls, never the page. Used alone, the item under the mouse is highlighted like plain hover, so keys continue from it.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `axis` | `'x' \| 'y' \| 'xy'` | `'y'` | Which arrow keys navigate. |
| `loop` | `MaybeRefOrGetter<boolean>` | `false` | Wrap from the last item to the first and back. |
| `whileHovered` | `MaybeRefOrGetter<boolean>` | `true` | Keys also work while the pointer is over the container, before it has focus. |
| `resumeDistance` | `MaybeRefOrGetter<number>` | `6` | Pixels the mouse must travel before hover takes the highlight back. |
| `count` | `MaybeRefOrGetter<number \| undefined>` | — | Total items of a virtualized list. Disabled items are only skipped when rendered. |
| `scrollToIndex` | `(index: number) => void` | — | Brings an unrendered item of a virtualized list into view, e.g. TanStack Virtual's `scrollToIndex`. |

Modified keys and keys typed into inputs, textareas, selects or content-editable elements are ignored.

### `useHighlightIndicator(container, indicator, options?)`

Springs an absolutely positioned indicator onto the item matching `target`, whoever marks it: the pointer, the keyboard, `v-model` or a headless menu. The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`. Transform, size and opacity are written directly, with no component renders per frame. With reduced motion it fades without travelling.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `target` | `string` | `'[data-highlighted]'` | Selector of the item to sit on, e.g. `'[aria-selected="true"]'` for the active tab. |
| `from` | `string` | — | A new session grows out of this item and returns into it when it ends. |
| `motion` | `'fast' \| 'smooth' \| 'moderate'` | `'smooth'` | Critically damped spring of 80, 100 or 160 ms. |

A tab bar with a sliding selection pill:

```ts
useHighlightIndicator(tabs, pill, { target: '[aria-selected="true"]', motion: 'moderate' })
```

## Text effects

`useRollingText`, `useMorphText` and `useRouletteText` take a Vue-owned source span and an **empty sibling viewport**. The composable draws the effect in the viewport and hides the source visually, not from assistive technology. Source text renders during SSR, and changes are picked up after Vue patches it.

```vue
<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useMorphText } from '@guillemservera/vue-details/morph-text'

const text = ref('Make every word count.')
const blur = ref(0.2)
const source = useTemplateRef<HTMLElement>('source')
const viewport = useTemplateRef<HTMLElement>('viewport')
useMorphText(source, viewport, { duration: 600, blur })
</script>

<template>
  <span style="position: relative; display: inline-block; white-space: pre">
    <span ref="source" style="display: inline-block; min-height: 1lh">{{ text }}</span>
    <span ref="viewport" aria-hidden="true"></span>
  </span>
</template>
```

The other two effects use the same markup:

```ts
import { useRollingText } from '@guillemservera/vue-details/rolling-text'
import { useRouletteText } from '@guillemservera/vue-details/roulette-text'

useRollingText(source, viewport, { direction: 'up' })
useRouletteText(source, viewport, { blur: 0.08, fade: 0.4 }) // No blur or fade by default.
```

Use one effect per source and viewport pair.

| Option | Type | Rolling | Morph | Roulette |
| --- | --- | --- | --- | --- |
| `duration` | `MaybeRefOrGetter<number>` | `600` | `600` | `600` |
| `animated` | `MaybeRefOrGetter<boolean>` | `true` | `true` | `true` |
| `direction` | `MaybeRefOrGetter<'up' \| 'down'>` | `'up'` | — | `'up'` |
| `blur` | `MaybeRefOrGetter<number>` | — | `0.2` em; `0` is a sharp crossfade | `0` em; peak blur while a slot rolls |
| `fade` | `MaybeRefOrGetter<number>` | — | — | `0`; from 0 to 1, how much of the slot edges fades |
| `alphabet` | `MaybeRefOrGetter<string>` | — | — | `'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'`; targets need not be in it |

- Rolling moves each phrase as one row; interruptions continue from the visible position.
- Morph is a blur and crossfade, not an interpolation of letter outlines. Rapid updates keep at most two fading layers.
- Roulette uses `Intl.Segmenter` to keep emoji and combining sequences whole, animates only the characters that change, and renders the exact target string when settled.
- Changing an option settles the current effect. `animated: false`, a zero duration, reduced motion and hidden documents apply text instantly. A negative or non-finite `duration`, `blur` or `fade` uses the default.
- Right-to-left text and padding or borders on the parent are supported.

Constraints:

- Single line only. The source must be plain text and the viewport must stay empty in your template.
- The parent holds only the source and the viewport, is `position: relative; display: inline-block`, and carries the typography.
- Give the parent `white-space: pre` and the source `display: inline-block; min-height: 1lh`, as above. The composable applies them on mount; without them in your markup, server-rendered empty text or leading and trailing spaces shift on hydration.
- Roulette draws each grapheme in its own slot, so while it rolls, Arabic and other cursive scripts lose letter joining, and ligatures and kerning are lost. The settled text renders normally.
- Parent padding is read when the text, its size or an option changes.
- The effects require the Web Animations API; roulette also requires `Intl.Segmenter`.

## Keyboard and device

`useShortcuts`, `usePlatform` and `useInputCapabilities` render the server defaults during SSR and hydration, and read the browser after mount.

### `useShortcuts(bindings, options?)`

Runs the matching binding on `keydown`. `bindings` accepts an array, ref or getter and is read on every keystroke, so bindings can change at any time. The listener attaches after mount, moves when `target` changes (clearing a partial sequence) and is removed on scope disposal.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { formatShortcutLabel, usePlatform, useShortcuts } from '@guillemservera/vue-details'

const open = ref(false)
const platform = usePlatform()

useShortcuts([
  { keys: ['mod_k', '/'], handler: () => (open.value = true) },
  { keys: 'escape', handler: () => (open.value = false), usingInput: true, enabled: () => open.value },
  { keys: 'g-d', handler: () => navigateTo('/dashboard') },
])
</script>

<template>
  <button @click="open = true">
    Search <kbd>{{ formatShortcutLabel('mod_k', { platform }) }}</kbd>
  </button>
</template>
```

- Keys are joined with `_` for combinations (`mod_shift_p`) and `-` for sequences (`g-d`); pass an array for alternatives.
- `mod` is ⌘ on macOS and iOS and Ctrl elsewhere, for app shortcuts like `mod_k`. `meta` is always the ⌘, Win or Super key; `ctrl` is always Control.
- Symbols such as `?` match whatever Shift the layout needs to type them.
- Keys typed into inputs, textareas, selects and content-editable elements are ignored unless the binding sets `usingInput`: `true`, or the `name` of the one field it works in.
- When several bindings match, the highest `priority` wins; ties keep list order. `enabled` accepts a boolean or a getter.
- `platform` is a plain override. Omit it to let shortcut matching detect the current platform; do not pass `usePlatform().value`, which starts as `'unknown'` and is not reactive through this option. Use the platform ref for reactive label formatting instead.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `target` | `MaybeRefOrGetter<EventTarget \| null \| undefined>` | `window` | Where to listen. A ref holding `null` listens nowhere. |
| `capture` | `boolean` | `true` | Listen in the capture phase, before handlers inside the page. |
| `platform` | `Platform` | detected | Overrides how `mod` matches; `meta` always means the Meta key. |
| `sequenceTimeoutMs` | `number` | `900` | How long a partial sequence stays live. |
| `preventDefault` | `boolean` | `true` | Call `preventDefault()` on handled keys. |
| `respectDefaultPrevented` | `boolean` | `true` | Skip events another listener already claimed. |
| `shouldHandle` | `(event, { binding, key }) => boolean` | — | Final veto after a binding matched. |

`/shortcuts` also exports the label formatters from `@guillemservera/details-core`, so Vue consumers can import them from the Vue package:

```ts
formatShortcutLabel('mod_shift_p') // ⌘⇧P on Apple, Ctrl+Shift+P elsewhere
formatShortcutLabel(['mod_k', '/']) // ⌘K or /
formatShortcutLabel('g-d', { thenLabel: 'luego' }) // G luego D
formatShortcutTokens('mod_k') // [{ kind: 'key', key: 'mod', label: '⌘' }, …], for rendering one <kbd> per key
formatShortcutKey('arrowup') // ↑
```

Without `platform`, the formatters detect it on every call, which differs between server and client. In SSR apps pass `usePlatform()`'s value, as above: labels render as non-Apple on the server and switch after mount.

### `usePlatform()`

Returns a read-only ref: `'mac' | 'ios' | 'windows' | 'linux' | 'android' | 'chromeos' | 'unknown'`. It is `'unknown'` on the server and until mount, then the detected platform, so the first client render matches the server HTML. iPadOS is reported as `'ios'`.

```ts
import { computed } from 'vue'
import { isApplePlatform, usePlatform } from '@guillemservera/vue-details/platform'

const platform = usePlatform()
const isApple = computed(() => isApplePlatform(platform.value))
```

### `useInputCapabilities()`

Returns a read-only shallow ref with what the device's pointers can do. Every field is `false` on the server and until mount. All instances share one set of media query listeners, removed when the last instance is disposed. The object is replaced only when a value changes.

| Field | Source | Description |
| --- | --- | --- |
| `canHover` | `(any-hover: hover)` | Some available pointer can hover. |
| `hasFinePointer` | `(any-pointer: fine)` | Some available pointer is precise. |
| `primaryPointerIsCoarse` | `(pointer: coarse)` | The primary pointer is a finger or a stylus. |
| `hasTouch` | `navigator.maxTouchPoints > 0` | A touch screen is present, even on a laptop with a mouse. |
| `isTouchFirst` | coarse and no hover | Hover-only affordances are unreachable; show them another way. |

```vue
<script setup lang="ts">
import { useInputCapabilities } from '@guillemservera/vue-details/input-capabilities'

const input = useInputCapabilities()
</script>

<template>
  <button :data-always-visible="input.isTouchFirst || undefined">Delete</button>
</template>
```

Prefer CSS media queries for pure styling; use this when the behavior or markup changes.

## Accessibility

- The composables add behavior, not semantics. Give your widget the roles it needs (for example `menu`/`menuitem` or `listbox`/`option`) and point `aria-activedescendant` at `highlighted`.
- Keyboard navigation keeps focus on the container, so virtualized items can unmount without losing focus.
- Indicators are decorative: mark them `aria-hidden="true"`.
- Text effects keep the source text in the accessibility tree and hide only their visual viewport.

## Nuxt and SSR

All composables are safe to call during server rendering: they only touch the DOM after mount. Text effects render the source text on the server.

## Known issues

### Rows shimmer by 1px while keyboard navigation scrolls at fractional device pixel ratios

At a device pixel ratio such as 1.1 or 1.375 (display scaling combined with browser zoom), a row pitch like 44 CSS px is 60.5 device px. Rows therefore sit alternately on whole and half device pixels, while scroll offsets always snap to whole device pixels. Each step that scrolls the list lands the highlighted row half a device pixel higher or lower than the previous one, and text snapping turns that into a visible ±1px shimmer at the top and bottom edges. Nothing moves in the middle of the list, because nothing scrolls there.

This is not caused by the composables: native `scrollIntoView({ block: 'nearest' })` on the same markup flickers identically, and it disappears at ratios where the row pitch is a whole number of device pixels (1, 1.25 and 1.5 for 44px rows).

Mitigations are on the app side: a row pitch (height + gap) that is a whole number of device pixels at the ratios you target (for example 48px at 1.375), or 100% browser zoom.

## Local Development

This package lives in the [details monorepo](https://github.com/guillemservera/details), next to `@guillemservera/details-core` and `@guillemservera/react-details`. From the repository root:

```bash
pnpm install
pnpm dev
```

`pnpm dev` serves the demo site (`site/`, not published) on all interfaces (port 5175): the Vue demos live under `/vue/<demo>`. When Tailscale is running it also prints a QR code with its Tailscale URL, to open it on a phone or tablet. The site imports the package sources directly, so nothing needs building first.

Commands inside `packages/vue`:

| Command | What it runs |
| --- | --- |
| `pnpm test` | Unit tests |
| `pnpm test:browser` | Browser tests in Chrome |
| `pnpm typecheck` | Type checking |
| `pnpm size` | Build and per-entry gzip budgets, core included |
| `pnpm run ci` | Everything CI runs for this package |

## Credits

The proximity hover idea and spring tiers follow [Fluid Functionalism](https://www.fluidfunctionalism.com/docs/fluid-hover) (MIT).

## License

MIT © 2026 Guillem Servera
