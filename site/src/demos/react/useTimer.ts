import { useEffect, useRef } from 'react'

/** One pending timeout for the interruption buttons; a new one replaces it and unmount clears it. */
export function useTimer() {
  const id = useRef<number | undefined>(undefined)
  const clear = () => clearTimeout(id.current)
  useEffect(() => clear, [])
  return {
    clear,
    set: (fn: () => void, ms: number) => {
      clear()
      id.current = window.setTimeout(fn, ms)
    },
  }
}
