# Changelog

## 0.1.0 (unreleased)

- Initial release of `@guillemservera/details-core`.
- Fix highlight lifecycle handling for focused, reparented and replaced containers; destroying the last attachment now clears selection and transient state without retaining removed DOM.
- `createHighlightIndicator`: glides with Web Animations sampled from its spring, so the compositor animates it and the main thread only works when the target changes; where `Element.animate` is missing it falls back automatically to per-frame writes of the same spring (no option). The per-frame fallback steps with `performance.now()` only, so Firefox no longer loses a frame when a mutation lands mid-glide.
- `createHighlightIndicator`: `reducedMotion` option (a boolean or getter, read on every update; defaults to `prefers-reduced-motion`), and mutation batches spread over microtasks are coalesced into one measurement before paint. A custom `target` also keeps the keyboard nudge when it marks the highlighted item.
- `createProximityHover`: the item under the pointer is highlighted in the pointer event itself, like native `:hover`; geometry still decides gaps and padding. Item resize tracking stays active after a direct hover, so changing row heights updates the highlight under a stationary pointer. New `ignore` option for non-item content that must highlight nothing.
- `createProximityHover` and `createHighlightIndicator` return `remeasure()`, and measure again when a CSS animation or transform transition on an ancestor ends and changed the container's size on screen.
