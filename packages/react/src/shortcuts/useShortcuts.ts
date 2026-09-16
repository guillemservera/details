import { useEffect, useRef } from 'react'
import { createShortcutKeydownHandler, type ShortcutBinding, type ShortcutKeydownHandlerOptions } from '@guillemservera/details-core/shortcuts'

export interface ShortcutsOptions extends ShortcutKeydownHandlerOptions {
  /** Where to listen for `keydown`. Default `window`; `null` listens nowhere. Changing it re-attaches the listener. */
  target?: EventTarget | null
  /** Listen in the capture phase, before handlers inside the page. Default `true`. */
  capture?: boolean
}

/**
 * Runs bindings on matching keydown events, including sequences such as `g-d`.
 * Bindings and options are read from the latest render on every keystroke, so inline arrays and handlers
 * never re-attach the listener; changing `platform` re-attaches so `mod` keeps matching the current platform.
 */
export function useShortcuts(bindings: readonly ShortcutBinding[], options: ShortcutsOptions = {}): void {
  const latest = useRef({ bindings, options })
  useEffect(() => {
    latest.current = { bindings, options }
  })

  const { target, capture = true, platform } = options
  useEffect(() => {
    const listener = target === undefined ? window : target
    if (!listener) return
    const { handleKeydown, resetSequence } = createShortcutKeydownHandler(() => latest.current.bindings, {
      platform: latest.current.options.platform,
      get sequenceTimeoutMs() { return latest.current.options.sequenceTimeoutMs },
      get preventDefault() { return latest.current.options.preventDefault },
      get respectDefaultPrevented() { return latest.current.options.respectDefaultPrevented },
      get shouldHandle() { return latest.current.options.shouldHandle },
    })
    listener.addEventListener('keydown', handleKeydown as EventListener, { capture })
    return () => {
      listener.removeEventListener('keydown', handleKeydown as EventListener, { capture })
      resetSequence()
    }
  }, [target, capture, platform])
}
