import { useRef } from 'react'
import { renderToString } from 'react-dom/server'
import { expect, it } from 'vitest'
import { useArrowNavigation } from '../../src/arrow-navigation/useArrowNavigation'
import { useHighlightIndicator } from '../../src/highlight-indicator/useHighlightIndicator'
import { useInputCapabilities } from '../../src/input-capabilities/useInputCapabilities'
import { useMorphText } from '../../src/morph-text/useMorphText'
import { usePlatform } from '../../src/platform/usePlatform'
import { useProximityHover } from '../../src/proximity-hover/useProximityHover'
import { useRollingText } from '../../src/rolling-text/useRollingText'
import { useRouletteText } from '../../src/roulette-text/useRouletteText'
import { useShortcuts } from '../../src/shortcuts/useShortcuts'

it('renders readable, escaped text without animation markup or browser globals on the server', () => {
  function Texts() {
    const refs = Array.from({ length: 6 }, () => useRef<HTMLSpanElement>(null))
    useMorphText(refs[0]!, refs[1]!)
    useRouletteText(refs[2]!, refs[3]!, { blur: 0.1 })
    useRollingText(refs[4]!, refs[5]!, { duration: 300 })
    return (
      <div>
        <span><span ref={refs[0]}>Build &lt;better&gt;</span><span ref={refs[1]} aria-hidden="true" /></span>
        <span><span ref={refs[2]}>{'Café 👩🏽‍💻'}</span><span ref={refs[3]} aria-hidden="true" /></span>
        <span><span ref={refs[4]}>{'  Roll & row  '}</span><span ref={refs[5]} aria-hidden="true" /></span>
      </div>
    )
  }
  expect(typeof document).toBe('undefined')
  const viewport = '<span aria-hidden="true"></span>'
  expect(renderToString(<Texts />)).toBe(`<div><span><span>Build &lt;better&gt;</span>${viewport}</span><span><span>${'Café 👩🏽‍💻'}</span>${viewport}</span><span><span>  Roll &amp; row  </span>${viewport}</span></div>`)
})

it('renders highlight hooks with empty state on the server', () => {
  function Menu() {
    const container = useRef<HTMLDivElement>(null)
    const indicator = useRef<HTMLDivElement>(null)
    const { highlighted, source } = useProximityHover(container)
    useArrowNavigation(container, { loop: true })
    useHighlightIndicator(container, indicator)
    return <div ref={container} data-state={`${highlighted} ${source}`}><div ref={indicator} /></div>
  }
  expect(renderToString(<Menu />)).toBe('<div data-state="null null"><div></div></div>')
})

it('renders server defaults for the platform, input capabilities and shortcuts', () => {
  function Environment() {
    const platform = usePlatform()
    const capabilities = useInputCapabilities()
    useShortcuts([{ keys: 'mod_k', handler: () => {} }])
    return <span>{platform} {Object.values(capabilities).join()}</span>
  }
  expect(renderToString(<Environment />)).toBe('<span>unknown<!-- --> <!-- -->false,false,false,false,false</span>')
})
