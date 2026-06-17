// Observation + world sampler — the honest-determinization core of the searcher.
//
// `observe(state, seat)` reduces the true state to exactly what `seat` legitimately
// sees: all public state, its own hand, and *counts/pools* in place of hidden
// cards. The opponent's hand is dropped entirely; in its place we keep the size
// and the multiset of cards it *could* be (their decklist minus everything on
// the board / in the discard). Our own deck order is dropped too — we don't see
// our draws coming.
//
// `sampleWorld(obs, rng)` then fills the redacted slots with one concrete, legal
// world: deal the opponent a random hand of the right size from their unseen
// pool, shuffle the rest into their deck, and shuffle our own deck. Because the
// observation already discarded the real hidden cards, a sampled world can never
// leak information the seat shouldn't have.

import { buildDeck } from '../engine/setup'
import { shuffle, type RngState } from '../engine/rng'
import { inPlay, other } from '../engine/rules'
import type { GameState, PlayerIndex } from '../engine/types'

export interface Observation {
  seat: PlayerIndex
  /** A redacted clone of the true state. The opponent's `hand`/`deck` are emptied
   *  (their cards live in `oppUnseen` instead); the seat's own `deck` order is
   *  meaningless and gets reshuffled on sampling. */
  state: GameState
  /** How many cards the opponent is holding (public knowledge in Pocket). */
  oppHandSize: number
  /** The multiset of opponent cards not visible to us: their hand + their deck. */
  oppUnseen: string[]
  /** The multiset of our own remaining deck (order hidden even from us). */
  seatDeck: string[]
}

/** Multiset subtraction: remove one occurrence of each id in `remove` from `from`. */
function without(from: readonly string[], remove: readonly string[]): string[] {
  const out = from.slice()
  for (const id of remove) {
    const i = out.indexOf(id)
    if (i >= 0) out.splice(i, 1)
  }
  return out
}

/** Every opponent card id we can currently see: in-play evolution stacks, tools,
 *  a Stadium they own, and their discard. (Energy isn't a card in Pocket.) */
function visibleOppCards(state: GameState, opp: PlayerIndex): string[] {
  const p = state.players[opp]
  const seen: string[] = []
  for (const pk of inPlay(p)) {
    seen.push(...pk.stack)
    if (pk.tool) seen.push(pk.tool)
  }
  seen.push(...p.discard)
  if (state.stadium && state.stadiumOwner === opp) seen.push(state.stadium)
  return seen
}

export function observe(state: GameState, seat: PlayerIndex): Observation {
  const opp = other(seat)
  const oppPlayer = state.players[opp]
  const oppUnseen = without(buildDeck(oppPlayer.deckId), visibleOppCards(state, opp))

  const redacted = structuredClone(state)
  // Drop everything the seat isn't entitled to see.
  redacted.players[opp].hand = []
  redacted.players[opp].deck = []

  return {
    seat,
    state: redacted,
    oppHandSize: oppPlayer.hand.length,
    oppUnseen,
    seatDeck: state.players[seat].deck.slice(),
  }
}

/**
 * Materialize one consistent full world from an observation. The opponent's hand
 * is a random draw of the known size from their unseen pool; the remainder is
 * their (shuffled) deck. Our own deck is reshuffled. All public state is
 * preserved verbatim, so `legalMoves` for the acting seat is unchanged.
 */
export function sampleWorld(obs: Observation, rng: RngState): GameState {
  const world = structuredClone(obs.state)
  const opp = other(obs.seat)

  const shuffledUnseen = shuffle(rng, obs.oppUnseen)
  world.players[opp].hand = shuffledUnseen.slice(0, obs.oppHandSize)
  world.players[opp].deck = shuffledUnseen.slice(obs.oppHandSize)

  world.players[obs.seat].deck = shuffle(rng, obs.seatDeck)

  // The world advances its own RNG during search; give it a fresh stream derived
  // from the sampler so search never reuses the real game's coin flips.
  world.rng = { seed: (rng.seed ^ 0x85ebca6b) >>> 0 }

  return world
}
