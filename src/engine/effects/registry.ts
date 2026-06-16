// Central effect registry. moves.ts (enumeration) and reducer.ts (execution)
// look up card behaviour here by card id.

import type { GameState, InPlayPokemon, Move, PlayerIndex } from '../types'
import { attackEnumerators, attackHandlers } from './attacks'
import { activatedAbilities, checkupAbilities, endOfTurnAbilities } from './abilities'
import { trainers } from './trainers'
import type { AttackHandler, CheckupAbility, EndOfTurnAbility, TrainerDescriptor } from './kinds'

export { attackHandlers, activatedAbilities, checkupAbilities, endOfTurnAbilities, trainers }

export function getAttackHandler(cardId: string): AttackHandler | undefined {
  return attackHandlers[cardId]
}

export function getTrainer(cardId: string): TrainerDescriptor | undefined {
  return trainers[cardId]
}

export function getEndOfTurnAbility(cardId: string): EndOfTurnAbility | undefined {
  return endOfTurnAbilities[cardId]
}

export function getCheckupAbility(cardId: string): CheckupAbility | undefined {
  return checkupAbilities[cardId]
}

/** Concrete Attack moves for an attack index (target/discard variants). */
export function enumerateAttack(
  state: GameState,
  attacker: InPlayPokemon,
  owner: PlayerIndex,
  attackIndex: number,
): Move[] {
  const enumerator = attackEnumerators[attacker.cardId]
  if (enumerator) return enumerator(state, attacker, owner, attackIndex)
  return [{ type: 'Attack', attackIndex }]
}

/** Legal UseAbility moves for a source Pokémon (activated abilities only). */
export function enumerateAbility(
  state: GameState,
  source: InPlayPokemon,
  owner: PlayerIndex,
): Move[] {
  const ability = activatedAbilities[source.cardId]
  return ability ? ability.enumerate(state, source, owner) : []
}
