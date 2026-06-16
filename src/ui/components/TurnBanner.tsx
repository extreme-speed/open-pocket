import { getDeck } from '../../engine/data/cards'
import type { GameState } from '../../engine/types'
import { useGame } from '../store'

/** Short, human description of the current phase / whose turn it is. */
function phaseLabel(state: GameState): string {
  switch (state.phase) {
    case 'setup':
      return 'Setup — place your Active and Bench'
    case 'awaitingKOReplacement':
      return 'Choose a new Active Pokémon'
    case 'awaitingAttackChoice':
      return 'Choose a Supporter to discard'
    case 'gameOver':
      return 'Game over'
    default:
      return `Turn ${state.turn}`
  }
}

/** Compact status: whose turn it is, the phase, and the active deck. Laid out by
 *  the header in Board — this carries no layout assumptions of its own. */
export default function TurnBanner() {
  const state = useGame((s) => s.state!)
  const seat = useGame((s) => s.viewPerspective)
  const deck = getDeck(state.players[seat].deckId)

  return (
    <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
      <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 font-bold text-slate-950 shadow-sm shadow-amber-400/30">
        P{seat + 1}
      </span>
      <span className="truncate text-slate-100">{phaseLabel(state)}</span>
      <span className="hidden truncate text-slate-500 sm:inline">· {deck.title}</span>
    </div>
  )
}
