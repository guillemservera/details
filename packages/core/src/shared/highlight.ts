export type HighlightAxis = 'x' | 'y' | 'xy'
export type HighlightSource = 'pointer' | 'keyboard' | 'focus'

/** Marks an element as an item that can be highlighted. */
export const ITEM_ATTR = 'data-highlight-item'
/** Set on the highlighted item. */
export const HIGHLIGHT_ATTR = 'data-highlighted'
/** Set on the container while the keyboard owns the highlight, e.g. to silence CSS `:hover`. */
export const KEYBOARD_ATTR = 'data-keyboard-navigation'

export const ITEM = `[${ITEM_ATTR}]`
export const DISABLED_ATTRS = ['disabled', 'aria-disabled', 'data-disabled']
export const RESUME_DISTANCE = 6
const DISABLED = ':disabled, [aria-disabled="true"], [data-disabled]'

export function isEligible(el: Element | null | undefined): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(ITEM) && !el.matches(DISABLED)
}

/** What highlight behaviors return. */
export interface HighlightBehavior {
  /** The store this behavior reads and writes. */
  store: HighlightStore
  /** Removes listeners and observers. */
  destroy: () => void
}

/** Highlight state shared by every behavior attached to the same container. */
export interface HighlightStore {
  /** The highlighted item. */
  readonly highlighted: HTMLElement | null
  /** What highlighted it. */
  readonly source: HighlightSource | null
  /** Calls `listener` after `highlighted` or `source` changes. Returns unsubscribe. */
  subscribe: (listener: () => void) => () => void
  /** Scroll the keyboard caused to reveal `item`, so an indicator can keep its on-screen position. */
  nudge: { item: Element, dx: number, dy: number } | undefined
  /** The next highlight change comes from content scrolling under a still pointer: indicators jump instead of gliding. */
  snap: boolean
  highlight: (item: HTMLElement | null, from: HighlightSource | null) => void
  /** Highlights the item with this `data-index`, now or once it renders. */
  highlightIndex: (index: number, from: HighlightSource) => void
  /** `data-index` of the highlighted item, also while it is not rendered. */
  key: () => string | undefined
  findIndex: (index: number | string) => HTMLElement | null
  /** Eligible items in document order. */
  items: () => HTMLElement[]
  /** The keyboard took over: the mouse must travel `resumeDistance` px before it picks again. */
  suspendPointer: () => void
  resumePointer: () => void
  pointerSuspended: () => boolean
  acceptsPointer: (e: PointerEvent, resumeDistance: number) => boolean
  /** Pointer picking belongs to proximity hover while it holds a claim. Returns release. */
  claimPointer: () => () => void
  pointerClaimed: () => boolean
  /** Observes `el` as the container while at least one behavior is attached to it. Returns detach. */
  attach: (el: HTMLElement) => () => void
}

const defaults = new WeakMap<HTMLElement, HighlightStore>()

/** The store behaviors share when none is passed: one per container element. */
export function defaultStore(container: HTMLElement) {
  let store = defaults.get(container)
  if (!store) defaults.set(container, (store = createHighlightStore()))
  return store
}

