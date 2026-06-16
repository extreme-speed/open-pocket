// Hooks that turn a board tap into the right action, given the current selection.
// They keep the components dumb: each returns whether the element should glow as
// actionable and what its onClick does.
//
// Tapping a card always opens the enlarged preview — consistently, whether or not
// it can act. When it can, the preview carries its `source` so it shows the card's
// actions underneath. The exceptions are target-picking (a tap commits the move)
// and the Energy zone (not a card, so it acts straight away).

import {
  currentTargeting,
  findInPlay,
  handSources,
  pokemonSources,
  previewCardsFor,
} from './selection'
import { useGame } from './store'

interface Tap {
  /** Glow as an actionable affordance (ring + pointer). */
  highlighted: boolean
  onClick: () => void
}

/** Tap behaviour for an in-play Pokémon (either player's). */
export function usePokemonTap(uid: string, cardId: string): Tap {
  const state = useGame((s) => s.state!)
  const moves = useGame((s) => s.moves)
  const selection = useGame((s) => s.selection)
  const dispatch = useGame((s) => s.dispatch)
  const setPreview = useGame((s) => s.setPreview)
  const openPreview = useGame((s) => s.openPreview)

  const targeting = currentTargeting(state, moves, selection)
  if (targeting) {
    const move = targeting.byUid.get(uid)
    if (move) return { highlighted: true, onClick: () => dispatch(move) }
    return { highlighted: false, onClick: () => setPreview(cardId) }
  }
  const isSource = !!uid && pokemonSources(state, moves).has(uid)
  return {
    highlighted: isSource,
    onClick: () => {
      // Browse the whole Pokémon: evolution stack + attached tool, opened at the
      // current top card (where its actions live).
      const pkm = uid ? findInPlay(state, uid) : null
      const cards = pkm ? previewCardsFor(pkm) : [cardId]
      const main = pkm ? Math.max(0, pkm.stack.length - 1) : 0
      openPreview(cards, main, isSource ? { kind: 'pokemon', uid } : null)
    },
  }
}

/** Tap behaviour for a hand card. */
export function useHandTap(cardId: string): Tap {
  const state = useGame((s) => s.state!)
  const moves = useGame((s) => s.moves)
  const selection = useGame((s) => s.selection)
  const dispatch = useGame((s) => s.dispatch)
  const setPreview = useGame((s) => s.setPreview)

  const targeting = currentTargeting(state, moves, selection)
  if (targeting) {
    const move = targeting.byHandCard.get(cardId)
    if (move) return { highlighted: true, onClick: () => dispatch(move) }
    return { highlighted: false, onClick: () => setPreview(cardId) }
  }
  const isSource = handSources(state, moves).has(cardId)
  return {
    highlighted: isSource,
    onClick: () => setPreview(cardId, isSource ? { kind: 'hand', cardId } : null),
  }
}

/** Tap behaviour for the Energy Zone: attach now if there's one target, else
 *  enter target-picking over your Pokémon. */
export function useEnergyTap(): Tap {
  const moves = useGame((s) => s.moves)
  const selection = useGame((s) => s.selection)
  const dispatch = useGame((s) => s.dispatch)
  const enterTargeting = useGame((s) => s.enterTargeting)

  const energyMoves = moves.filter((m) => m.type === 'AttachEnergy')
  const highlighted = energyMoves.length > 0 && selection.kind !== 'target'
  return {
    highlighted,
    onClick: () => {
      if (energyMoves.length === 0) return
      if (energyMoves.length === 1) dispatch(energyMoves[0])
      else enterTargeting('Attach Energy', energyMoves)
    },
  }
}
