import { useRef } from 'react'
import { useHighlightIndicator } from '@guillemservera/react-details/highlight-indicator'
import { useProximityHover } from '@guillemservera/react-details/proximity-hover'

interface Props<T extends string | number> {
  value: T
  options: readonly { value: T, label: string, disabled?: boolean }[]
  onChange: (value: T) => void
}

export default function Segmented<T extends string | number>({ value, options, onChange }: Props<T>) {
  // Dogfooding: the selected pill glides with the value; hover only tints the nearest segment's text.
  const root = useRef<HTMLDivElement>(null)
  const selected = useRef<HTMLDivElement>(null)
  useProximityHover(root, { axis: 'xy' }) // segments wrap onto a second row on narrow screens
  useHighlightIndicator(root, selected, { target: '[aria-pressed="true"]', motion: 'moderate' })

  return (
    <div ref={root} className="segmented">
      <div ref={selected} aria-hidden="true" className="segmented-selected" />
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          data-highlight-item=""
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
