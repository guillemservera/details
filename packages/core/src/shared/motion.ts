const GEOMETRY = /^(?:transform|translate|scale|rotate|zoom|width|height)$/

/**
 * Calls `callback`, at most once a frame, after a CSS animation or a geometry transition ends on `el` or an
 * ancestor: geometry measured while it ran (an enter zoom) may be off, and nothing else reports its end.
 * Returns stop.
 */
export function onAncestorMotionEnd(el: HTMLElement, callback: () => void) {
  const doc = el.ownerDocument
  let raf = 0
  const onEnd = (e: Event) => {
    if (raf || (e.type === 'transitionend' && !GEOMETRY.test((e as TransitionEvent).propertyName))) return
    if (!(e.target instanceof Node && e.target.contains(el))) return
    raf = requestAnimationFrame(() => {
      raf = 0
      callback()
    })
  }
  doc.addEventListener('animationend', onEnd, true)
  doc.addEventListener('transitionend', onEnd, true)
  return () => {
    cancelAnimationFrame(raf)
    doc.removeEventListener('animationend', onEnd, true)
    doc.removeEventListener('transitionend', onEnd, true)
  }
}
