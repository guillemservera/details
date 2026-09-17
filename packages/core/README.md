# @guillemservera/details-core

Framework-agnostic core of [details](https://github.com/guillemservera/details). Most apps should install a framework package instead, such as [`@guillemservera/vue-details`](../vue).

Every behavior takes elements that are already rendered and returns an object with `destroy()`. Call it before the elements are removed or replaced. Nothing touches the DOM until you call a `create*` function, so modules are safe to import during SSR.

Only option fields typed `MaybeGetter` accept a plain value or a getter: `resumeDistance` and `gapClick` for proximity hover; `loop`, `whileHovered`, `resumeDistance` and `count` for arrow navigation; `reducedMotion` for the highlight indicator; and `duration`, `direction`, `animated`, `blur`, `alphabet` and `fade` for text effects where each option exists. A getter returning `undefined` uses the default. Other options—including `axis`, `ignore`, `target`, `from`, `motion` and `store`—do not accept getters; `scrollToIndex` is a plain callback.

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

- `createProximityHover(container, { axis, resumeDistance, gapClick, ignore, store })` highlights the item under the pointer, or the nearest one in gaps. The element under the pointer decides first, in the pointer event itself, like native `:hover`; geometry decides gaps and padding in the next frame. Over content matching `ignore` (group labels, headings) it highlights nothing.
- `createArrowNavigation(container, { axis, loop, whileHovered, resumeDistance, count, scrollToIndex, store })` moves the highlight with arrow keys, Home and End, and activates the highlighted item with Enter and Space.
- `createHighlightIndicator(container, indicator, { target, from, motion, reducedMotion, store })` springs an absolutely positioned indicator onto the highlighted item, or onto the `target` selector.
  - `reducedMotion` (a boolean or getter, read on every update) makes it jump instead of glide; fades still run. It defaults to `prefers-reduced-motion: reduce`, so an app with its own setting passes `reducedMotion: () => settings.reduceMotion || undefined`.
  - The glide runs as a Web Animation sampled from the spring, so the compositor animates it and the main thread only works when the target changes. Where `Element.animate` is missing (happy-dom, jsdom, very old browsers), it falls back automatically to writing the styles on every animation frame, following the same spring.

`createProximityHover` and `createHighlightIndicator` return `{ store, destroy, remeasure }`. Both measure again when the container or an item resizes, when the DOM changes, and when a CSS animation or a transform transition ends on the container or an ancestor and changed its size on screen (an enter zoom). Call `remeasure()` for anything else that moves geometry without a DOM mutation, instead of touching the DOM to wake the observers.

Items carry `data-highlight-item` (`ITEM_ATTR`), plus `data-index` in virtualized lists. The highlighted item gets `data-highlighted` (`HIGHLIGHT_ATTR`), and the container gets `data-keyboard-navigation` (`KEYBOARD_ATTR`) while the keyboard owns the highlight.
Keyboard navigation keeps focus on the container: give it `tabindex="0"` (React uses `tabIndex={0}`), and usually give items `tabindex="-1"` when the container owns focus. Arrow keys, Home and End move the highlight; Enter and Space call `.click()` on the highlighted item. With the default `whileHovered`, arrow keys also work while the pointer is over the container before it has focus.

Arrow navigation returns `{ store, destroy }`. Behaviors on the same container element share one store by default. Pass `store: createHighlightStore()` to share the store identity when a container is replaced, but selection is not guaranteed to survive: detaching the last container resets the highlight and transient state, and removed DOM elements are never retained. A `HighlightStore` exposes `highlighted`, `source` and `subscribe(listener)`, which returns an unsubscribe function.

### Integration patterns

- **A host that owns its highlight** (a combobox or a headless menu with its own active item): mirror its active item into the store with `store.highlight(item, 'keyboard')` and call `store.suspendPointer()` on every non-pointer move, so a resting mouse cannot take the highlight back until it travels `resumeDistance`. Report pointer highlights back from `store.subscribe`.
- **Custom marker:** when the host writes `data-highlighted` itself, mirror the store into your own attribute from `store.subscribe` and pass `target: '[data-my-marker]'`. The keyboard nudge (below) still applies to it.
- **Keyboard reveal pinning:** when the host scrolls its own list to reveal the next item, measure the scroll around it and set `store.nudge = { item, dx, dy }` (the scroll delta) before the highlight reaches the DOM: the indicator keeps its place on screen instead of travelling with the content. For a virtualized row that is not rendered yet, keep the delta until the row mounts and set the nudge then.
- **Freezing on close:** to keep the indicator's last frame during an exit animation, read `getComputedStyle(indicator).transform` (and size and opacity), `destroy()` the behavior, and write them back inline. Reading inline styles is not enough: during a glide they hold the target, not the current position.

## Text

```ts
import { createRollingText } from '@guillemservera/details-core/rolling-text'

const motion = createRollingText(source, viewport, { duration: () => settings.duration })
source.textContent = 'Next phrase' // animates
settings.duration = 300
motion.update() // applies changed getter options
```

`createRollingText`, `createMorphText` and `createRouletteText(source, viewport, options)` animate text changes in `source`. They read `prefers-reduced-motion` on every change; an app with its own reduced-motion setting passes `animated: () => !settings.reduceMotion`. The `viewport` is an empty sibling that the effect owns and marks `aria-hidden`. The parent of both must be `position: relative` and `inline-block`. Each returns `{ update, destroy }`. `update()` settles on the current text when a resolved option changed, and does nothing otherwise.

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
