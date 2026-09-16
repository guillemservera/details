import { read } from '../shared/options'
import { cancel, createLayer, createTextMotion, EASING, fitWidth, removeLayer, textDuration, type Layer, type TextMotion, type TextMotionOptions } from '../shared/textMotion'

export type RollingTextOptions = TextMotionOptions

/** Rolls complete words or phrases as single rows. */
export function createRollingText(source: HTMLElement, viewport: HTMLElement, options: RollingTextOptions = {}): TextMotion {
  return createTextMotion(source, viewport, options, (sourceElement, viewportElement) => {
    type Row = Layer & { y: number }

    let rows: Row[] = []
    const view = sourceElement.ownerDocument.defaultView!

    function create(text: string, y: number): Row {
      return { element: createLayer(viewportElement, text, `height:100%;transform:translateY(${y}px)`), y }
    }

    function settle(target: Row) {
      for (const row of rows) {
        if (row !== target) removeLayer(row)
      }
      cancel(target)
      target.y = 0
      target.element.style.transform = 'none'
      rows = [target]
      viewportElement.style.removeProperty('width')
    }

    return {
      update(text, animate) {
        const height = sourceElement.getBoundingClientRect().height
        if (!animate || height === 0) {
          settle(rows.find(row => row.element.textContent === text) ?? create(text, 0))
          return
        }

        // Snapshot before canceling: interruptions continue where the visible rows actually are.
        for (const row of rows) {
          const transform = view.getComputedStyle(row.element).transform
          row.y = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
        }
        rows = rows.filter((row) => {
          cancel(row)
          if (row.y <= -height || row.y >= height) {
            row.element.remove()
            return false
          }
          row.element.style.transform = `translateY(${row.y}px)`
          return true
        })

        let target = rows.find(row => row.element.textContent === text)
        if (!target) {
          // Whole rows stay a line apart: retain at most two visible rows plus the incoming one.
          const y = read(options.direction) === 'down'
            ? Math.min(-height, ...rows.map(row => row.y - height))
            : Math.max(height, ...rows.map(row => row.y + height))
          target = create(text, y)
          rows.push(target)
        }

        fitWidth(sourceElement, viewportElement, rows)
        const distance = target.y
        const duration = textDuration(options)
        for (const row of rows) {
          const end = row.y - distance
          row.element.style.transform = `translateY(${end}px)`
          row.animation = row.element.animate([
            { transform: `translateY(${row.y}px)` },
            { transform: `translateY(${end}px)` },
          ], { duration, easing: EASING })
        }
        const latest = target
        latest.animation!.onfinish = () => settle(latest)
      },
      destroy() {
        for (const row of rows) removeLayer(row)
        rows = []
        viewportElement.style.removeProperty('width')
      },
    }
  })
}
