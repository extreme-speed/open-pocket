// Parametric value function, ported from deckgym-core's value_functions.rs.
//
// A linear combination of public features, evaluated from one seat's point of
// view. Points dominate (the game is won on points); the rest are positional
// tie-breakers that steer rollouts toward sane play. We start from deckgym's
// grid-searched baseline weights and re-tune later (see PLAN.md).
//
// `evaluate` returns a raw score (higher = better for `seat`). `winProb` squashes
// the score *difference* through a logistic so the searcher can treat it as a
// probability in [0, 1].

import { canPayCost, inPlay, isKnockedOut, maxHp, other, pokemonCard, remainingHp } from '../engine/rules'
import { POINTS_TO_WIN } from '../engine/setup'
import type { GameState, InPlayPokemon, PlayerIndex, PlayerState } from '../engine/types'

/** Baseline weights. Tuned loosely after deckgym; points intentionally dwarf the
 *  positional terms. */
const W = {
  points: 100, // each point banked
  nearWin: 40, // extra urgency per point as a player nears the 3 needed
  pokemonValue: 1, // sum of in-play "worth" (hp tier + ex/mega premium)
  handSize: 1.5, // cards in hand are options
  deckSize: 0.1, // a little fuel left is mildly good
  activeOnline: 12, // the Active can attack right now
  energyDistance: -4, // energy still needed before the Active can attack
  activeSafety: 10, // fraction of the Active's HP still intact
  activeRetreat: -1.5, // a high retreat cost pins you
  hasTool: 3, // a Tool attached is a small edge
  onlineCount: 5, // benched threats that could attack if promoted
  oppDiscard: 0.2, // resources the opponent has burned through
}

/** How many more Energy the Pokémon needs before its *cheapest* usable attack
 *  comes online (0 if it can already attack). */
function energyDistanceToOnline(p: InPlayPokemon): number {
  const card = pokemonCard(p)
  if (card.attacks.length === 0) return 99
  let best = 99
  for (const atk of card.attacks) {
    const deficit = Math.max(0, atk.cost.length - p.attachedEnergy.length)
    best = Math.min(best, deficit)
  }
  return best
}

/** True if `p` can pay for at least one of its attacks with its current Energy. */
function isOnline(p: InPlayPokemon): boolean {
  const card = pokemonCard(p)
  return card.attacks.some((atk) => canPayCost(p.attachedEnergy, atk.cost))
}

/** Rough standalone worth of a Pokémon in play (independent of damage). */
function pokemonWorth(p: InPlayPokemon): number {
  const card = pokemonCard(p)
  let v = card.hp / 30 // a tougher body is worth more
  if (card.isMega) v += 6
  else if (card.isEx) v += 3
  return v
}

function playerScore(state: GameState, idx: PlayerIndex): number {
  const p: PlayerState = state.players[idx]
  let score = 0

  score += W.points * p.points
  // Urgency ramps as a player approaches the points needed to win.
  score += W.nearWin * Math.max(0, p.points - (POINTS_TO_WIN - 1)) * 2 // only fires at/after game point
  if (p.points >= POINTS_TO_WIN - 1) score += W.nearWin

  score += W.handSize * p.hand.length
  score += W.deckSize * p.deck.length
  // Cards burned through (discarded) read as spent resources, a mild minus.
  score -= W.oppDiscard * p.discard.length

  let online = 0
  for (const pk of inPlay(p)) {
    if (isKnockedOut(pk)) continue
    score += W.pokemonValue * pokemonWorth(pk)
    if (pk.tool) score += W.hasTool
    if (isOnline(pk)) online++
    else score += W.energyDistance * Math.min(3, energyDistanceToOnline(pk))
  }
  score += W.onlineCount * online

  if (p.active && !isKnockedOut(p.active)) {
    if (isOnline(p.active)) score += W.activeOnline
    score += W.activeSafety * (remainingHp(p.active) / Math.max(1, maxHp(p.active)))
    score += W.activeRetreat * pokemonCard(p.active).retreatCost
  } else {
    // No usable Active is a precarious spot.
    score -= W.activeSafety
  }

  return score
}

/** Raw positional score from `seat`'s perspective (mine − theirs). A decisive
 *  result short-circuits to a large ± value. */
export function evaluate(state: GameState, seat: PlayerIndex): number {
  if (state.winner !== null) return state.winner === seat ? 1e6 : -1e6
  // Zero-sum: my standing minus the opponent's (their spent resources are folded
  // into their own lower score via the discard penalty).
  return playerScore(state, seat) - playerScore(state, other(seat))
}

/** Logistic squash of the score into a win probability in (0, 1) for `seat`.
 *  Terminal states return exactly 1 or 0. */
export function winProb(state: GameState, seat: PlayerIndex): number {
  if (state.winner !== null) return state.winner === seat ? 1 : 0
  const diff = evaluate(state, seat)
  // Scale chosen so a ~one-point swing (≈100) maps to a clearly-favored ~0.65.
  return 1 / (1 + Math.exp(-diff / 160))
}