export function createHighlightStore(): HighlightStore {
  let highlighted: HTMLElement | null = null
  let source: HighlightSource | null = null
  let notified: [HTMLElement | null, HighlightSource | null] = [null, null]
  let container: HTMLElement | null = null
  const listeners = new Set<() => void>()
  const attachments = new Map<HTMLElement, { count: number, detach: () => void }>()
  let key: string | undefined
  let suspended = false
  let origin: { x: number, y: number } | undefined
  let lastPointer: { x: number, y: number } | undefined
  let pointerClaims = 0

  const store: HighlightStore = {
    get highlighted() {
      return highlighted
    },
    get source() {
      return source
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    nudge: undefined,
    snap: false,
    highlight,
    highlightIndex(index, from) {
      const item = findIndex(index)
      if (item) return highlight(item, from)
      highlighted?.removeAttribute(HIGHLIGHT_ATTR)
      highlighted = null
      key = String(index)
      source = from
      container?.toggleAttribute(KEYBOARD_ATTR, from === 'keyboard')
      notify()
    },
    key: () => key,
    findIndex,
    items: () => Array.from(container?.querySelectorAll<HTMLElement>(ITEM) ?? []).filter(isEligible),
    suspendPointer() {
      suspended = true
      origin = lastPointer
    },
    resumePointer() {
      suspended = false
      origin = undefined
    },
    pointerSuspended: () => suspended,
    acceptsPointer(e, resumeDistance) {
      if (e.pointerType === 'touch') return false
      lastPointer = { x: e.clientX, y: e.clientY }
      if (suspended) {
        origin ??= lastPointer
        if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < resumeDistance) return false
        store.resumePointer()
      }
      return true
    },
    claimPointer() {
      pointerClaims++
      let released = false
      return () => {
        if (released) return
        released = true
        pointerClaims--
      }
    },
    pointerClaimed: () => pointerClaims > 0,
    attach,
  }

  function notify() {
    if (notified[0] === highlighted && notified[1] === source) return
    notified = [highlighted, source]
    for (const listener of listeners) listener()
  }

  function findIndex(index: number | string) {
    return container?.querySelector<HTMLElement>(`${ITEM}[data-index="${CSS.escape(String(index))}"]`) ?? null
  }

  function highlight(item: HTMLElement | null, from: HighlightSource | null) {
    const next = isEligible(item) ? item : null
    if (next !== highlighted) {
      highlighted?.removeAttribute(HIGHLIGHT_ATTR)
      next?.setAttribute(HIGHLIGHT_ATTR, '')
      highlighted = next
    }
    key = next?.dataset.index
    source = next ? from : null
    container?.toggleAttribute(KEYBOARD_ATTR, source === 'keyboard')
    notify()
  }

  function clear() {
    highlighted?.removeAttribute(HIGHLIGHT_ATTR)
    highlighted = null
    key = undefined
    source = null
    notify()
  }

  // Keeps the highlight valid as items unmount, get recycled to another index, or become disabled.
  function reconcile() {
    const item = highlighted
    if (item ? container?.contains(item) && item.isConnected && item.dataset.index === key && isEligible(item) : key === undefined) return
    const pending = key
    const from = source
    store.nudge = undefined
    item?.removeAttribute(HIGHLIGHT_ATTR)
    highlighted = null
    const next = pending === undefined ? null : findIndex(pending)
    if (pending !== undefined && !next) return notify() // a virtualized item that is not rendered yet
    highlight(next, from)
  }

  function attach(el: HTMLElement) {
    container = el
    let entry = attachments.get(el)
    if (!entry) {
      const observer = new MutationObserver(reconcile)
      observer.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-index', ...DISABLED_ATTRS] })
      // Only focus with a ring is navigation. A click's focus leaves the highlight to the pointer, so leaving the list
      // still clears it; focus the browser hands back when the window is activated again (or a script's, after a
      // click) must not light up the item clicked last.
      const onFocusIn = (e: FocusEvent) => {
        const target = e.target as Element
        if (target === el || !target.matches(':focus-visible')) return
        const item = target.closest(ITEM)
        highlight(isEligible(item) ? item : null, 'focus')
      }
      const onFocusOut = (e: FocusEvent) => {
        if (source !== 'pointer' && !el.contains(e.relatedTarget as Node | null)) highlight(null, null)
      }
      el.addEventListener('focusin', onFocusIn)
      el.addEventListener('focusout', onFocusOut)
      entry = {
        count: 0,
        detach() {
          observer.disconnect()
          el.removeEventListener('focusin', onFocusIn)
          el.removeEventListener('focusout', onFocusOut)
          el.removeAttribute(KEYBOARD_ATTR)
        },
      }
      attachments.set(el, entry)
    }
    const attached = entry
    attached.count++
    reconcile()
    let detached = false
    // Idempotent, so a behavior destroyed twice (e.g. by React StrictMode) cannot release another one's attachment.
    return () => {
      if (detached) return
      detached = true
      if (--attached.count) return
      attached.detach()
      attachments.delete(el)
      // A replaced container attaches its successor before the old one detaches.
      if (container === el) container = attachments.keys().next().value ?? null
      if (container) reconcile()
      else {
        clear()
        store.resumePointer()
        store.nudge = undefined
        store.snap = false
      }
    }
  }

  return store
}
