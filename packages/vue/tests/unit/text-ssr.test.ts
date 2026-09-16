import { expect, it } from 'vitest'
import { createSSRApp, h, shallowRef } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useArrowNavigation } from '../../src/arrow-navigation/useArrowNavigation'
import { useHighlightIndicator } from '../../src/highlight-indicator/useHighlightIndicator'
import { useMorphText } from '../../src/morph-text/useMorphText'
import { useProximityHover } from '../../src/proximity-hover/useProximityHover'
import { useRollingText } from '../../src/rolling-text/useRollingText'
import { useRouletteText } from '../../src/roulette-text/useRouletteText'

it('renders readable, escaped text without animation markup or browser globals on the server', async () => {
  const html = await renderToString(createSSRApp({
    setup() {
      const wordSource = shallowRef<HTMLElement | null>(null)
      const wordViewport = shallowRef<HTMLElement | null>(null)
      const letterSource = shallowRef<HTMLElement | null>(null)
      const letterViewport = shallowRef<HTMLElement | null>(null)
      const rowSource = shallowRef<HTMLElement | null>(null)
      const rowViewport = shallowRef<HTMLElement | null>(null)
      useMorphText(wordSource, wordViewport)
      useRouletteText(letterSource, letterViewport)
      useRollingText(rowSource, rowViewport, { duration: shallowRef(300) })
      return () => h('div', [
        h('span', [h('span', { ref: wordSource }, 'Build <better>'), h('span', { ref: wordViewport, 'aria-hidden': 'true' })]),
        h('span', [h('span', { ref: letterSource }, 'Cafe\u0301 👩🏽‍💻'), h('span', { ref: letterViewport, 'aria-hidden': 'true' })]),
        h('span', [h('span', { ref: rowSource }, '  Roll & row  '), h('span', { ref: rowViewport, 'aria-hidden': 'true' })]),
      ])
    },
  }))
  expect(html).toBe('<div><span><span>Build &lt;better&gt;</span><span aria-hidden="true"></span></span><span><span>Café 👩🏽‍💻</span><span aria-hidden="true"></span></span><span><span>  Roll &amp; row  </span><span aria-hidden="true"></span></span></div>')
})

it('creates shared highlight state without touching the DOM on the server', async () => {
  let state: ReturnType<typeof useProximityHover> | undefined
  const html = await renderToString(createSSRApp({
    setup() {
      const container = shallowRef<HTMLElement | null>(null)
      const indicator = shallowRef<HTMLElement | null>(null)
      state = useProximityHover(container)
      useArrowNavigation(container, { loop: true })
      useHighlightIndicator(container, indicator)
      return () => h('div', { ref: container }, [h('div', { ref: indicator })])
    },
  }))
  expect(html).toBe('<div><div></div></div>')
  expect(state!.highlighted.value).toBeNull()
})
