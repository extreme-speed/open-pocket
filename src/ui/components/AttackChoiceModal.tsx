import { getCard } from '../../engine/data/cards'
import { other } from '../../engine/rules'
import { useGame } from '../store'
import { CardView } from './Card'

/**
 * The mid-attack "discard a Supporter" choice (Mega Absol ex's Darkness Claw).
 * The card reveals the opponent's hand, so we show it in full here — but only the
 * Supporters (the choice's candidate cards) are highlighted and tappable; the
 * rest are dimmed, just revealed. This choice can't be made on the board because
 * the opponent's hand is never shown there. Undo is offered since the overlay
 * sits over the bottom bar.
 */
export default function AttackChoiceModal() {
  const state = useGame((s) => s.state!)
  const dispatch = useGame((s) => s.dispatch)
  const undo = useGame((s) => s.undo)
  const canUndo = useGame((s) => s.history.length > 0)

  const choice = state.pendingAttackChoice
  if (state.phase !== 'awaitingAttackChoice' || !choice) return null

  const opponent = other(choice.chooser)
  const hand = state.players[opponent].hand
  const pickable = new Set(choice.cardIds)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Discard a Supporter"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/85 p-6"
    >
      <div className="text-center">
        <h2 className="text-lg font-bold text-amber-300">Discard a Supporter</h2>
        <p className="mt-1 text-sm text-slate-300">
          Player {opponent + 1}&rsquo;s hand is revealed — tap a highlighted Supporter to discard it.
        </p>
      </div>
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 overflow-y-auto">
        {hand.map((id, i) => {
          const canPick = pickable.has(id)
          return (
            <CardView
              key={`${id}-${i}`}
              card={getCard(id)}
              size="sm"
              selectable={canPick}
              dimmed={!canPick}
              onClick={canPick ? () => dispatch({ type: 'AttackChoice', cardId: id }) : undefined}
            />
          )
        })}
      </div>
      {canUndo && (
        <button
          type="button"
          onClick={undo}
          className="rounded-full bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 shadow ring-1 ring-white/10 hover:bg-slate-700"
        >
          ↶ Undo
        </button>
      )}
    </div>
  )
}
