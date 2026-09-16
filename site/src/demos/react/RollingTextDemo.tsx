import { useRef, useState, type CSSProperties } from 'react'
import { useRollingText } from '@guillemservera/react-details'
import Segmented from '../../components/Segmented'
import { textExamples as examples } from '../playground'
import { useTimer } from './useTimer'

const directions = [{ value: 'up', label: 'up' }, { value: 'down', label: 'down' }] as const

export default function RollingTextDemo() {
  const [text, setText] = useState('Make every word count.')
  const [duration, setDuration] = useState(600)
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const [animated, setAnimated] = useState(true)
  const source = useRef<HTMLSpanElement>(null)
  const viewport = useRef<HTMLSpanElement>(null)
  useRollingText(source, viewport, { duration, direction, animated })

  const timer = useTimer()
  const select = (value: string) => {
    timer.clear()
    setText(value)
  }
  const burst = () => {
    const original = text
    select('A new perspective.')
    timer.set(() => {
      setText('Then something different.')
      timer.set(() => setText(original), 120)
    }, 120)
  }

  const snippet = `import { useRef, useState } from 'react'
import { useRollingText } from '@guillemservera/react-details/rolling-text'

const [text, setText] = useState(${JSON.stringify(text)})
const source = useRef<HTMLSpanElement>(null)
const viewport = useRef<HTMLSpanElement>(null)
useRollingText(source, viewport, { duration: ${duration}, direction: ${JSON.stringify(direction)}, animated: ${animated} })

// JSX — put typography on the common parent:
<span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre' }}>
  <span ref={source} style={{ display: 'inline-block', minHeight: '1lh' }}>{text}</span>
  <span ref={viewport} aria-hidden="true" />
</span>`

  return (
    <>
      <header>
        <h1>useRollingText</h1>
        <p>Complete words or phrases slide together as one row. Interrupt or return to a phrase and it continues from where it is.</p>
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
            <input value={text} onChange={e => select(e.target.value)} className="text-input" type="text" />
          </label>
          <div className="text-actions">
            {examples.map(example => <button key={example} type="button" onClick={() => select(example)}>{example}</button>)}
            <button type="button" onClick={() => select('')}>Empty</button>
            <button type="button" onClick={burst}>Burst &amp; return</button>
          </div>
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
            <span className="label">Animated</span>
            <input checked={animated} onChange={e => setAnimated(e.target.checked)} className="switch" type="checkbox" />
          </label>
        </div>

        <div className="code"><pre>{snippet}</pre></div>
      </section>
    </>
  )
}
