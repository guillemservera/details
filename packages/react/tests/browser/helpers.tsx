import { act, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

export function render(ui: ReactNode, { strict = false } = {}) {
  const host = document.body.appendChild(document.createElement('div'))
  const root = createRoot(host)
  const wrap = (node: ReactNode) => (strict ? <StrictMode>{node}</StrictMode> : node)
  act(() => root.render(wrap(ui)))
  return {
    host,
    rerender(next: ReactNode) {
      act(() => root.render(wrap(next)))
    },
    unmount() {
      act(() => root.unmount())
      host.remove()
    },
  }
}

export type Rendered = ReturnType<typeof render>

export function frames(count = 3) {
  return new Promise<void>((resolve) => {
    const tick = () => (--count > 0 ? requestAnimationFrame(tick) : resolve())
    requestAnimationFrame(tick)
  })
}

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Resolves in the next frame after animation frame callbacks and layout, right before paint. */
export function beforePaint() {
  return new Promise<void>((resolve) => {
    const probe = document.body.appendChild(document.createElement('div'))
    const observer = new ResizeObserver(() => {
      observer.disconnect()
      probe.remove()
      resolve()
    })
    requestAnimationFrame(() => observer.observe(probe))
  })
}

export function Item({ label, ...props }: { label: string, [prop: string]: unknown }) {
  return <button data-highlight-item="" tabIndex={-1} style={{ display: 'block', height: 40, width: '100%' }} {...props}>{label}</button>
}

export function highlighted(root: ParentNode) {
  return root.querySelector('[data-highlighted]')?.textContent ?? null
}

/** Runs user events inside act, so the re-renders they cause are flushed before assertions. */
export function user<T>(event: () => Promise<T>) {
  return act(event)
}
