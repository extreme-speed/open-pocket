import { Fragment } from 'react'
import { getCard } from '../../engine/data/cards'
import { maxHp } from '../../engine/rules'
import type { InPlayPokemon } from '../../engine/types'
import { groupEnergy, ENERGY_STYLE } from '../energy'
import { useGame } from '../store'
import { CardView } from './Card'

const TOOL_GLYPH: Record<string, string> = {
  'A2 148': '🪖', // Rocky Helmet
  'A2 147': '🧥', // Giant Cape
  'A4a 067': '🛟', // Inflatable Boat
}

const STATUS_GLYPH: Record<string, string> = {
  burned: '🔥',
  poisoned: '☠️',
  asleep: '💤',
  paralyzed: '⚡',
  confused: '💫',
}

export interface InPlayCardProps {
  pokemon: InPlayPokemon
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onClick?: () => void
  selectable?: boolean
}

/** An in-play Pokémon: art + HP bar, attached energy pips, status, and tool. */
export function InPlayCard({ pokemon, size = 'md', onClick, selectable }: InPlayCardProps) {
  const card = getCard(pokemon.cardId)
  const total = maxHp(pokemon)
  const remaining = Math.max(0, total - pokemon.damage)
  const pct = Math.round((remaining / total) * 100)
  const barColor = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500'
  const fx = useGame((s) => s.fx.find((f) => f.uid === pokemon.uid))

  return (
    <CardView card={card} size={size} onClick={onClick} selectable={selectable}>
      {/* Damage/heal cue: keyed by fx.key so each hit re-runs the animation. */}
      {fx && (
        <Fragment key={fx.key}>
          <span
            className={`hit-flash pointer-events-none absolute inset-0 z-10 rounded-lg ${
              fx.kind === 'damage' ? 'bg-red-500' : 'bg-emerald-400'
            }`}
          />
          <span
            className={`float-up pointer-events-none absolute left-1/2 top-1/3 z-20 text-base font-black [text-shadow:0_1px_2px_rgba(0,0,0,0.85)] ${
              fx.kind === 'damage' ? 'text-red-300' : 'text-emerald-200'
            }`}
          >
            {fx.kind === 'damage' ? `-${fx.amount}` : `+${fx.amount}`}
          </span>
        </Fragment>
      )}
      {/* HP bar */}
      <div className="absolute inset-x-1 top-1 rounded-full bg-black/40 p-[1px]">
        <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {/* Remaining HP */}
      <span className="absolute -top-1.5 right-0 rounded-full bg-slate-900/90 px-1.5 text-[10px] font-bold leading-4 text-white">
        {remaining}
      </span>
      {/* Tool */}
      {pokemon.tool && (
        <span className="absolute -left-1.5 top-1 text-xs" title={getCard(pokemon.tool).name}>
          {TOOL_GLYPH[pokemon.tool] ?? '🔧'}
        </span>
      )}
      {/* Status */}
      {pokemon.status.length > 0 && (
        <span className="absolute -left-1.5 top-6 text-xs">
          {pokemon.status.map((s) => STATUS_GLYPH[s] ?? '?').join('')}
        </span>
      )}
      {/* Energy pips */}
      <div className="absolute inset-x-0 -bottom-2 flex flex-wrap justify-center gap-0.5">
        {groupEnergy(pokemon.attachedEnergy).map(({ type, count }) => (
          <span
            key={type}
            className={`flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white ring-1 ring-white/60 ${ENERGY_STYLE[type].bg}`}
            title={`${count} ${type}`}
          >
            {ENERGY_STYLE[type].glyph}
            {count > 1 ? count : ''}
          </span>
        ))}
      </div>
    </CardView>
  )
}
