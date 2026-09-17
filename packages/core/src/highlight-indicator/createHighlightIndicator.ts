import { HIGHLIGHT_ATTR, defaultStore, type HighlightBehavior, type HighlightStore } from '../shared/highlight'
import { onAncestorMotionEnd } from '../shared/motion'
import { read, type MaybeGetter } from '../shared/options'

// Critically damped spring durations in seconds, after Fluid Functionalism's fast and moderate tiers.
const SPRINGS = { fast: 0.08, smooth: 0.1, moderate: 0.16 }
const FADE_IN = 0.08
const FADE_OUT = 0.06
const HIGHLIGHTED = `[${HIGHLIGHT_ATTR}]`
const INDICATOR_ATTR = 'data-highlight-indicator'
const FRAME = 1000 / 60
// Chromium services an animation on the main thread for its last few frames; motion ends long before this and the
// animation is cancelled then, so it never gets there.
const HOLD = 1000
// Keyframes sample the spring at 120 Hz; the compositor interpolates linearly between samples.
const SAMPLE = 1 / 120

export interface HighlightIndicatorOptions {
  /** Item to sit on. Defaults to the highlighted item; e.g. `[aria-selected="true"]` for the active tab. */
  target?: string
  /** A new session grows out of this item and returns into it when it ends. */
  from?: string
  /** `smooth` (100ms) follows the pointer, `fast` (80ms) is snappier, `moderate` (160ms) suits a moving selection. */
  motion?: keyof typeof SPRINGS
  /** Jump instead of gliding; fades still run. Read on every update. Default: `prefers-reduced-motion: reduce`. */
  reducedMotion?: MaybeGetter<boolean>
  /** Shared highlight state. Defaults to the container's own store. */
  store?: HighlightStore
}

