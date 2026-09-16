import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export type ElementRef = RefObject<HTMLElement | null>

interface Instance {
  destroy: () => void
  update?: () => void
}

// React 18 warns about useLayoutEffect during server rendering, where neither effect runs.
const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect

/**
 * Runs `create` once every ref holds an element, and again when a ref holds another element or a dep changes;
 * otherwise calls the instance's `update`. A RefObject cannot notify when React swaps its element (a keyed
 * remount, conditional rendering), so the refs are compared in a layout effect after every commit of the calling
 * component, before paint. An element swapped by a child that re-renders on its own is picked up on this
 * component's next render. `options()` returns the options of the latest commit, for getters passed to the core.
 */
export function useElements<const R extends readonly ElementRef[], O>(
  refs: R,
  deps: readonly unknown[],
  options: O,
  create: (elements: { [K in keyof R]: HTMLElement }, options: () => O) => Instance,
): void {
  const latest = useRef(options)
  const attached = useRef<{ keys: unknown[], instance?: Instance } | null>(null)

  useIsomorphicLayoutEffect(() => {
    latest.current = options
    const elements = refs.map(ref => ref.current)
    const keys = [...elements, ...deps]
    const previous = attached.current
    if (previous && keys.every((key, i) => Object.is(key, previous.keys[i]))) return previous.instance?.update?.()
    previous?.instance?.destroy()
    attached.current = {
      keys,
      instance: elements.every(Boolean) ? create(elements as { [K in keyof R]: HTMLElement }, () => latest.current) : undefined,
    }
  })

  // A separate effect, so StrictMode's simulated unmount destroys the instance and the effect above creates it again.
  useIsomorphicLayoutEffect(() => () => {
    attached.current?.instance?.destroy()
    attached.current = null
  }, [])
}
