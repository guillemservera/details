# @guillemservera/details-core

Framework-agnostic core of [details](https://github.com/guillemservera/details). Most apps should install a framework package instead, such as [`@guillemservera/vue-details`](../vue).

Every behavior takes elements that are already rendered and returns an object with `destroy()`. Call it before the elements are removed or replaced. Nothing touches the DOM until you call a `create*` function, so modules are safe to import during SSR.

Only option fields typed `MaybeGetter` accept a plain value or a getter: `resumeDistance` and `gapClick` for proximity hover; `loop`, `whileHovered`, `resumeDistance` and `count` for arrow navigation; and `duration`, `direction`, `animated`, `blur`, `alphabet` and `fade` for text effects where each option exists. A getter returning `undefined` uses the default. Other options—including `axis`, `target`, `from`, `motion` and `store`—do not accept getters; `scrollToIndex` is a plain callback.

## Highlight

```ts
import { createProximityHover } from '@guillemservera/details-core/proximity-hover'
import { createArrowNavigation } from '@guillemservera/details-core/arrow-navigation'
import { createHighlightIndicator } from '@guillemservera/details-core/highlight-indicator'

const hover = createProximityHover(list, { axis: 'y' })
const keys = createArrowNavigation(list, { loop: true })
const indicator = createHighlightIndicator(list, marker)

const unsubscribe = hover.store.subscribe(() => console.log(hover.store.highlighted, hover.store.source))
```

- `createProximityHover(container, { axis, resumeDistance, gapClick, store })` highlights the item under the pointer, or the nearest one in gaps.
- `createArrowNavigation(container, { axis, loop, whileHovered, resumeDistance, count, scrollToIndex, store })` moves the highlight with arrow keys, Home and End, and activates the highlighted item with Enter and Space.
- `createHighlightIndicator(container, indicator, { target, from, motion, store })` springs an absolutely positioned indicator onto the highlighted item, or onto the `target` selector.

Items carry `data-highlight-item` (`ITEM_ATTR`), plus `data-index` in virtualized lists. The highlighted item gets `data-highlighted` (`HIGHLIGHT_ATTR`), and the container gets `data-keyboard-navigation` (`KEYBOARD_ATTR`) while the keyboard owns the highlight.
Keyboard navigation keeps focus on the container: give it `tabindex="0"` (React uses `tabIndex={0}`), and usually give items `tabindex="-1"` when the container owns focus. Arrow keys, Home and End move the highlight; Enter and Space call `.click()` on the highlighted item. With the default `whileHovered`, arrow keys also work while the pointer is over the container before it has focus.

All three return `{ store, destroy }`. Behaviors on the same container element share one store by default. Pass `store: createHighlightStore()` to share the store identity when a container is replaced, but selection is not guaranteed to survive: detaching the last container resets the highlight and transient state, and removed DOM elements are never retained. A `HighlightStore` exposes `highlighted`, `source` and `subscribe(listener)`, which returns an unsubscribe function.

## Text

```ts
import { createRollingText } from '@guillemservera/details-core/rolling-text'

const motion = createRollingText(source, viewport, { duration: () => settings.duration })
source.textContent = 'Next phrase' // animates
settings.duration = 300
motion.update() // applies changed getter options
```

`createRollingText`, `createMorphText` and `createRouletteText(source, viewport, options)` animate text changes in `source`. The `viewport` is an empty sibling that the effect owns and marks `aria-hidden`. The parent of both must be `position: relative` and `inline-block`. Each returns `{ update, destroy }`. `update()` settles on the current text when a resolved option changed, and does nothing otherwise.

## Platform

```ts
import { detectPlatform, isApplePlatform } from '@guillemservera/details-core/platform'
```

- `detectPlatform(nav?)` returns `'mac' | 'ios' | 'windows' | 'linux' | 'android' | 'chromeos' | 'unknown'`: Client Hints first, user agent as fallback, iPadOS as `ios`, and `'unknown'` on the server.
- `isApplePlatform(platform)`.

## Input capabilities

```ts
import { createInputCapabilities } from '@guillemservera/details-core/input-capabilities'
```

`createInputCapabilities()` returns `{ getSnapshot, getServerSnapshot, subscribe }`, compatible with React's `useSyncExternalStore`. The snapshot has `canHover` (`(any-hover: hover)`), `hasFinePointer` (`(any-pointer: fine)`), `primaryPointerIsCoarse` (`(pointer: coarse)`), `hasTouch` and `isTouchFirst` (a coarse primary pointer and no hover). It updates live, for example when a mouse is connected; media listeners only exist while something is subscribed.

## Shortcuts

```ts
import { createShortcutKeydownHandler, formatShortcutLabel } from '@guillemservera/details-core/shortcuts'
```

Binding syntax: `_` joins a combination (`mod_k`, `ctrl_shift_p`), `-` a sequence (`g-d`), a single character is literal (`?`), and an array lists alternatives.

- `mod` (also `cmd`, `command`) is ⌘ on macOS and iOS and Ctrl elsewhere. `meta` is always the Meta key: ⌘, Win or Super. Also `ctrl`, `alt` (`option`) and `shift`.
- `createShortcutKeydownHandler(getBindings, options)` returns `{ handleKeydown, resetSequence }`. Bindings have `keys`, `handler`, `enabled`, `priority` and `usingInput` (`true`, or the `name` of a field). Options: `platform`, `sequenceTimeoutMs` (900), `preventDefault`, `respectDefaultPrevented`, `shouldHandle`.
- `matchesShortcutEvent(event, shortcut, { platform })` and `isEditableTarget(target)`.
- `formatShortcutLabel(keys, { platform, orLabel, thenLabel })` gives `⌘K`, `Ctrl+K` or `G then D`; `formatShortcutTokens(...)` gives structured tokens for rendering each key; `formatShortcutKey(key)` formats a single key (`arrowup` → `↑`).
