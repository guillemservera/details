import { read, type MaybeGetter } from '../shared/options'
import { cancel, createLayer, createTextMotion, EASING, fitWidth, nonNegative, removeLayer, textDuration, type Layer, type TextMotion, type TextMotionOptions } from '../shared/textMotion'

export interface MorphTextOptions extends Pick<TextMotionOptions, 'duration' | 'animated'> {
  /** Maximum blur in em. Default 0.2; zero keeps a sharp crossfade, negative or non-finite values use the default. */
  blur?: MaybeGetter<number>
}

/** Outgoing layers kept while updates arrive faster than they fade out. */
const MAX_OUTGOING = 2

/** Morphs whole phrases through blur and crossfade. */
export function createMorphText(source: HTMLElement, viewport: HTMLElement, options: MorphTextOptions = {}): TextMotion {
  return createTextMotion(source, viewport, options, (sourceElement, viewportElement) => {
    const layers = new Set<Layer>()
    let active: Layer | undefined
    const view = sourceElement.ownerDocument.defaultView!

    function remove(layer: Layer) {
      removeLayer(layer)
      layers.delete(layer)
      if (layer === active) active = undefined
    }

    function create(text: string): Layer {
      const layer = { element: createLayer(viewportElement, text, 'opacity:0;') }
      layers.add(layer)
      return layer
    }

    function blur() {
      return nonNegative(read(options.blur), 0.2) * Number.parseFloat(view.getComputedStyle(sourceElement).fontSize)
    }

    function transition(layer: Layer, visible: boolean) {
      const style = view.getComputedStyle(layer.element)
      const from = { opacity: style.opacity, filter: style.filter }
      cancel(layer)
      const to = { opacity: visible ? '1' : '0', filter: `blur(${visible ? 0 : blur()}px)` }
      layer.element.style.opacity = to.opacity
      layer.element.style.filter = to.filter
      layer.animation = layer.element.animate([from, to], { duration: textDuration(options), easing: EASING })
      layer.animation.onfinish = () => {
        if (visible) {
          cancel(layer)
          layer.element.style.filter = 'none'
        }
        else remove(layer)
        if (layers.size === 1) viewportElement.style.removeProperty('width')
      }
    }

    return {
      update(text, animate) {
        let target = Array.from(layers).find(layer => layer.element.textContent === text)
        if (!animate) {
          target ??= create(text)
          for (const layer of layers) {
            if (layer !== target) remove(layer)
          }
          cancel(target)
          target.element.style.opacity = '1'
          target.element.style.filter = 'none'
          active = target
          viewportElement.style.removeProperty('width')
          return
        }
        // Keep only the most visible outgoing layers, so rapid updates do not stack blurred text.
        Array.from(layers, layer => [layer, Number(view.getComputedStyle(layer.element).opacity)] as const)
          .filter(([layer]) => layer !== target)
          .sort((a, b) => b[1] - a[1])
          .forEach(([layer, opacity], index) => {
            if (opacity < 0.05 || index >= MAX_OUTGOING) remove(layer)
          })
        if (!target) {
          target = create(text)
          target.element.style.filter = `blur(${blur()}px)`
        }
        if (target === active) return
        // Existing outgoing layers keep their deadlines; only these two layers are retargeted.
        if (active) transition(active, false)
        active = target
        transition(target, true)
        fitWidth(sourceElement, viewportElement, layers)
      },
      destroy() {
        for (const layer of layers) remove(layer)
        viewportElement.style.removeProperty('width')
      },
    }
  })
}
