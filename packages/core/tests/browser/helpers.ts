import { userEvent } from 'vitest/browser'

const cleanups: (() => void)[] = []

/** Runs registered cleanups in reverse order; call it from `afterEach`. */
export function cleanup() {
  while (cleanups.length) cleanups.pop()!()
}

/** Appends `node` to the body until the next cleanup. */
export function append<T extends Element>(node: T) {
  document.body.append(node)
  cleanups.push(() => node.remove())
  return node
}

/** Destroys `instance` on the next cleanup, before the elements appended earlier are removed. */
export function track<T extends { destroy(): void }>(instance: T) {
  cleanups.push(() => instance.destroy())
  return instance
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, children: (Node | string)[] = []) {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value)
  node.append(...children)
  return node
}

export function item(label: string, attrs: Record<string, string | undefined> = {}) {
  return h('button', { 'data-highlight-item': '', 'tabindex': '-1', 'style': 'display: block; height: 40px; width: 100%', ...attrs }, [label])
}

export function highlighted(root: ParentNode) {
  return root.querySelector('[data-highlighted]')?.textContent ?? null
}

export function frames(count = 3) {
  return new Promise<void>((resolve) => {
    const tick = () => (--count > 0 ? requestAnimationFrame(tick) : resolve())
    requestAnimationFrame(tick)
  })
}

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Moves the real mouse to a corner, so a list created under a resting cursor is not hovered. */
export async function parkPointer() {
  const corner = document.createElement('div')
  corner.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 2px; height: 2px'
  document.body.append(corner)
  await userEvent.hover(corner)
  corner.remove()
}

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

/** Replaces the source text; the source's MutationObserver retargets in the following microtask. */
export async function change(source: HTMLElement, value: string) {
  source.textContent = value
  await Promise.resolve()
}

/** A positioned inline-block parent with the source and its empty viewport sibling. */
export function textFixture(text: string, style: string) {
  const source = h('span', {}, [text])
  const viewport = h('span')
  append(h('span', { style: `position:relative;display:inline-block;${style}` }, [source, viewport]))
  return { source, viewport }
}

export function row(viewport: HTMLElement, text: string) {
  return Array.from(viewport.children).find(element => element.textContent === text)!
}

export function seek(root: Element, time: number) {
  for (const animation of root.getAnimations({ subtree: true })) {
    animation.pause()
    animation.currentTime = time
  }
}

export async function finish(root: Element) {
  for (const animation of root.getAnimations({ subtree: true })) animation.finish()
  await frames()
}
