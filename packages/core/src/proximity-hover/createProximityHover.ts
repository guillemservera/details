import {
  DISABLED_ATTRS,
  ITEM,
  RESUME_DISTANCE,
  defaultStore,
  isEligible,
  type HighlightAxis,
  type HighlightBehavior,
  type HighlightStore,
} from '../shared/highlight'
import { onAncestorMotionEnd } from '../shared/motion'
import { read, type MaybeGetter } from '../shared/options'

export interface ProximityHoverOptions {
  /** Axis the nearest item is measured along: `y` for lists, `x` for strips, `xy` for grids and wrapping rows. */
  axis?: HighlightAxis
  /** Pixels the mouse must travel before it takes the highlight back from the keyboard. Default 6. */
  resumeDistance?: MaybeGetter<number>
  /** A click in a gap between items clicks the highlighted item. Default true. */
  gapClick?: MaybeGetter<boolean>
  /**
   * Selector of non-item content inside the container, such as group labels and headings: the pointer over it
   * highlights nothing, where a real gap highlights the nearest item.
   */
  ignore?: string
  /** Shared highlight state. Defaults to the container's own store. */
  store?: HighlightStore
}

/** What `createProximityHover` returns. */
export interface ProximityHover extends HighlightBehavior {
  /** Measures the items again, for geometry that changed without a DOM mutation or a resize. */
  remeasure: () => void
}

const OWN_CLICK = 'input, textarea, select, button, a, summary, [contenteditable], [role="button"]'

/**
 * Index of the rect (flat `[x, y, w, h, ...]`) under `(px, py)`; otherwise the one whose center is
 * nearest along `axis`. Ties keep the first. With `view` (the visible area), rects outside it are
 * skipped and mostly clipped rects only win when no mostly visible one exists.
 */
export function nearestIndex(rects: ArrayLike<number>, px: number, py: number, axis: HighlightAxis, view?: readonly number[]) {
  let best = -1
  let bestDistance = Infinity
  let clipped = -1
  let clippedDistance = Infinity
  for (let i = 0; i < rects.length; i += 4) {
    const x = rects[i]!
    const y = rects[i + 1]!
    const w = rects[i + 2]!
    const h = rects[i + 3]!
    let mostlyHidden = false
    if (view) {
      const visibleWidth = Math.min(x + w, view[2]!) - Math.max(x, view[0]!)
      const visibleHeight = Math.min(y + h, view[3]!) - Math.max(y, view[1]!)
      if (visibleWidth <= 0 || visibleHeight <= 0) continue
      mostlyHidden = visibleWidth < w / 2 || visibleHeight < h / 2
    }
    const inX = px >= x && px <= x + w
    const inY = py >= y && py <= y + h
    if (axis === 'y' ? inY : axis === 'x' ? inX : inX && inY) return i / 4
    const dx = axis === 'y' ? 0 : x + w / 2 - px
    const dy = axis === 'x' ? 0 : y + h / 2 - py
    const distance = dx * dx + dy * dy
    if (mostlyHidden) {
      if (distance < clippedDistance) [clippedDistance, clipped] = [distance, i / 4]
    }
    else if (distance < bestDistance) {
      [bestDistance, best] = [distance, i / 4]
    }
  }
  return best >= 0 ? best : clipped
}

/**
 * Highlights the item under the pointer or, in gaps and padding, the nearest one.
 * Items carry `data-highlight-item` (and `data-index` when virtualized); disabled items are skipped.
 * Arrow navigation and highlight indicators on the same container share its store.
 */
