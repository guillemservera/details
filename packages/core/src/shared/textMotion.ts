import { read, type MaybeGetter } from './options'

export interface TextMotionOptions {
  /** Milliseconds per transition. Default 600; zero applies changes instantly. */
  duration?: MaybeGetter<number>
  /** Direction the outgoing text travels. Default 'up'. */
  direction?: MaybeGetter<'up' | 'down'>
  /** Default true. Reduced motion is always respected. */
  animated?: MaybeGetter<boolean>
}

/** What text effects return. */
export interface TextMotion {
  /** Settles on the current text when an option read through a getter changed since the last call. */
  update: () => void
  /** Stops observing and restores both elements. */
  destroy: () => void
}

export const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** Negative and non-finite values fall back to the default. */
export function nonNegative(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback
}

export function textDuration(options: TextMotionOptions) {
  return nonNegative(read(options.duration), 600)
}

export interface Layer {
  element: HTMLElement
  animation?: Animation
}

export function cancel(layer: Layer) {
  if (!layer.animation) return
  layer.animation.onfinish = null
  layer.animation.cancel()
  layer.animation = undefined
}

export function removeLayer(layer: Layer) {
  cancel(layer)
  layer.element.remove()
}

/** A whole-text row at the viewport's inline start. */
export function createLayer(viewport: HTMLElement, text: string, css: string) {
  const element = viewport.ownerDocument.createElement('span')
  element.textContent = text
  element.style.cssText = `position:absolute;top:0;inset-inline-start:0;display:block;white-space:pre;${css}`
  viewport.append(element)
  return element
}

/** Widens the viewport to its widest row while animating, so a shorter target does not clip leaving text. */
export function fitWidth(source: HTMLElement, viewport: HTMLElement, layers: Iterable<Layer>) {
  viewport.style.width = `${Math.max(
    source.getBoundingClientRect().width,
    ...Array.from(layers, layer => layer.element.getBoundingClientRect().width),
  )}px`
}

export interface TextRenderer {
  update(text: string, animate: boolean): void
  destroy(): void
  /** True while the renderer itself animates the source size. */
  resizing?(): boolean
}

/** Restore only the properties we own, not unrelated styles patched by a framework. */
function setStyles(el: HTMLElement, styles: Record<string, string>) {
  const previous = Object.keys(styles).map(key => [key, el.style.getPropertyValue(key), el.style.getPropertyPriority(key)] as const)
  for (const key in styles) el.style.setProperty(key, styles[key]!)
  return () => {
    for (const [key, value, priority] of previous) el.style.setProperty(key, value, priority)
  }
}

/**
 * The source keeps its accessible text, owned by the app; the empty sibling viewport belongs to the renderer.
 * Their parent must be position:relative and inline-block.
 */
export function createTextMotion(
  source: HTMLElement,
  viewport: HTMLElement,
  options: TextMotionOptions,
  create: (source: HTMLElement, viewport: HTMLElement) => TextRenderer,
): TextMotion {
  const text = source
  const view = viewport
  if (text === view || text.parentElement !== view.parentElement || text.contains(view) || view.contains(text) || view.childNodes.length) {
    throw new Error('Text motion needs sibling source and empty viewport elements.')
  }

  const parent = text.parentElement!
  const restoreSource = setStyles(text, { display: 'inline-block', 'white-space': 'pre', 'min-height': '1lh', opacity: '0' })
  const restoreViewport = setStyles(view, {
    position: 'absolute', top: '0', bottom: '0', 'inset-inline-start': '0', 'inset-inline-end': '0', width: '',
    overflow: 'hidden', 'pointer-events': 'none', 'white-space': 'pre',
  })
  const hidden = view.getAttribute('aria-hidden')
  view.setAttribute('aria-hidden', 'true')
  const renderer = create(text, view)
  const doc = text.ownerDocument
  const win = doc.defaultView!
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)')
  let current = text.textContent ?? ''
  let width = 0
  let height = 0
  // Serializing the resolved values ignores update calls where nothing changed.
  const resolvedOptions = () => JSON.stringify(Object.values(options).map(value => read(value)))
  let applied = resolvedOptions()

  function rememberSize() {
    const box = text.getBoundingClientRect()
    width = box.width
    height = box.height
  }

  function render(animate: boolean) {
    // Absolute offsets start at the parent's padding edge; the source starts at its content edge.
    const padding = win.getComputedStyle(parent)
    view.style.top = padding.paddingTop
    view.style.bottom = padding.paddingBottom
    view.style.insetInlineStart = padding.paddingInlineStart
    view.style.insetInlineEnd = padding.paddingInlineEnd
    renderer.update(current, animate && read(options.animated) !== false && !motion.matches && !doc.hidden && textDuration(options) > 0)
    rememberSize()
  }

  render(false)
  const mutations = new MutationObserver(() => {
    const next = text.textContent ?? ''
    if (next === current) return
    current = next
    render(true)
  })
  mutations.observe(text, { childList: true, characterData: true, subtree: true })
  const resize = new ResizeObserver(() => {
    const box = text.getBoundingClientRect()
    if (box.width === width && box.height === height) return
    if (renderer.resizing?.()) rememberSize()
    else render(false)
  })
  resize.observe(text)
  const settle = () => {
    if (motion.matches || doc.hidden) render(false)
  }
  motion.addEventListener('change', settle)
  doc.addEventListener('visibilitychange', settle)

  let destroyed = false
  return {
    update() {
      if (destroyed) return
      const next = resolvedOptions()
      if (next === applied) return
      applied = next
      render(false)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      mutations.disconnect()
      resize.disconnect()
      motion.removeEventListener('change', settle)
      doc.removeEventListener('visibilitychange', settle)
      renderer.destroy()
      restoreSource()
      restoreViewport()
      if (hidden == null) view.removeAttribute('aria-hidden')
      else view.setAttribute('aria-hidden', hidden)
    },
  }
}
