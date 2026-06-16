import { POINTS_TO_WIN } from '../../engine/setup'
import { useGame } from '../store'
import type { PlayerIndex } from '../../engine/types'

/** Win-condition pips (filled = points scored, 3 to win). */
export default function PointsTracker({ owner }: { owner: PlayerIndex }) {
  const points = useGame((s) => s.state!.players[owner].points)
  return (
    <div className="flex gap-1" aria-label={`${points} of ${POINTS_TO_WIN} points`}>
      {Array.from({ length: POINTS_TO_WIN }).map((_, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full ${i < points ? 'bg-amber-400' : 'bg-white/40'}`}
        />
      ))}
    </div>
  )
}