/** What `createHighlightIndicator` returns. */
export interface HighlightIndicator extends HighlightBehavior {
  /** Measures the target again, for geometry that changed without a DOM mutation or a resize. */
  remeasure: () => void
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
 * `stepSpring` from `pos` and `vel` sampled every `step` seconds until it settles, for at most one second.
 * The first sample is the start and the last one is `target`.
 */
export function sampleSpring(pos: Float64Array, vel: Float64Array, target: Float64Array, duration: number, step = SAMPLE) {
  const p = pos.slice()
  const v = vel.slice()
  const samples = [p.slice()]
  for (let settled = false; !settled && samples.length <= 1 / step;) {
    settled = stepSpring(p, v, target, duration, step)
    samples.push(p.slice())
  }
  samples[samples.length - 1] = target.slice()
  return samples
}

/** A Web Animation started at `start` (the `performance.now()` time base) whose motion lasts `end` ms. */
interface Run { anim: Animation, start: number, end: number, stop: () => void }
interface Glide extends Run { pos: Float64Array, vel: Float64Array }
interface Fade extends Run { from: number, to: number }

const inFlight = (run: Run | undefined, now: number) => !!run && now - run.start < run.end
const translate = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0)`
const same = (a: ArrayLike<number>, b: ArrayLike<number>, start = 0, end = a.length) => {
  for (let i = start; i < end; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * Springs an indicator onto the item matching `target`, whoever marks it: pointer, keyboard, a framework or a headless menu.
 * The container is `position: relative` and may scroll; the indicator is `position: absolute; top: 0; left: 0`.
 * Transform, size and opacity are written directly, and animated with Web Animations (or on every frame where `Element.animate` is missing).
 */
export function createHighlightIndicator(
  container: HTMLElement,
  indicator: HTMLElement,
  options: HighlightIndicatorOptions = {},
): HighlightIndicator {
  const { target: selector = HIGHLIGHTED, from, motion = 'smooth', store = defaultStore(container) } = options
  const followsHighlight = selector === HIGHLIGHTED
  const el = container
  const ind = indicator
  const spring = SPRINGS[motion]
  // Web Animations run the glide on the compositor; per-frame writes are the fallback without `Element.animate`.
  const waapi = typeof ind.animate === 'function'
  const originalStyles = (['opacity', 'transform', 'width', 'height'] as const).map(property => [
    property,
    ind.style.getPropertyValue(property),
    ind.style.getPropertyPriority(property),
  ] as const)
  const originalIndicatorAttr = ind.getAttribute(INDICATOR_ATTR)
  const pos = new Float64Array(4)
  const vel = new Float64Array(4)
  const target = new Float64Array(4)
  const zero = new Float64Array(4)
  const osReducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const reducedMotion = () => read(options.reducedMotion) ?? osReducedMotion.matches
  let opacity = 0
  let visible = false
  let initial = true
  let jumped = false // sync() moved the indicator or started a session: animations restart
  let current: Element | null = null
  let needsSync = true
  let queued = false
  let pending = false // records arrived since the last microtask hop
  let raf = 0
  let last = 0
  let measuredSize = ''
  let writtenSize = ''
  let destroyed = false
  // Web Animations: the running glide and fade, with the state each one started from.
  let glide: Glide | undefined
  let fade: Fade | undefined

  const resizeObserver = new ResizeObserver(invalidate)
  // Indicators ignore their own style writes, or two indicators in one container would keep each other running.
  // Microtask-driven mutations (a framework patch, other observers mirroring it) are coalesced into one sync: it
  // waits one more microtask while records keep arriving, and still runs before paint.
  const mutationObserver = new MutationObserver((records) => {
    if (records.every(record => record.target instanceof Element && record.target.hasAttribute(INDICATOR_ATTR))) return
    pending = true
    if (queued) return
    queued = true
    queueMicrotask(flush)
  })
  // Measures taken while an ancestor was scaled (an enter zoom) are off, and nothing mutates when it ends.
  const stopMotionEnd = onAncestorMotionEnd(el, () => {
    if (current && sizeOf(el.getBoundingClientRect()) !== measuredSize) invalidate()
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
    if (waapi) return update()
    if (raf) cancelAnimationFrame(raf)
    else last = 0
    raf = 0
    frame()
  }

  function flush() {
    if (pending) {
      pending = false
      return queueMicrotask(flush)
    }
    queued = false
    invalidate()
  }

  function sizeOf(rect: DOMRect) {
    return `${rect.width} ${rect.height}`
  }

  function measure(item: Element, out: Float64Array) {
    const box = el.getBoundingClientRect()
    const rect = item.getBoundingClientRect()
    measuredSize = sizeOf(box)
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
      // The keyboard scrolled the content, and the indicator with it: keep its on-screen position.
      const nudge = store.nudge
      if (nudge?.item === item && visible) {
        pos.set([pos[0]! + nudge.dx, pos[1]! + nudge.dy], 0)
        jumped = true
      }
      if (followsHighlight || nudge?.item === item) store.nudge = undefined
      if (followsHighlight) store.snap = false
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
      jumped = true
    }
    if (!visible) {
      // A new session fades in where it lands, or grows out of `from`, instead of sliding from the last one.
      visible = true
      opacity = initial ? 1 : 0
      if (origin && !initial) measure(origin, pos)
      else pos.set(target)
      vel.fill(0)
      jumped = true
    }
  }

  function frame() {
    if (destroyed) return
    raf = 0
    // One clock: a frame's timestamp can predate the step an invalidation just took (Firefox), which lost a frame.
    const now = performance.now()
    if (needsSync) sync()
    initial = false
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60
    last = now
    opacity = visible ? Math.min(1, opacity + dt / FADE_IN) : Math.max(0, opacity - dt / FADE_OUT)
    const settled = reducedMotion() ? (pos.set(target), vel.fill(0), true) : stepSpring(pos, vel, target, spring, dt)
    ind.style.opacity = String(opacity)
    ind.style.transform = translate(pos[0]!, pos[1]!)
    ind.style.width = `${pos[2]}px`
    ind.style.height = `${pos[3]}px`
    if (!settled || opacity !== (visible ? 1 : 0)) raf = requestAnimationFrame(frame)
  }

  // Web Animations engine: runs on invalidation only. The closed-form spring gives the running glide's state at any
  // time; a retarget restarts from there with the same velocity. Animations start at explicit times on the document
  // timeline, whose time base is `performance.now()`'s. Like the per-frame engine, which steps toward the new target
  // from its last frame, a retarget mid-flight takes effect at the last frame: the timeline's current time, which is
  // that frame's time (Chromium, Firefox) or now (WebKit), and never more than a frame ago.
  function update() {
    const now = performance.now()
    const lastFrame = Math.min(now, Math.max(now - FRAME, Number(ind.ownerDocument.timeline.currentTime) || 0))
    const glideAt = inFlight(glide, now) ? lastFrame : now
    const fadeAt = inFlight(fade, now) ? lastFrame : now
    if (glide) {
      pos.set(glide.pos)
      vel.set(glide.vel)
      stepSpring(pos, vel, target, spring, Math.max(0, glideAt - glide.start) / 1000)
    }
    if (fade) opacity = fade.from + (fade.to - fade.from) * Math.min(1, Math.max(0, fadeAt - fade.start) / fade.end)
    const before = target.slice()
    const wasVisible = visible
    jumped = false
    sync()
    initial = false
    if (reducedMotion() && !(same(pos, target) && same(vel, zero))) {
      pos.set(target)
      vel.fill(0)
      jumped = true
    }
    if (jumped || !same(before, target)) startGlide(glideAt)
    if (jumped || visible !== wasVisible) startFade(fadeAt)
  }

  /**
   * Plays `frames`, sampled every SAMPLE seconds, then holds the last one until the motion is over and it is
   * cancelled; the resting value is already inline, so that changes nothing on screen. Mid-flight the animation
   * starts `now`, from the state computed for `now`; from rest it starts one frame earlier, as the per-frame engine
   * steps once right away. `fill: backwards` covers a timeline that has not caught up with the start yet.
   */
  function play(frames: Keyframe[], now: number, moving: boolean, done: () => void): Run {
    const end = (frames.length - 1) * SAMPLE * 1000
    const duration = end + HOLD
    const keyframes = frames.map((frame, i) => ({ ...frame, offset: (i * SAMPLE * 1000) / duration }))
    keyframes.push({ ...frames[frames.length - 1]!, offset: 1 })
    const start = moving ? now : now - FRAME
    const anim = ind.animate(keyframes, { duration, fill: 'backwards' })
    anim.startTime = start
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      const left = start + end - performance.now()
      if (left > 0) return void (timer = setTimeout(check, left))
      anim.cancel()
      done()
    }
    timer = setTimeout(check, end)
    return {
      anim,
      start,
      end,
      stop() {
        clearTimeout(timer)
        anim.cancel()
      },
    }
  }

  function startGlide(now: number) {
    const moving = inFlight(glide, now)
    glide?.stop()
    glide = undefined
    ind.style.transform = translate(target[0]!, target[1]!)
    const size = `${target[2]} ${target[3]}`
    if (size !== writtenSize) {
      writtenSize = size
      ind.style.width = `${target[2]}px`
      ind.style.height = `${target[3]}px`
    }
    if (same(pos, target) && same(vel, zero)) return
    // Width and height animate on the main thread: only include them when they change.
    const resizes = !same(pos, target, 2) || !same(vel, zero, 2)
    const frames = sampleSpring(pos, vel, target, spring).map((s): Keyframe => resizes
      ? { transform: translate(s[0]!, s[1]!), width: `${s[2]}px`, height: `${s[3]}px` }
      : { transform: translate(s[0]!, s[1]!) })
    const from = { pos: pos.slice(), vel: vel.slice() }
    const own: Glide = Object.assign(play(frames, now, moving, () => {
      if (glide !== own) return
      glide = undefined
      pos.set(target)
      vel.fill(0)
    }), from)
    glide = own
  }

  function startFade(now: number) {
    const moving = inFlight(fade, now)
    fade?.stop()
    fade = undefined
    const to = visible ? 1 : 0
    ind.style.opacity = String(to)
    if (opacity === to) return
    const from = opacity
    const steps = Math.max(1, Math.round(Math.abs(to - from) * (visible ? FADE_IN : FADE_OUT) / SAMPLE))
    const frames = Array.from({ length: steps + 1 }, (_, i): Keyframe => ({ opacity: from + ((to - from) * i) / steps }))
    const own: Fade = Object.assign(play(frames, now, moving, () => {
      if (fade !== own) return
      fade = undefined
      opacity = to
    }), { from, to })
    fade = own
  }

  return {
    store,
    remeasure: invalidate,
    destroy() {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(raf)
      glide?.stop()
      fade?.stop()
      stopMotionEnd()
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
