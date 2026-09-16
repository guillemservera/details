# Changelog

## 0.1.0 (unreleased)

- Initial release of `@guillemservera/vue-details`: composables built on `@guillemservera/details-core`, with no third-party runtime dependencies beyond the `vue` peer dependency, published as ESM with one subpath per composable.
- `useProximityHover`: highlights the item under the pointer or the nearest one in gaps and padding, on x, y or both axes; follows content scrolling under a still pointer at once; supports virtualized lists, disabled items and gap clicks.
- `useArrowNavigation`: arrow keys, Home, End, Enter and Space, also while hovered; scrolls only its container; supports virtualized lists, looping and pointer hand-over after real mouse movement.
- `useHighlightIndicator`: springs one indicator onto the highlighted or selected item with no component renders per frame; honors reduced motion.
- `useRollingText`, `useMorphText` and `useRouletteText`: text transitions that keep the source text accessible and readable during SSR; every option accepts a value, ref or getter.
- `usePlatform`, `useInputCapabilities` and `useShortcuts`: hydration-safe platform and pointer detection, and keyboard shortcuts with sequences, platform-aware `mod` and editable-target handling; `/shortcuts` also re-exports the core label formatters.
- Highlight composables now update when eligible items receive focus, reconcile reparented or replaced containers, and clear detached state without retaining removed DOM.
- `useShortcuts` now avoids running its listener setup during SSR, including Vue 3.5.0's server-side `watchPostEffect`.
