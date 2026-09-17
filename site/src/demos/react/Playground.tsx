import { useState, type CSSProperties } from 'react'
import DemoList from './DemoList'
import Segmented from '../../components/Segmented'
import { axes, copy, counts, initialState, PLAIN_MAX, playgroundSnippet, renderers, type PlaygroundMode, type PlaygroundState } from '../playground'

export default function Playground({ mode }: { mode: PlaygroundMode }) {
  const [s, setState] = useState(initialState)
  const set = (patch: Partial<PlaygroundState>) => setState(prev => {
    const next = { ...prev, ...patch }
    if (next.count > PLAIN_MAX) next.renderer = 'virtual'
    return next
  })

  return (
    <>
      <header>
        <h1>{copy[mode].title}</h1>
        <p>{copy[mode].text}</p>
      </header>

      <section className="card">
        {mode === 'compare'
          ? (
              <div className={`compare ${s.axis}`}>
                <figure>
                  <figcaption>:hover</figcaption>
                  <DemoList key={`native-${s.axis}`} {...s} mode="native" keyboard={false} bare />
                </figure>
                <figure>
                  <figcaption>useProximityHover</figcaption>
                  <DemoList key={`proximity-${s.axis}`} {...s} mode="proximity" keyboard={false} bare />
                </figure>
              </div>
            )
          : <DemoList key={`${mode}-${s.axis}-${s.keyboard}`} {...s} mode={mode} />}

        <div className="controls">
          <div className="control">
            <span className="label">axis</span>
            <Segmented value={s.axis} options={axes} onChange={axis => set({ axis })} />
          </div>
          <div className="control">
            <span className="label">renderer</span>
            <Segmented value={s.renderer} options={renderers(s.count)} onChange={renderer => set({ renderer })} />
          </div>
          <div className="control">
            <span className="label">items</span>
            <Segmented value={s.count} options={counts} onChange={count => set({ count })} />
          </div>
          {mode !== 'compare' && (
            <>
              {mode === 'proximity' && (
                <>
                  <label className="control">
                    <span className="label">keyboard</span>
                    <input checked={s.keyboard} onChange={e => set({ keyboard: e.target.checked })} className="switch" type="checkbox" />
                  </label>
                  <label className="control">
                    <span className="label">reducedMotion</span>
                    <input checked={s.reducedMotion} onChange={e => set({ reducedMotion: e.target.checked })} className="switch" type="checkbox" />
                  </label>
                </>
              )}
              <label className="control">
                <span className="label">resumeDistance</span>
                <span className="slider">
                  <input
                    value={s.resumeDistance}
                    onChange={e => set({ resumeDistance: +e.target.value })}
                    style={{ '--p': s.resumeDistance / 40 } as CSSProperties}
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                  />
                  <output>{s.resumeDistance}px</output>
                </span>
              </label>
              {(mode === 'keyboard' || s.keyboard) && (
                <>
                  <label className="control">
                    <span className="label">loop</span>
                    <input checked={s.loop} onChange={e => set({ loop: e.target.checked })} className="switch" type="checkbox" />
                  </label>
                  <label className="control">
                    <span className="label">whileHovered</span>
                    <input checked={s.whileHovered} onChange={e => set({ whileHovered: e.target.checked })} className="switch" type="checkbox" />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        <div className="code">
          <pre>{playgroundSnippet(mode, s)}</pre>
        </div>
      </section>
    </>
  )
}
