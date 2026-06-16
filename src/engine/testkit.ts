// Test harness for the engine: build an arbitrary mid-game GameState directly,
// dispatch a move through the real reducer, and assert on the result. This is
// NOT a test suite (no `.test` suffix) — it's imported by the effect tests.
//
// Why build state by hand instead of playing a real game? Reaching a specific
// board (this Pokémon Active, that energy attached, this card in hand) by
// dispatching legal moves is brittle and slow. The reducer treats GameState as
// plain data, so constructing one and calling apply() exercises the exact same
// code paths as real play.

import { getCard } from './data/cards'
import { apply } from './reducer'
import { flipCoin } from './rng'
import type {
  EnergyType,
  GameState,
  InPlayPokemon,
  Move,
  PlayerIndex,
  PlayerState,
  PokemonCard,
} from './types'

let uidSeq = 0

/** Build an in-play Pokémon. uids are unique and prefixed `t` so they never
 *  collide with the reducer's minted `pk…` uids (uidCounter starts high). */
export function mon(cardId: string, opts: Partial<InPlayPokemon> = {}): InPlayPokemon {
  return {
    uid: opts.uid ?? `t${uidSeq++}`,
    cardId,
    stack: opts.stack ?? [cardId],
    damage: opts.damage ?? 0,
    attachedEnergy: opts.attachedEnergy ?? [],
    tool: opts.tool ?? null,
    status: opts.status ?? [],
    playedTurn: opts.playedTurn ?? 1,
    evolvedThisTurn: opts.evolvedThisTurn ?? false,
    abilityUsedThisTurn: opts.abilityUsedThisTurn ?? false,
    enteredBenchThisTurn: opts.enteredBenchThisTurn ?? false,
    mustFlipToAttack: opts.mustFlipToAttack ?? false,
  }
}

/** Build a player. Defaults to a finished-setup player with nothing in play. */
export function player(opts: Partial<PlayerState> = {}): PlayerState {
  return {
    deckId: opts.deckId ?? 'test',
    registeredEnergy: opts.registeredEnergy ?? [],
    active: opts.active ?? null,
    bench: opts.bench ?? [],
    hand: opts.hand ?? [],
    deck: opts.deck ?? [],
    discard: opts.discard ?? [],
    discardedEnergy: opts.discardedEnergy ?? [],
    points: opts.points ?? 0,
    currentEnergy: opts.currentEnergy ?? null,
    energyAttachedThisTurn: opts.energyAttachedThisTurn ?? false,
    retreatedThisTurn: opts.retreatedThisTurn ?? false,
    supporterPlayedThisTurn: opts.supporterPlayedThisTurn ?? false,
    setupDone: opts.setupDone ?? true,
  }
}

interface GameOpts {
  current?: PlayerIndex
  turn?: number
  firstPlayer?: PlayerIndex
  stadium?: string | null
  stadiumOwner?: PlayerIndex | null
  seed?: number
}

/** Build a main-phase GameState with players[0] and players[1]. The acting
 *  player is `current` (default 0); effect `ctx.self`/`ctx.foe` follow from it. */
export function game(p0: PlayerState, p1: PlayerState, opts: GameOpts = {}): GameState {
  return {
    turn: opts.turn ?? 3,
    current: opts.current ?? 0,
    firstPlayer: opts.firstPlayer ?? 0,
    phase: 'main',
    players: [p0, p1],
    stadium: opts.stadium ?? null,
    stadiumOwner: opts.stadiumOwner ?? null,
    koReplacements: [],
    pendingFlow: null,
    pendingAttackChoice: null,
    rng: { seed: opts.seed ?? 1 },
    winner: null,
    uidCounter: 1000,
  }
}

/** Run a move through the real reducer; returns the next state + emitted events. */
export const run = apply

/** Base printed damage of an attack (before weakness / handler extras). */
export function baseDamage(cardId: string, attackIndex = 0): number {
  return (getCard(cardId) as PokemonCard).attacks[attackIndex].damage
}

/**
 * Smallest rng seed whose coin-flip stream begins with `want`. flipCoin reads
 * the seed deterministically, so seeding a state with this forces the outcome.
 * Use [true] to force the next flip heads, [false] for tails.
 */
export function seedForFlips(want: boolean[]): number {
  for (let s = 0; s < 1_000_000; s++) {
    const rng = { seed: s }
    if (want.every((w) => flipCoin(rng) === w)) return s
  }
  throw new Error(`no seed yields flips ${want.join(',')}`)
}

export const HEADS = seedForFlips([true])
export const TAILS = seedForFlips([false])

/** Energy array shorthand: qty('Fire', 2) → ['Fire','Fire']. */
export function qty(type: EnergyType, n: number): EnergyType[] {
  return Array(n).fill(type)
}

/** Find any in-play Pokémon by uid across both players (for post-move asserts). */
export function byUid(state: GameState, uid: string): InPlayPokemon | undefined {
  for (const p of state.players) {
    if (p.active?.uid === uid) return p.active
    const b = p.bench.find((x) => x.uid === uid)
    if (b) return b
  }
  return undefined
}

export type { Move }
