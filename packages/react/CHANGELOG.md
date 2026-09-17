# Changelog

## 0.1.0 (unreleased)

- Initial release of `@guillemservera/react-details`: hooks built on `@guillemservera/details-core`, with no third-party runtime dependencies beyond the `react` peer dependency, published as ESM with one subpath per hook.
- `useProximityHover`: highlights the item under the pointer or the nearest one in gaps and padding, on x, y or both axes; follows content scrolling under a still pointer at once; supports virtualized lists, disabled items and gap clicks.
- `useArrowNavigation`: arrow keys, Home, End, Enter and Space, also while hovered; scrolls only its container; supports virtualized lists, looping and pointer hand-over after real mouse movement.
- `useHighlightIndicator`: springs one indicator onto the highlighted or selected item with no renders per frame; honors reduced motion.
- `useRollingText`, `useMorphText` and `useRouletteText`: text transitions that keep the React-owned source text accessible and readable during SSR; option props apply without re-creating the effect.
- `usePlatform`, `useInputCapabilities` and `useShortcuts`, plus the shortcut label formatters; server renders and hydration use stable defaults.
- Highlight hooks share store identity through the container ref, follow late-mounted and replaced elements, and work under `<StrictMode>`; selection is not guaranteed to survive replacement.
- Highlight hooks now update when eligible items receive focus, reconcile reparented or replaced containers, and clear detached state without retaining removed DOM.
- `useShortcuts` re-attaches when its `platform` override changes, so `mod` keeps matching the current platform.
- `useHighlightIndicator`: compositor-driven Web Animations glide with an automatic per-frame fallback where `Element.animate` is missing, `reducedMotion` option (read on every update without re-creating), and returns a stable `{ remeasure }`.
- `useProximityHover`: highlights the item under the pointer in the event itself, adds the `ignore` option and returns a stable `remeasure`.
- `useHighlightStore(container)`: the shared highlight store and its state, exported from `/proximity-hover`, `/arrow-navigation`, `/highlight-indicator` and the root, for components that own their highlight model. It attaches to the container independently of pointer and keyboard hooks, reconciles removed items and cleans up on replacement or unmount.
