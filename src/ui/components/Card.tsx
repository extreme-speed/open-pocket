import type { ReactNode } from 'react'
import type { Card } from '../../engine/types'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<Size, string> = {
  xs: 'w-12',
  sm: 'w-16',
  md: 'w-24',
  lg: 'w-28',
  xl: 'w-40',
}

export interface CardViewProps {
  card: Card
  size?: Size
  onClick?: () => void
  /** Highlight as a valid affordance (ring + pointer). */
  selectable?: boolean
  /** Dim as currently unplayable. */
  dimmed?: boolean
  faceDown?: boolean
  className?: string
  children?: ReactNode
}

/** Presentational card: art in a rounded frame, with optional overlays. */
export function CardView({
  card,
  size = 'md',
  onClick,
  selectable = false,
  dimmed = false,
  faceDown = false,
  className = '',
  children,
}: CardViewProps) {
  const interactive = !!onClick
  const ring = selectable ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent' : 'ring-1 ring-black/30'

  return (
    <div
      className={`relative ${sizeClasses[size]} ${dimmed ? 'opacity-40 saturate-50' : ''} ${className}`}
    >
      {faceDown ? (
        <div
          role="img"
          aria-label="Face-down card"
          className={`aspect-[5/7] w-full rounded-lg bg-gradient-to-br from-indigo-700 to-indigo-900 shadow-md ${ring} flex items-center justify-center`}
        >
          <div className="h-6 w-6 rounded-full border-2 border-white/70" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onClick}
          disabled={!interactive}
          aria-label={selectable ? `Play ${card.name}` : card.name}
          className={`block w-full rounded-lg shadow-md ${ring} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1 ${
            selectable ? 'cursor-pointer hover:-translate-y-1 transition-transform' : ''
          } ${interactive ? '' : 'cursor-default'}`}
        >
          <img src={card.image} alt={card.name} title={card.name} loading="lazy" className="w-full rounded-lg" />
        </button>
      )}
      {children}
    </div>
  )
}

/** Dashed placeholder for an empty Active/Bench slot. */
export function EmptySlot({ size = 'sm', label }: { size?: Size; label?: string }) {
  return (
    <div
      className={`${sizeClasses[size]} aspect-[5/7] rounded-lg border-2 border-dashed border-slate-400/50 flex items-center justify-center text-[9px] text-slate-400`}
    >
      {label}
    </div>
  )
}
