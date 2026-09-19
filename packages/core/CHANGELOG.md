# Changelog

## 0.2.3

### Patch Changes

- A store never highlights an item outside the container it observes. When a list sits inside another list's item, a press or focus on its gaps and headings climbed past the container and highlighted the outer item, which this store does not observe, so that foreign highlight could persist.

## 0.2.2

### Patch Changes

- A mouse press hands the highlight to the pointer again. After the keyboard highlighted another item, clicking the item under a resting pointer moved the highlight nowhere, because the click never moved the mouse and the focus it gave carried no ring; the stale highlight then survived the pointer leaving the list. A tap still leaves no highlight.

## 0.2.1

### Patch Changes

- Focus only takes the highlight when it shows a ring (`:focus-visible`). A click's focus leaves the highlight to the pointer, so leaving the list clears it, and focus the browser hands back when the window is activated again no longer leaves the item clicked last highlighted.

## 0.2.0

### Minor Changes

- Support public highlight integration for overlays and virtual search lists.

  - Add indicator `freeze()` to preserve in-flight paint during overlay exits, with normal destruction restoring original styles. Vue and React expose the control alongside `remeasure()`.
  - Add arrow-navigation `focusTarget`, `currentIndex`, `onIndexChange` and full-model `isDisabled` support. Preserve input editing keys and ignore IME composition.
  - Allow Vue and React arrow navigation to use an explicit highlight store shared with another container ref.
  - Unobserve removed proximity-hover items immediately, including rows detached during a resize callback.
  - Collapse invisible indicator geometry after fading; clear removed targets immediately to prevent ghost scroll overflow.
  - Remeasure after ancestor translation and width/height transitions as well as transform transitions.

## 0.1.0

- Initial release of `@guillemservera/details-core`.
- Fix highlight lifecycle handling for focused, reparented and replaced containers; destroying the last attachment now clears selection and transient state without retaining removed DOM.
- `createHighlightIndicator`: glides with Web Animations sampled from its spring, so the compositor animates it and the main thread only works when the target changes; where `Element.animate` is missing it falls back automatically to per-frame writes of the same spring (no option). The per-frame fallback steps with `performance.now()` only, so Firefox no longer loses a frame when a mutation lands mid-glide.
- `createHighlightIndicator`: `reducedMotion` option (a boolean or getter, read on every update; defaults to `prefers-reduced-motion`), and mutation batches spread over microtasks are coalesced into one measurement before paint. A custom `target` also keeps the keyboard nudge when it marks the highlighted item.
- `createProximityHover`: the item under the pointer is highlighted in the pointer event itself, like native `:hover`; geometry still decides gaps and padding. Item resize tracking stays active after a direct hover, so changing row heights updates the highlight under a stationary pointer. New `ignore` option for non-item content that must highlight nothing.
- `createProximityHover` and `createHighlightIndicator` return `remeasure()`, and measure again when a CSS animation or transform transition on an ancestor ends and changed the container's size on screen.
