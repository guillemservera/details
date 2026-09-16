import { read, type MaybeGetter } from '../shared/options'
import { createTextMotion, EASING, nonNegative, textDuration, type TextMotion, type TextMotionOptions } from '../shared/textMotion'

export interface RouletteTextOptions extends TextMotionOptions {
  /** Intermediate glyphs. Defaults to `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`; targets need not be in it. */
  alphabet?: MaybeGetter<string>
  /** Peak blur in em while a slot rolls. Default 0 (sharp); negative or non-finite values use the default. */
  blur?: MaybeGetter<number>
  /** Window-edge fade, from 0 (none, the default) to 1 (edges fade to the center). */
  fade?: MaybeGetter<number>
}

const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const EPSILON = 0.01

type Glyph = { text: string; x: number; width: number }
type Slot = {
  element: HTMLSpanElement
  strip: HTMLSpanElement
  glyphs: string[]
  target: string
  /** Resting values, which the running animations end at. */
  x: number
  width: number
  opacity: number
  row: number
  motion: Animation | null
  layout: Animation | null
}

/** Rolls grapheme-sized slots in an empty, aria-hidden sibling of a plain-text source. */
export function createRouletteText(source: HTMLElement, viewport: HTMLElement, options: RouletteTextOptions = {}): TextMotion {
  return createTextMotion(source, viewport, options, (sourceElement, viewportElement) => {
    const document = sourceElement.ownerDocument
    const view = document.defaultView!
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const root = document.createElement('span')
    root.style.cssText = 'display:inline-block;position:relative;white-space:pre;vertical-align:top'
    viewportElement.append(root)
    let slots: Slot[] = []
    let targetText = ''
    let height = 0
    let widthMotion: Animation | null = null
    let settledWidth = 0

    function measure(text: string) {
      const probe = document.createElement('span')
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;display:inline-block'
      probe.textContent = text || '​'
      root.append(probe)
      const bounds = probe.getBoundingClientRect()
      const range = document.createRange()
      let offset = 0
      const glyphs = Array.from(segmenter.segment(text), ({ segment: glyph }): Glyph => {
        range.setStart(probe.firstChild!, offset)
        offset += glyph.length
        range.setEnd(probe.firstChild!, offset)
        const rect = range.getBoundingClientRect()
        return { text: glyph, x: rect.left - bounds.left, width: rect.width }
      })
      probe.remove()
      return { glyphs, height: bounds.height, width: text ? bounds.width : 0 }
    }

    function settle() {
      widthMotion?.cancel()
      widthMotion = null
      for (const slot of slots) {
        slot.motion?.cancel()
        slot.layout?.cancel()
      }
      slots = []
      root.textContent = targetText
      root.style.removeProperty('width')
      root.style.removeProperty('height')
    }

    function finish() {
      if (!widthMotion && slots.every(slot => !slot.motion && !slot.layout)) settle()
    }

    function rows(slot: Slot, glyphs: string[]) {
      slot.glyphs = glyphs
      slot.strip.replaceChildren(...glyphs.map((glyph) => {
        const row = document.createElement('span')
        row.style.cssText = `display:block;height:${height}px;line-height:${height}px;white-space:pre`
        row.textContent = glyph
        return row
      }))
    }

    function createSlot(glyph: Glyph, opacity: number): Slot {
      const element = document.createElement('span')
      const strip = document.createElement('span')
      element.style.cssText = `position:absolute;top:0;left:0;overflow:hidden;height:${height}px;width:${glyph.width}px;transform:translateX(${glyph.x}px);opacity:${opacity}`
      strip.style.cssText = 'display:block;will-change:transform'
      element.append(strip)
      root.append(element)
      const slot: Slot = { element, strip, glyphs: [], target: glyph.text, x: glyph.x, width: glyph.width, opacity, row: 0, motion: null, layout: null }
      rows(slot, [glyph.text])
      return slot
    }

    function onFinish(animation: Animation, done: () => boolean) {
      animation.onfinish = () => {
        if (!done()) return
        animation.cancel()
        finish()
      }
    }

    return {
      update(text, animate) {
        const previousText = targetText
        targetText = text
        const next = measure(text)
        const fromWidth = widthMotion ? parseFloat(view.getComputedStyle(sourceElement).width) : settledWidth
        settledWidth = next.width
        if (!animate || !next.height) {
          settle()
          return
        }
        widthMotion?.cancel()
        widthMotion = null
        const duration = textDuration(options)
        if (Math.abs(fromWidth - next.width) > EPSILON) {
          const animation = sourceElement.animate([{ width: `${fromWidth}px` }, { width: `${next.width}px` }], { duration, easing: EASING })
          widthMotion = animation
          onFinish(animation, () => {
            if (widthMotion !== animation) return false
            widthMotion = null
            return true
          })
        }
        if (!slots.length) {
          height = next.height
          root.textContent = ''
          slots = measure(previousText).glyphs.map(glyph => createSlot(glyph, 1))
        }
        for (let index = slots.length; index < next.glyphs.length; index++) {
          slots.push(createSlot({ ...next.glyphs[index]!, text: '', width: 0 }, 0))
        }
        root.style.width = `${next.width}px`
        root.style.height = `${height}px`
        const alphabet = [...new Set(Array.from(segmenter.segment(read(options.alphabet) ?? DEFAULT_ALPHABET), part => part.segment))]
        const down = read(options.direction) === 'down'
        const blur = nonNegative(read(options.blur), 0)
        const fade = Math.min(1, nonNegative(read(options.fade), 0))

        // Read every in-flight position before any write, so slots do not force one layout each.
        const changes = slots.map((slot, index) => {
          const glyph = next.glyphs[index]
          const x = glyph?.x ?? next.width
          const opacity = glyph ? 1 : 0
          const target = glyph?.text ?? ''
          const moves = Math.abs(slot.x - x) > EPSILON || slot.opacity !== opacity
          const layout = moves && slot.layout ? view.getComputedStyle(slot.element) : undefined
          const strip = target !== slot.target && slot.motion ? view.getComputedStyle(slot.strip) : undefined
          return {
            glyph, x, opacity, target, moves,
            fromX: layout ? new DOMMatrixReadOnly(layout.transform).m41 : slot.x,
            fromOpacity: layout ? Number(layout.opacity) : slot.opacity,
            row: strip ? -new DOMMatrixReadOnly(strip.transform).m42 / height : slot.row,
            filter: strip?.filter ?? 'none',
          }
        })

        slots.forEach((slot, index) => {
          const change = changes[index]!
          const width = Math.max(slot.width, change.glyph?.width ?? 0)
          if (width !== slot.width) {
            slot.width = width
            slot.element.style.width = `${width}px`
          }
          if (change.moves) {
            slot.layout?.cancel()
            slot.x = change.x
            slot.opacity = change.opacity
            slot.element.style.transform = `translateX(${change.x}px)`
            slot.element.style.opacity = `${change.opacity}`
            const animation = slot.element.animate([
              { transform: `translateX(${change.fromX}px)`, opacity: change.fromOpacity },
              { transform: `translateX(${change.x}px)`, opacity: change.opacity },
            ], { duration, easing: EASING })
            slot.layout = animation
            onFinish(animation, () => {
              if (slot.layout !== animation) return false
              slot.layout = null
              return true
            })
          }
          if (change.target === slot.target) return

          slot.motion?.cancel()
          const first = Math.max(0, Math.min(Math.floor(change.row), slot.glyphs.length - 1))
          const visible = slot.glyphs.slice(first, first + 2)
          const fraction = Math.max(0, change.row - first)
          const intermediate = Array.from({ length: alphabet.length ? 3 + index % 3 : 0 }, (_, step) => alphabet[(index + step) % alphabet.length]!)
          const glyphs = down ? [change.target, ...intermediate, ...visible] : [...visible, ...intermediate, change.target]
          const start = down ? 1 + intermediate.length + fraction : fraction
          const end = down ? 0 : glyphs.length - 1
          rows(slot, glyphs)
          slot.target = change.target
          slot.row = end
          const fromTransform = `translateY(${-start * height}px)`
          const toTransform = `translateY(${-end * height}px)`
          slot.strip.style.transform = toTransform
          slot.element.style.maskImage = fade
            ? `linear-gradient(to bottom, transparent, #000 ${fade * 50}%, #000 ${100 - fade * 50}%, transparent)`
            : 'none'
          const keyframes: Keyframe[] = blur
            ? [{ transform: fromTransform, filter: change.filter }, { filter: `blur(${blur}em)`, offset: 0.5 }, { transform: toTransform, filter: 'blur(0em)' }]
            : [{ transform: fromTransform }, { transform: toTransform }]
          const animation = slot.strip.animate(keyframes, { duration, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
          slot.motion = animation
          onFinish(animation, () => {
            if (slot.motion !== animation) return false
            slot.motion = null
            slot.element.style.removeProperty('mask-image')
            return true
          })
        })
        finish()
      },
      destroy() {
        settle()
        root.remove()
      },
      resizing: () => widthMotion !== null,
    }
  })
}
