// Deck construction, shuffling, and the opening-hand deal.
//
// Pocket has no mulligan: you always draw 5 with at least one Basic, reshuffling
// the whole deck until that's true.

import { getCard, getDeck } from './data/cards'
import { makeRng, shuffle, type RngState } from './rng'
import type { Card, GameState, PlayerIndex, PlayerState, PokemonCard } from './types'

export const OPENING_HAND_SIZE = 5
export const MAX_BENCH = 3
export const POINTS_TO_WIN = 3

export function isBasic(card: Card): card is PokemonCard {
  return card.kind === 'pokemon' && card.stage === 0
}

/** Expand a deck's card refs into a flat list of card ids (count copies each). */
export function buildDeck(deckId: string): string[] {
  const deck = getDeck(deckId)
  const cards: string[] = []
  for (const ref of deck.cards) {
    for (let i = 0; i < ref.count; i++) cards.push(ref.id)
  }
  return cards
}

/**
 * Shuffle and deal an opening hand with the ≥1-Basic guarantee. Returns the
 * remaining deck plus the hand. Reshuffles the full deck until the guarantee
 * holds (bounded to avoid an infinite loop on a hypothetical all-evolution deck).
 */
export function dealOpeningHand(rng: RngState, deckCards: readonly string[]): {
  hand: string[]
  deck: string[]
} {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const shuffled = shuffle(rng, deckCards)
    const hand = shuffled.slice(0, OPENING_HAND_SIZE)
    if (hand.some((id) => isBasic(getCard(id)))) {
      return { hand, deck: shuffled.slice(OPENING_HAND_SIZE) }
    }
  }
  throw new Error('Could not deal an opening hand with a Basic (deck has no Basics?)')
}

function makePlayer(rng: RngState, deckId: string): PlayerState {
  const deck = getDeck(deckId)
  const { hand, deck: rest } = dealOpeningHand(rng, buildDeck(deckId))
  return {
    deckId,
    registeredEnergy: deck.energyTypes,
    active: null,
    bench: [],
    hand,
    deck: rest,
    discard: [],
    discardedEnergy: [],
    points: 0,
    currentEnergy: null,
    energyAttachedThisTurn: false,
    retreatedThisTurn: false,
    supporterPlayedThisTurn: false,
    setupDone: false,
  }
}

export interface NewGameOptions {
  seed?: number
  /** Force who goes first; otherwise decided by a seeded coin flip. */
  firstPlayer?: PlayerIndex
}

/**
 * Create a fresh game in the `setup` phase: both players have an opening hand
 * and must choose an Active (and optional Bench) before play begins.
 */
export function createGame(deckAId: string, deckBId: string, opts: NewGameOptions = {}): GameState {
  const rng = makeRng(opts.seed ?? 0)
  const players: [PlayerState, PlayerState] = [makePlayer(rng, deckAId), makePlayer(rng, deckBId)]
  const firstPlayer: PlayerIndex = opts.firstPlayer ?? (shuffle(rng, [0, 1])[0] as PlayerIndex)

  return {
    turn: 0,
    current: firstPlayer,
    firstPlayer,
    phase: 'setup',
    players,
    stadium: null,
    stadiumOwner: null,
    koReplacements: [],
    pendingFlow: null,
    pendingAttackChoice: null,
    rng,
    winner: null,
    uidCounter: 0,
  }
}
