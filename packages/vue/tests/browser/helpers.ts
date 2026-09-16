import { createApp, h, type Component } from 'vue'

export function mount(component: Component) {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(component)
  app.mount(host)
  return {
    host,
    unmount() {
      app.unmount()
      host.remove()
    },
  }
}

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

export function item(label: string, props: Record<string, unknown> = {}) {
  return h('button', { 'data-highlight-item': '', 'tabindex': -1, 'style': 'display: block; height: 40px; width: 100%', ...props }, label)
}

export function highlighted(root: ParentNode) {
  return root.querySelector('[data-highlighted]')?.textContent ?? null
}
