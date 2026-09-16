import { useRef, useState, type CSSProperties } from 'react'
import { useRouletteText } from '@guillemservera/react-details'
import Segmented from '../../components/Segmented'
import { DEFAULT_ALPHABET, rouletteBurst, rouletteExamples as examples } from '../playground'
import { useTimer } from './useTimer'

const directions = [{ value: 'up', label: 'up' }, { value: 'down', label: 'down' }] as const

export default function RouletteTextDemo() {
  const [text, setText] = useState('PLAY')
  const [duration, setDuration] = useState(600)
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const [animated, setAnimated] = useState(true)
  const [blur, setBlur] = useState(0)
  const [fade, setFade] = useState(0)
  const [alphabet, setAlphabet] = useState(DEFAULT_ALPHABET)
  const source = useRef<HTMLSpanElement>(null)
  const viewport = useRef<HTMLSpanElement>(null)
  useRouletteText(source, viewport, { duration, direction, animated, blur, fade, alphabet })

  const timer = useTimer()
  const select = (value: string) => {
    timer.clear()
    setText(value)
  }
  const burst = () => {
    timer.clear()
    let index = 0
    const tick = () => {
      setText(rouletteBurst[index++]!)
      if (index < rouletteBurst.length) timer.set(tick, 140)
    }
    tick()
  }

  const snippet = `import { useRef, useState } from 'react'
import { useRouletteText } from '@guillemservera/react-details/roulette-text'

const [text, setText] = useState(${JSON.stringify(text)})
const source = useRef<HTMLSpanElement>(null)
const viewport = useRef<HTMLSpanElement>(null)
useRouletteText(source, viewport, {
  duration: ${duration},
  direction: ${JSON.stringify(direction)},
  animated: ${animated},
  blur: ${blur},
  fade: ${fade},
  alphabet: ${JSON.stringify(alphabet)},
}) // Options are read on every render.

// JSX — put typography on the common parent:
<span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
  <span ref={source} style={{ display: 'inline-block', minHeight: '1lh' }}>{text}</span>
  <span ref={viewport} aria-hidden="true" />
</span>`

  return (
    <>
      <header>
        <h1>useRouletteText</h1>
        <p>Each changing character travels through a vertical slot. Unchanged characters stay put, and new updates continue from the visible position.</p>
      </header>

      <section className="card">
        <div className="text-stage">
          <span className="text-frame">
            <span ref={source} style={{ display: 'inline-block', minHeight: '1lh' }}>{text}</span>
            <span ref={viewport} aria-hidden="true"></span>
          </span>
        </div>

        <div className="controls">
          <label className="control">
            <span className="label">Text</span>
            <input value={text} onChange={e => select(e.target.value)} className="text-input" aria-label="Roulette text" />
          </label>
          <div className="control">
            <span className="label">Examples</span>
            <div className="text-actions">
              {examples.map(example => <button key={example} type="button" onClick={() => select(example)}>{example || 'Empty'}</button>)}
            </div>
          </div>
          <label className="control">
            <span className="label">Alphabet</span>
            <input value={alphabet} onChange={e => setAlphabet(e.target.value)} className="text-input" type="text" placeholder="Empty skips intermediate glyphs" />
          </label>
          <label className="control">
            <span className="label">Duration</span>
            <span className="slider">
              <input value={duration} onChange={e => setDuration(+e.target.value)} style={{ '--p': duration / 2000 } as CSSProperties} type="range" min="0" max="2000" step="50" />
              <output>{duration}ms</output>
            </span>
          </label>
          <div className="control">
            <span className="label">Direction</span>
            <Segmented value={direction} options={directions} onChange={setDirection} />
          </div>
          <label className="control">
            <span className="label">Blur (em)</span>
            <span className="slider">
              <input value={blur} onChange={e => setBlur(+e.target.value)} style={{ '--p': blur / 0.2 } as CSSProperties} type="range" min="0" max="0.2" step="0.01" />
              <output>{blur.toFixed(2)}em</output>
            </span>
          </label>
          <label className="control">
            <span className="label">Fade (%)</span>
            <span className="slider">
              <input value={fade} onChange={e => setFade(+e.target.value)} style={{ '--p': fade } as CSSProperties} type="range" min="0" max="1" step="0.05" />
              <output>{Math.round(fade * 100)}%</output>
            </span>
          </label>
          <label className="control">
            <span className="label">Animated</span>
            <input checked={animated} onChange={e => setAnimated(e.target.checked)} className="switch" type="checkbox" />
          </label>
          <div className="control">
            <span className="label">Interruption</span>
            <div className="text-actions">
              <button type="button" onClick={burst}>Rapid update / reversal</button>
            </div>
          </div>
        </div>

        <div className="code">
          <pre>{snippet}</pre>
        </div>
      </section>
    </>
  )
}
