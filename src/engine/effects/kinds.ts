// Shared handler/descriptor shapes for the effect registry. Kept separate from
// registry.ts so the per-card handler modules can import these types without a
// runtime import cycle.

import type { GameState, InPlayPokemon, Move, PlayerIndex } from '../types'
import type { EffectContext } from './context'

export type AttackMove = Extract<Move, { type: 'Attack' }>
export type AbilityMove = Extract<Move, { type: 'UseAbility' }>
export type ItemMove = Extract<Move, { type: 'PlayItem' }>
export type SupporterMove = Extract<Move, { type: 'PlaySupporter' }>
export type TrainerMove = ItemMove | SupporterMove

/** Applies the card-specific part of an attack (base damage is applied first by the reducer). */
export type AttackHandler = (
  ctx: EffectContext,
  attacker: InPlayPokemon,
  attackIndex: number,
  move: AttackMove,
) => void

export interface ActivatedAbility {
  /** Legal UseAbility moves for this source right now (empty = unavailable). */
  enumerate(state: GameState, source: InPlayPokemon, owner: PlayerIndex): Move[]
  run(ctx: EffectContext, source: InPlayPokemon, move: AbilityMove): void
}

/** Ability triggered at the end of the controller's own turn (e.g. Legendary Pulse). */
export type EndOfTurnAbility = (ctx: EffectContext, source: InPlayPokemon) => void

/**
 * Ability triggered during the between-turns Pokémon Checkup. Unlike
 * EndOfTurnAbility, this fires for BOTH players' Pokémon (the checkup is not
 * owned by the player whose turn just ended). `ctx.me` is the source's owner.
 */
export type CheckupAbility = (ctx: EffectContext, source: InPlayPokemon) => void

export interface TrainerDescriptor {
  /** Base precondition for the card to be playable at all. */
  playable(state: GameState, owner: PlayerIndex): boolean
  /** Concrete legal moves (one per target variant). */
  enumerate(state: GameState, owner: PlayerIndex): Move[]
  run(ctx: EffectContext, move: TrainerMove): void
}
