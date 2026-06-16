import type { PlayerIndex } from '../../engine/types'
import { ENERGY_STYLE } from '../energy'
import { useGame } from '../store'
import { useEnergyTap } from '../useBoardTap'

/** The Energy Zone for one player: the energy available to attach this turn and
 *  what's queued next. When an attachment is available it glows — tap it to
 *  attach (picking the Pokémon on the board if there's a choice). */
export default function EnergyZone({ owner }: { owner: PlayerIndex }) {
  const energy = useGame((s) => s.state!.players[owner].currentEnergy)
  const registered = useGame((s) => s.state!.players[owner].registeredEnergy)
  const tap = useEnergyTap()

  const dot = energy ? ENERGY_STYLE[energy] : null
  const nextDot = ENERGY_STYLE[registered[0]]

  const ring = tap.highlighted
    ? 'ring-2 ring-amber-400 hover:bg-slate-800 cursor-pointer'
    : 'ring-1 ring-white/10 cursor-default'

  return (
    <button
      type="button"
      onClick={tap.onClick}
      disabled={!tap.highlighted}
      className={`flex items-center gap-1.5 rounded-lg bg-slate-900/70 px-2 py-1 text-[10px] font-semibold text-white ${ring}`}
    >
      <span className="text-slate-300">Energy</span>
      {dot ? (
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${dot.bg} ring-1 ring-white/70`}>
          {dot.glyph}
        </span>
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 ring-1 ring-white/30">
          –
        </span>
      )}
      <span className="text-slate-400">next</span>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${nextDot.bg} ring-1 ring-white/50`}>
        {nextDot.glyph}
      </span>
    </button>
  )
}
