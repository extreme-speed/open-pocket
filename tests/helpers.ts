// Shared test helpers: hand-build GameStates ("set up a state, apply a move,
// assert the result"), plus a driver that auto-resolves the setup phase.

import { apply } from '../src/engine/reducer'
import { legalMoves } from '../src/engine/moves'
import { makeRng } from '../src/engine/rng'
import { createGame, type NewGameOptions } from '../src/engine/setup'
import type {
  EnergyType,
  GameState,
  InPlayPokemon,
  Move,
  PlayerIndex,
  PlayerState,
} from '../src/engine/types'

export const DECK_FIRE = 'mega-blaziken-ex-b1-greninja-a1'
export const DECK_WATER = 'suicune-ex-a4a-baxcalibur-b2a'
export const DECK_DARK = 'hydreigon-mega-absol-ex-b1'
export const DECK_LIGHTNING = 'miraidon-ex-b3a-magnezone-b1a'

let testUid = 0

export function mon(cardId: string, opts: Partial<InPlayPokemon> = {}): InPlayPokemon {
  return {
    uid: opts.uid ?? `t${testUid++}`,
    cardId,
    stack: opts.stack ?? [cardId],
    damage: opts.damage ?? 0,
    attachedEnergy: opts.attachedEnergy ?? [],
    tool: opts.tool ?? null,
    status: opts.status ?? [],
    playedTurn: opts.playedTurn ?? 0,
    evolvedThisTurn: opts.evolvedThisTurn ?? false,
    abilityUsedThisTurn: opts.abilityUsedThisTurn ?? false,
    enteredBenchThisTurn: opts.enteredBenchThisTurn ?? false,
    mustFlipToAttack: opts.mustFlipToAttack ?? false,
  }
}

export interface PlayerOpts {
  registered?: EnergyType[]
  active?: InPlayPokemon | null
  bench?: InPlayPokemon[]
  hand?: string[]
  deck?: string[]
  discard?: string[]
  discardedEnergy?: EnergyType[]
  points?: number
  currentEnergy?: EnergyType | null
  energyAttachedThisTurn?: boolean
  retreatedThisTurn?: boolean
  supporterPlayedThisTurn?: boolean
}

export function player(opts: PlayerOpts = {}): PlayerState {
  return {
    deckId: 'test',
    registeredEnergy: opts.registered ?? ['Colorless'],
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
    setupDone: true,
  }
}

/** A main-phase game (turn 3 by default, so evolution is legal) with two players. */
export function game(p0: PlayerState, p1: PlayerState, over: Partial<GameState> = {}): GameState {
  return {
    turn: 3,
    current: 0,
    firstPlayer: 0,
    phase: 'main',
    players: [p0, p1],
    stadium: null,
    stadiumOwner: null,
    koReplacements: [],
    pendingFlow: null,
    pendingAttackChoice: null,
    rng: makeRng(over.turn ?? 1),
    winner: null,
    uidCounter: 1000,
    ...over,
  }
}

/**
 * Drive the setup phase to completion: each player makes its first Basic the
 * Active, then benches up to `benchCount` more Basics.
 */
export function autoSetup(deckA: string, deckB: string, opts: NewGameOptions = {}, benchCount = 0): GameState {
  let s = createGame(deckA, deckB, opts)
  while (s.phase === 'setup') {
    const placing = s.players.findIndex((p) => !p.setupDone) as PlayerIndex
    const p = s.players[placing]
    const moves = legalMoves(s)
    let move: Move
    if (!p.active) {
      move = moves.find((m) => m.type === 'SetupActive')!
    } else if (p.bench.length < benchCount && moves.some((m) => m.type === 'SetupBench')) {
      move = moves.find((m) => m.type === 'SetupBench')!
    } else {
      move = { type: 'SetupDone' }
    }
    s = apply(s, move).state
  }
  return s
}

/** Find the first legal move matching a predicate (throws if none). */
export function findMove(s: GameState, pred: (m: Move) => boolean): Move {
  const m = legalMoves(s).find(pred)
  if (!m) throw new Error('No legal move matched predicate')
  return m
}

export function hasMove(s: GameState, pred: (m: Move) => boolean): boolean {
  return legalMoves(s).some(pred)
}
