import { getCard } from '../../engine/data/cards'
import type { PlayerIndex } from '../../engine/types'
import { useGame } from '../store'
import { CardView } from './Card'

/**
 * The shared in-play Stadium card, shown on its owner's field row. Renders
 * nothing unless a Stadium is in play and owned by the given player. Tapping
 * it enlarges it like any other card.
 */
export default function Stadium({ owner }: { owner: PlayerIndex }) {
  const stadium = useGame((s) => s.state!.stadium)
  const stadiumOwner = useGame((s) => s.state!.stadiumOwner)
  const setPreview = useGame((s) => s.setPreview)

  if (!stadium || stadiumOwner !== owner) return null

  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-emerald-400/40 bg-emerald-400/5 px-3 py-2 shadow-sm">
      <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-300/80">Stadium</span>
      <CardView card={getCard(stadium)} size="sm" onClick={() => setPreview(stadium)} />
    </div>
  )
}