export function createProximityHover(container: HTMLElement, options: ProximityHoverOptions = {}): ProximityHover {
  const { axis = 'y', ignore, store = defaultStore(container) } = options
  const el = container
  let items: HTMLElement[] = []
  let rects = new Float64Array(0)
  let px = 0
  let py = 0
  let hovering = false
  let dirty = false // pick again on the next frame
  let forced = false // the pointer moved or the content scrolled under it
  let scrolled = false // the content moved under a still pointer since the last pick
  let stale = true // items must be measured again
  let pickedLeft = el.scrollLeft
  let pickedTop = el.scrollTop
  let measuredSize = ''
  let raf = 0
  const observed = new Set<Element>()
  const fresh = new Set<Element>()

  // Observing an element reports its current size once; only later resizes invalidate.
  const resizeObserver = new ResizeObserver((entries) => {
    let resized = false
    for (const entry of entries) if (!fresh.delete(entry.target)) resized = true
    if (resized) invalidate()
  })
  // Virtualizers can remove a row from a ResizeObserver callback. Unobserve it from the mutation
  // callback before resize observation gathers again, even when the pointer is not hovering.
  const mutationObserver = new MutationObserver(() => {
    for (const item of observed) {
      if (el.contains(item)) continue
      observed.delete(item)
      fresh.delete(item)
      resizeObserver.unobserve(item)
    }
    invalidate()
  })
  const detach = store.attach(el)
  const release = store.claimPointer()
  // Rects measured while an ancestor was scaled (an enter zoom) are off, and nothing mutates when it ends.
  const stopMotionEnd = onAncestorMotionEnd(el, () => {
    if (!stale && sizeOf(el.getBoundingClientRect()) !== measuredSize) invalidate()
  })

  fresh.add(el)
  resizeObserver.observe(el)
  mutationObserver.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-index', ...DISABLED_ATTRS] })

  function invalidate() {
    stale = true
    if (hovering && !store.pointerSuspended()) {
      dirty = true
      schedule()
    }
  }

  function sizeOf(rect: DOMRect) {
    return `${rect.width} ${rect.height}`
  }

  function measure() {
    stale = false
    const box = el.getBoundingClientRect()
    measuredSize = sizeOf(box)
    const originX = box.left + el.clientLeft - el.scrollLeft
    const originY = box.top + el.clientTop - el.scrollTop
    items = store.items()
    if (rects.length !== items.length * 4) rects = new Float64Array(items.length * 4)
    const current = new Set<Element>()
    // getBoundingClientRect rather than offsetTop: virtualizers position items with transforms.
    items.forEach((item, i) => {
      const r = item.getBoundingClientRect()
      rects.set([r.left - originX, r.top - originY, r.width, r.height], i * 4)
      current.add(item)
      if (!observed.has(item)) {
        observed.add(item)
        fresh.add(item)
        resizeObserver.observe(item)
      }
    })
    for (const item of observed) {
      if (current.has(item)) continue
      observed.delete(item)
      fresh.delete(item)
      resizeObserver.unobserve(item)
    }
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(pick)
  }

  function pick() {
    raf = 0
    if (!hovering || store.pointerSuspended()) return
    if (stale) measure()
    if (!dirty) return
    // A virtualizer can re-render mid-scroll before the scroll event arrives; that event re-picks.
    if (!forced && (el.scrollLeft !== pickedLeft || el.scrollTop !== pickedTop)) return
    dirty = forced = false
    pickedLeft = el.scrollLeft
    pickedTop = el.scrollTop
    if (hitTest(el.ownerDocument.elementFromPoint(px, py), scrolled)) {
      scrolled = false
      return
    }
    const box = el.getBoundingClientRect()
    const index = nearestIndex(
      rects,
      px - box.left - el.clientLeft + el.scrollLeft,
      py - box.top - el.clientTop + el.scrollTop,
      axis,
      [el.scrollLeft, el.scrollTop, el.scrollLeft + el.clientWidth, el.scrollTop + el.clientHeight],
    )
    const item = items[index] ?? null
    if (item !== store.highlighted || store.source !== 'pointer') {
      store.snap = scrolled
      store.highlight(item, 'pointer')
    }
    scrolled = false
  }

  /**
   * The element under the pointer decides first, like native `:hover`: an eligible item is highlighted at once and
   * ignored content highlights nothing. Returns false in gaps and padding, which geometry decides.
   */
  function hitTest(target: Element | null, snap: boolean) {
    if (!target || target === el || !el.contains(target)) return false
    const item = target.closest(ITEM)
    if (item && el.contains(item) && isEligible(item)) {
      if (item !== store.highlighted || store.source !== 'pointer') {
        store.snap = snap
        store.highlight(item, 'pointer')
      }
      return true
    }
    if (!ignore || item || !target.closest(ignore)) return false
    if (store.source === 'pointer') store.highlight(null, null)
    return true
  }

  function onPointerEnter(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    hovering = true
    stale = true
    onPointerMove(e)
  }

  function onPointerMove(e: PointerEvent) {
    if (!hovering) return
    px = e.clientX
    py = e.clientY
    if (!store.acceptsPointer(e, read(options.resumeDistance) ?? RESUME_DISTANCE)) return
    if (hitTest(e.target as Element, false)) {
      // A pick queued for an earlier position must not override this one.
      dirty = forced = scrolled = false
      if (stale) schedule()
      return
    }
    dirty = forced = true
    schedule()
  }

  function onPointerLeave() {
    hovering = false
    store.resumePointer()
    if (store.source === 'pointer') store.highlight(null, null)
  }

  // Content moving under a still pointer is followed at once, like native :hover.
  function onScroll() {
    if (!hovering || store.pointerSuspended()) return
    dirty = forced = scrolled = true
    schedule()
  }

  // A click between items activates the highlighted one; clicks on items or other controls keep their target.
  function onClick(e: MouseEvent) {
    const item = store.highlighted
    if (!item || !(read(options.gapClick) ?? true) || (e.target as Element).closest(`${ITEM}, ${OWN_CLICK}`)) return
    item.click()
  }

  const listeners = [
    ['pointerenter', onPointerEnter],
    ['pointermove', onPointerMove],
    ['pointerleave', onPointerLeave],
    ['scroll', onScroll],
    ['click', onClick],
  ] as const
  for (const [type, listener] of listeners) el.addEventListener(type, listener as EventListener, { passive: true })

  return {
    store,
    remeasure: invalidate,
    destroy() {
      cancelAnimationFrame(raf)
      stopMotionEnd()
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      for (const [type, listener] of listeners) el.removeEventListener(type, listener as EventListener)
      release()
      detach()
    },
  }
}
