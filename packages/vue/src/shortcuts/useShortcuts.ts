import { toValue, watchPostEffect, type MaybeRefOrGetter } from 'vue'
import { createShortcutKeydownHandler, type ShortcutBinding, type ShortcutKeydownHandlerOptions } from '@guillemservera/details-core/shortcuts'

export interface ShortcutsOptions extends ShortcutKeydownHandlerOptions {
  /** Where to listen for `keydown`. Default `window`; a ref holding `null` listens nowhere. */
  target?: MaybeRefOrGetter<EventTarget | null | undefined>
  /** Listen in the capture phase, before handlers inside the page. Default `true`. */
  capture?: boolean
}

/**
 * Runs bindings on matching keydown events, including sequences such as `g-d`.
 * Bindings are read on every keystroke, so a ref or getter can change them at any time.
 * `mod` is ⌘ on Apple platforms and Ctrl elsewhere.
 */
export function useShortcuts(bindings: MaybeRefOrGetter<readonly ShortcutBinding[]>, options: ShortcutsOptions = {}): void {
  if (typeof window === 'undefined') return
  const { handleKeydown, resetSequence } = createShortcutKeydownHandler(() => toValue(bindings), options)
  const capture = options.capture ?? true
  watchPostEffect((onCleanup) => {
    const target = options.target === undefined ? window : toValue(options.target)
    if (!target) return
    target.addEventListener('keydown', handleKeydown as EventListener, { capture })
    onCleanup(() => {
      target.removeEventListener('keydown', handleKeydown as EventListener, { capture })
      resetSequence()
    })
  })
}
