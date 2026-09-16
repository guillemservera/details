import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useArrowNavigation, useHighlightIndicator, useProximityHover } from '@guillemservera/react-details'
import { itemLabel as label, type PlaygroundState } from '../playground'

interface Props extends PlaygroundState {
  /** native: no hooks, CSS :hover only (the baseline in compare mode). */
  mode: 'proximity' | 'keyboard' | 'native'
  /** Hide the stats column (compare mode). */
  bare?: boolean
}

// The parent re-keys this component when mode, axis or keyboard change, so those are fixed for its lifetime.
export default function DemoList({ mode, bare, axis, renderer, count, keyboard, resumeDistance, loop, whileHovered }: Props) {
  const list = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  // Never attached: hooks handed this ref stay inert, which keeps hook calls unconditional.
  const off = useRef<HTMLElement>(null)
  const horizontal = axis === 'x'
  // With keyboard navigation the list is one focusable menu; without it, items keep their natural tab order.
  const navigable = mode === 'keyboard' || keyboard
  const uid = useId()
  const SIZE = horizontal ? 120 : 40

  // TanStack Virtual is used only by this demo, not by the details packages.
  const virtualizer = useVirtualizer({
    count,
    horizontal,
    getScrollElement: () => list.current,
    estimateSize: () => SIZE,
    gap: 4,
    overscan: 6,
  })

  const hover = useProximityHover(mode === 'proximity' ? list : off, { axis, resumeDistance })
  useHighlightIndicator(list, indicator)
  const nav = useArrowNavigation(navigable ? list : off, {
    axis,
    loop,
    whileHovered,
    resumeDistance,
    count: renderer === 'virtual' ? count : undefined,
    scrollToIndex: i => virtualizer.scrollToIndex(i, { align: 'auto' }),
  })
  const { highlighted, source } = navigable ? nav : hover

  const offset = (start: number) => (horizontal ? `translateX(${start}px)` : `translateY(${start}px)`)

  // Stats: worst frame in the last 500ms, item nodes in the DOM, last click.
  const [stats, setStats] = useState({ worst: 0, nodes: 0 })
  const [clicked, setClicked] = useState('—')
  useEffect(() => {
    if (bare) return // hidden stats don't need a collector
    let raf = 0
    let prev = performance.now()
    let worst = 0
    let windowStart = prev
    const tick = (now: number) => {
      worst = Math.max(worst, now - prev)
      prev = now
      if (now - windowStart > 500) {
        setStats({ worst: Math.round(worst), nodes: list.current?.querySelectorAll('[data-highlight-item]').length ?? 0 })
        worst = 0
        windowStart = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bare])

  const onItemClick = (e: MouseEvent) => {
    const i = (e.target as HTMLElement).closest<HTMLElement>('[data-highlight-item]')?.dataset.index
    if (i) setClicked(label(+i))
  }

  // Memoized: stats, highlight and scroll updates re-render this component; don't diff 10k items for them.
  const plainBody = useMemo(() => (
    <div className="plain-body">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          id={`${uid}-${i}`}
          data-highlight-item=""
          data-index={i}
          role={navigable ? 'menuitem' : undefined}
          tabIndex={navigable ? -1 : undefined}
          className="item"
        >
          {label(i)}
        </button>
      ))}
    </div>
  ), [count, navigable, uid])

  const highlightedIndex = highlighted?.dataset.index

  return (
    <div className={`stage ${axis}${bare ? ' bare' : ''}`}>
      <div
        ref={list}
        className={`list ${axis} ${mode}`}
        aria-label="Items"
        tabIndex={navigable ? 0 : undefined}
        role={navigable ? 'menu' : undefined}
        aria-orientation={navigable ? (horizontal ? 'horizontal' : 'vertical') : undefined}
        aria-activedescendant={navigable ? highlighted?.id : undefined}
        onClick={onItemClick}
      >
        {mode === 'proximity' && <div ref={indicator} aria-hidden="true" className="indicator" />}
        {renderer === 'virtual'
          ? (
              <div
                className="virtual-body"
                style={horizontal ? { width: `${virtualizer.getTotalSize()}px` } : { height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map(row => (
                  <button
                    key={row.key}
                    data-highlight-item=""
                    data-index={row.index}
                    id={`${uid}-${row.index}`}
                    role={navigable ? 'menuitem' : undefined}
                    tabIndex={navigable ? -1 : undefined}
                    className="item virtual"
                    style={{ transform: offset(row.start) }}
                  >
                    {label(row.index)}
                  </button>
                ))}
              </div>
            )
          : plainBody}
      </div>

      {!bare && (
        <dl className="stats">
          <div><dt>highlighted</dt><dd>{highlightedIndex ? label(+highlightedIndex) : '—'}</dd></div>
          <div><dt>source</dt><dd>{source ?? '—'}</dd></div>
          <div><dt>clicked</dt><dd>{clicked}</dd></div>
          <div><dt>DOM items</dt><dd>{stats.nodes.toLocaleString('en-US')}</dd></div>
          <div><dt>worst frame</dt><dd className={stats.worst > 34 ? 'bad' : undefined}>{stats.worst}ms</dd></div>
        </dl>
      )}
    </div>
  )
}
