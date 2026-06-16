import { getCard } from '../../engine/data/cards'
import { useGame } from '../store'
import { useHandTap } from '../useBoardTap'
import { CardView } from './Card'

/** One hand card — split out so it can own its tap hook. */
function HandCard({ cardId, className }: { cardId: string; className: string }) {
  const tap = useHandTap(cardId)
  return (
    <CardView
      card={getCard(cardId)}
      size="sm"
      selectable={tap.highlighted}
      onClick={tap.onClick}
      className={className}
    />
  )
}

/** The perspective player's hand. Tap a card to act on it (the bottom ActionBar
 *  shows where it can be played) or to read it. Playable cards stay highlighted. */
export default function Hand() {
  const seat = useGame((s) => s.viewPerspective)
  const hand = useGame((s) => s.state!.players[seat].hand)

  if (hand.length === 0) {
    return <div className="py-4 text-center text-xs text-slate-400">Empty hand</div>
  }

  return (
    <div className="flex justify-center px-2 py-3">
      {hand.map((id, i) => (
        <HandCard key={`${id}-${i}`} cardId={id} className={i > 0 ? '-ml-3' : ''} />
      ))}
    </div>
  )
}
