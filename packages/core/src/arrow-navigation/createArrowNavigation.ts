import {
  ITEM,
  RESUME_DISTANCE,
  defaultStore,
  isEligible,
  type HighlightAxis,
  type HighlightBehavior,
  type HighlightStore,
} from '../shared/highlight'
import { read, type MaybeGetter } from '../shared/options'

export interface ArrowNavigationOptions {
  /** `y`: ↑ ↓, `x`: ← →, `xy`: both pairs, in item order. */
  axis?: HighlightAxis
  /** Wrap from the last item to the first and back. Default false. */
  loop?: MaybeGetter<boolean>
  /** Keys also work while the pointer is over the container, before it has focus. Default true. */
  whileHovered?: MaybeGetter<boolean>
  /** Pixels the mouse must travel before hover takes the highlight back from the keyboard. Default 6. */
  resumeDistance?: MaybeGetter<number>
  /** Total items of a virtualized list; items carry `data-index`. Disabled items are only skipped when rendered. */
  count?: MaybeGetter<number | undefined>
  /** Brings an unrendered item of a virtualized list into view. */
  scrollToIndex?: (index: number) => void
  /** Shared highlight state. Defaults to the container's own store. */
  store?: HighlightStore
}

export type NavigationStep = 1 | -1 | 'first' | 'last'

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

/** Next index from `current` (-1 when nothing is highlighted) among `count` items. */
export function nextIndex(current: number, count: number, step: NavigationStep, loop: boolean) {
  if (count <= 0) return -1
  if (step === 'first') return 0
  if (step === 'last') return count - 1
  if (current < 0) return step > 0 ? 0 : count - 1
  const next = current + step
  return loop ? (next + count) % count : Math.min(Math.max(next, 0), count - 1)
}

function scrollPadding(value: string, size: number) {
  const amount = Number.parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('%') ? (amount / 100) * size : amount
}

/** Scrolls only `list`, never its ancestors, until `item` is inside the scrollport minus `scroll-padding`. */
export function revealItem(list: HTMLElement, item: Element, axis: HighlightAxis) {
  const style = getComputedStyle(list)
  const box = list.getBoundingClientRect()
  const rect = item.getBoundingClientRect()
  if (axis !== 'x') {
    const start = box.top + list.clientTop + scrollPadding(style.scrollPaddingTop, list.clientHeight)
    const end = box.top + list.clientTop + list.clientHeight - scrollPadding(style.scrollPaddingBottom, list.clientHeight)
    if (rect.top < start) list.scrollTop -= start - rect.top
    else if (rect.bottom > end) list.scrollTop += rect.bottom - end
  }
  if (axis !== 'y') {
    const start = box.left + list.clientLeft + scrollPadding(style.scrollPaddingLeft, list.clientWidth)
    const end = box.left + list.clientLeft + list.clientWidth - scrollPadding(style.scrollPaddingRight, list.clientWidth)
    if (rect.left < start) list.scrollLeft -= start - rect.left
    else if (rect.right > end) list.scrollLeft += rect.right - end
  }
}

/**
 * Arrow keys, Home and End move the highlight; Enter and Space activate it.
 * Alone, it behaves like plain hover (the item under the mouse is highlighted, so keys continue from it);
 * with proximity hover on the same store, that behavior owns the pointer.
 * Give the container `tabindex="0"`: navigation moves focus to it, so virtualized items can unmount freely.
 */
