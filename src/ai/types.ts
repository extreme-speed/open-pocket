// Shared AI types: the recorded-game format (the contract between the offline
// self-play runner and the Replay UI) and the rollout-policy signature.

import type { Move, PlayerIndex } from '../engine/types'
import type { RngState } from '../engine/rng'

/** A ranked alternative the searcher considered for one decision. */
export interface RankedMove {
  move: Move
  visits: number
  winProb: number
}

/** One decision in a recorded game, in play order. Applying every `move` in
 *  order from `createGame(deckA, deckB, { seed, firstPlayer })` reproduces the
 *  whole game exactly (the search uses a separate RNG, so it never perturbs the
 *  real line). */
export interface RecordedDecision {
  seat: PlayerIndex
  move: Move
  /** The chosen move's win probability, from `seat`'s perspective. */
  winProb: number
  /** All moves the searcher ranked, best first. */
  ranked: RankedMove[]
}

/** A fully recorded self-play game, serialized to `games/<matchup>/<seed>.json`. */
export interface RecordedGame {
  matchup: string
  deckA: string
  deckB: string
  seed: number
  firstPlayer: PlayerIndex
  winner: PlayerIndex | null
  iterations: number
  decisions: RecordedDecision[]
}

/** A heuristic player: pick one of the supplied legal moves, given an RNG it may
 *  advance. Used both as the MCTS rollout policy and as a benchmark opponent. */
export type Policy = (state: import('../engine/types').GameState, moves: Move[], rng: RngState) => Move
