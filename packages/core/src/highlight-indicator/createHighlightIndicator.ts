import { HIGHLIGHT_ATTR, defaultStore, type HighlightBehavior, type HighlightStore } from '../shared/highlight'

// Critically damped spring durations in seconds, after Fluid Functionalism's fast and moderate tiers.
const SPRINGS = { fast: 0.08, smooth: 0.1, moderate: 0.16 }
const FADE_IN = 0.08
const FADE_OUT = 0.06
const HIGHLIGHTED = `[${HIGHLIGHT_ATTR}]`
const INDICATOR_ATTR = 'data-highlight-indicator'

export interface HighlightIndicatorOptions {
  /** Item to sit on. Defaults to the highlighted item; e.g. `[aria-selected="true"]` for the active tab. */
  target?: string
  /** A new session grows out of this item and returns into it when it ends. */
  from?: string
  /** `smooth` (100ms) follows the pointer, `fast` (80ms) is snappier, `moderate` (160ms) suits a moving selection. */
  motion?: keyof typeof SPRINGS
  /** Shared highlight state. Defaults to the container's own store. */
  store?: HighlightStore
}

/**
 * Advances a critically damped spring by `dt` seconds on every channel, solved in closed form so it is
 * exact at any frame time and keeps its velocity when the target changes. Returns whether it settled.
 */
export function stepSpring(pos: Float64Array, vel: Float64Array, target: Float64Array, duration: number, dt: number) {
  // framer-motion's `{ type: 'spring', duration, bounce: 0 }`: the envelope e^-x(1 + x) reaches 0.001 at x ≈ 9.23.
  const omega = 9.23 / duration
  const decay = Math.exp(-omega * dt)
  let settled = true
  for (let i = 0; i < pos.length; i++) {
    const offset = pos[i]! - target[i]!
    const b = vel[i]! + omega * offset
    const nextOffset = (offset + b * dt) * decay
    const nextVelocity = (vel[i]! - omega * b * dt) * decay
    pos[i] = target[i]! + nextOffset
    vel[i] = nextVelocity
    if (Math.abs(nextOffset) > 0.1 || Math.abs(nextVelocity) > 2) settled = false
  }
  if (settled) {
    pos.set(target)
    vel.fill(0)
  }
  return settled
}

/**
 * Springs an indicator onto the item matching `target`, whoever marks it: pointer, keyboard, a framework or a headless menu.
 * The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`.
 * Transform, size and opacity are written directly on every frame.
 */
export function createHighlightIndicator(
  container: HTMLElement,
  indicator: HTMLElement,
  options: HighlightIndicatorOptions = {},
): HighlightBehavior {
  const { target: selector = HIGHLIGHTED, from, motion = 'smooth', store = defaultStore(container) } = options
  const followsHighlight = selector === HIGHLIGHTED
  const el = container
  const ind = indicator
  const originalStyles = (['opacity', 'transform', 'width', 'height'] as const).map(property => [
    property,
    ind.style.getPropertyValue(property),
    ind.style.getPropertyPriority(property),
  ] as const)
  const originalIndicatorAttr = ind.getAttribute(INDICATOR_ATTR)
  const pos = new Float64Array(4)
  const vel = new Float64Array(4)
  const target = new Float64Array(4)
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let opacity = 0
  let visible = false
  let initial = true
  let current: Element | null = null
  let needsSync = true
  let raf = 0
  let last = 0
  let destroyed = false

  const resizeObserver = new ResizeObserver(invalidate)
  // Indicators ignore their own style writes, or two indicators in one container would keep each other running.
  const mutationObserver = new MutationObserver((records) => {
    if (records.some(record => !(record.target instanceof Element && record.target.hasAttribute(INDICATOR_ATTR)))) invalidate()
  })
  ind.setAttribute(INDICATOR_ATTR, '')
  ind.style.opacity = '0'
  resizeObserver.observe(el)
  mutationObserver.observe(el, { subtree: true, childList: true, attributes: true, characterData: true })
  invalidate()

  // Observer callbacks run before paint: syncing right away keeps the indicator on the same frame as the
  // content, where waiting for the next animation frame would leave it one frame behind while scrolling.
  function invalidate() {
    if (destroyed) return
    needsSync = true
    if (raf) cancelAnimationFrame(raf)
    else last = 0
    raf = 0
    frame(performance.now())
  }

  function measure(item: Element, out: Float64Array) {
    const box = el.getBoundingClientRect()
    const rect = item.getBoundingClientRect()
    out.set([
      rect.left - box.left - el.clientLeft + el.scrollLeft,
      rect.top - box.top - el.clientTop + el.scrollTop,
      rect.width,
      rect.height,
    ])
  }

  function sync() {
    needsSync = false
    const item = el.querySelector(selector)
    const origin = from ? el.querySelector(from) : null
    const changed = item !== current
    const snap = changed && followsHighlight && store.snap
    if (changed) {
      if (current) resizeObserver.unobserve(current)
      if (item) resizeObserver.observe(item)
      current = item
      if (followsHighlight) {
        // The keyboard scrolled the content, and the indicator with it: keep its on-screen position.
        const nudge = store.nudge
        if (visible && nudge?.item === item) pos.set([pos[0]! + nudge.dx, pos[1]! + nudge.dy], 0)
        store.nudge = undefined
        store.snap = false
      }
    }
    if (!item) {
      visible = false
      if (origin) measure(origin, target)
      return
    }
    measure(item, target)
    if (snap && visible) {
      pos.set(target)
      vel.fill(0)
    }
    if (!visible) {
      // A new session fades in where it lands, or grows out of `from`, instead of sliding from the last one.
      visible = true
      opacity = initial ? 1 : 0
      if (origin && !initial) measure(origin, pos)
      else pos.set(target)
      vel.fill(0)
    }
  }

  function frame(now: number) {
    if (destroyed) return
    raf = 0
    if (needsSync) sync()
    initial = false
    // A frame timestamp can predate the event that requested it; never step the spring backwards.
    const dt = last ? Math.min(Math.max(now - last, 0) / 1000, 0.1) : 1 / 60
    last = now
    opacity = visible ? Math.min(1, opacity + dt / FADE_IN) : Math.max(0, opacity - dt / FADE_OUT)
    const settled = reducedMotion.matches ? (pos.set(target), true) : stepSpring(pos, vel, target, SPRINGS[motion], dt)
    ind.style.opacity = String(opacity)
    ind.style.transform = `translate3d(${pos[0]}px, ${pos[1]}px, 0)`
    ind.style.width = `${pos[2]}px`
    ind.style.height = `${pos[3]}px`
    if (!settled || opacity !== (visible ? 1 : 0)) raf = requestAnimationFrame(frame)
  }

  return {
    store,
    destroy() {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      for (const [property, value, priority] of originalStyles) {
        if (value) ind.style.setProperty(property, value, priority)
        else ind.style.removeProperty(property)
      }
      if (originalIndicatorAttr == null) ind.removeAttribute(INDICATOR_ATTR)
      else ind.setAttribute(INDICATOR_ATTR, originalIndicatorAttr)
    },
  }
}