export function createArrowNavigation(container: HTMLElement, options: ArrowNavigationOptions = {}): HighlightBehavior {
  const { axis = 'y', scrollToIndex, store = defaultStore(container) } = options
  const el = container
  const forward = axis === 'x' ? ['ArrowRight'] : axis === 'y' ? ['ArrowDown'] : ['ArrowDown', 'ArrowRight']
  const backward = axis === 'x' ? ['ArrowLeft'] : axis === 'y' ? ['ArrowUp'] : ['ArrowUp', 'ArrowLeft']
  const loop = () => read(options.loop) ?? false
  let hovering = false

  function stepFor(key: string): NavigationStep | undefined {
    if (forward.includes(key)) return 1
    if (backward.includes(key)) return -1
    if (key === 'Home') return 'first'
    if (key === 'End') return 'last'
  }

  function pickRendered(step: NavigationStep) {
    const items = store.items()
    const current = store.highlighted
    const index = nextIndex(current ? items.indexOf(current) : -1, items.length, step, loop())
    const item = items[index]
    if (!item) return
    store.highlight(item, 'keyboard')
    return { index, size: items.length }
  }

  function pickVirtual(size: number, step: NavigationStep) {
    const key = store.key()
    const direction = step === -1 || step === 'last' ? -1 : 1
    let index = nextIndex(key === undefined ? -1 : Number(key), size, step, loop())
    for (let tries = 1; index >= 0 && tries < size; tries++) {
      const item = store.findIndex(index)
      if (!item || isEligible(item)) break
      const next = nextIndex(index, size, direction, loop())
      if (next === index) return
      index = next
    }
    if (index < 0) return
    store.highlightIndex(index, 'keyboard')
    return { index, size }
  }

  function move(step: NavigationStep) {
    const carried = store.nudge
    const { scrollLeft, scrollTop } = el
    const size = read(options.count)
    const target = size === undefined ? pickRendered(step) : pickVirtual(size, step)
    if (!target) return
    store.suspendPointer()
    const item = store.highlighted
    if (target.index === 0 || target.index === target.size - 1) {
      // The first and last items scroll all the way so the list's own padding shows too. Assigning the
      // full scroll size lets the browser clamp exactly, even at fractional device pixel ratios.
      const end = target.index !== 0
      if (axis !== 'x') el.scrollTop = end ? el.scrollHeight : 0
      if (axis !== 'y') el.scrollLeft = end ? el.scrollWidth : 0
    }
    else if (item) revealItem(el, item, axis)
    else scrollToIndex?.(target.index)
    if (item) {
      store.nudge = {
        item,
        dx: (carried?.dx ?? 0) + el.scrollLeft - scrollLeft,
        dy: (carried?.dy ?? 0) + el.scrollTop - scrollTop,
      }
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if ((e.target as Element).closest?.(EDITABLE)) return

    if (e.key === 'Enter' || e.key === ' ') {
      const item = store.highlighted
      // A focused item activates natively unless the keyboard moved the highlight away from it.
      if (!item || (e.target !== el && store.source !== 'keyboard')) return
      e.preventDefault()
      item.click()
      return
    }

    const step = stepFor(e.key)
    if (!step) return
    e.preventDefault()
    // Focus follows the keyboard, so Enter activates the highlighted item rather than a previously focused one.
    if (el.tabIndex >= 0 && document.activeElement !== el) el.focus({ preventScroll: true })
    move(step)
  }

  function onDocumentKeyDown(e: KeyboardEvent) {
    if (!hovering || !(read(options.whileHovered) ?? true) || el.contains(e.target as Node) || !stepFor(e.key)) return
    onKeyDown(e)
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    hovering = true
    if (store.pointerClaimed() || !store.acceptsPointer(e, read(options.resumeDistance) ?? RESUME_DISTANCE)) return
    const item = (e.target as Element).closest(ITEM)
    const next = isEligible(item) ? item : null
    if (next !== store.highlighted || (next && store.source !== 'pointer')) store.highlight(next, 'pointer')
  }

  function onPointerLeave() {
    hovering = false
    store.resumePointer()
    if (!store.pointerClaimed() && store.source === 'pointer') store.highlight(null, null)
  }

  const detach = store.attach(el)
  el.addEventListener('keydown', onKeyDown)
  el.addEventListener('pointerenter', onPointerMove, { passive: true })
  el.addEventListener('pointermove', onPointerMove, { passive: true })
  el.addEventListener('pointerleave', onPointerLeave, { passive: true })
  document.addEventListener('keydown', onDocumentKeyDown)

  return {
    store,
    destroy() {
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('pointerenter', onPointerMove)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('keydown', onDocumentKeyDown)
      detach()
    },
  }
}
