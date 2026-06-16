// legalMoves(state): the single source of truth for "only valid moves".
//
// The UI renders exactly these affordances; the reducer trusts them (it does a
// light re-validation but assumes moves came from here).

import { getCard } from './data/cards'
import { INFLATABLE_BOAT, RARE_CANDY } from './data/ids'
import { canPayCost, inPlay, pokemonCard, retreatCost, isActionLocked } from './rules'
import { MAX_BENCH } from './setup'
import { enumerateAbility, enumerateAttack, getTrainer } from './effects/registry'
import type { GameState, InPlayPokemon, Move, PlayerIndex, PokemonCard } from './types'

/** A Pokémon can be evolved this turn (not the owner's first turn; in play since
 *  an earlier turn; hasn't already evolved this turn). */
function canEvolveTarget(state: GameState, target: InPlayPokemon): boolean {
  return state.turn > 2 && target.playedTurn < state.turn && !target.evolvedThisTurn
}

function toolAttachable(toolId: string, target: InPlayPokemon): boolean {
  if (target.tool) return false
  if (toolId === INFLATABLE_BOAT) return pokemonCard(target).energyType === 'Water'
  return true
}

function uniq(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

/** Moves available during the opening setup, for the player currently placing. */
function setupMoves(state: GameState, placing: PlayerIndex): Move[] {
  const p = state.players[placing]
  const basics = uniq(p.hand.filter((id) => isBasicCard(id)))
  if (!p.active) {
    return basics.map((cardId): Move => ({ type: 'SetupActive', cardId }))
  }
  const moves: Move[] = []
  if (p.bench.length < MAX_BENCH) {
    for (const cardId of basics) moves.push({ type: 'SetupBench', cardId })
  }
  moves.push({ type: 'SetupDone' })
  return moves
}

function isBasicCard(id: string): boolean {
  const c = getCard(id)
  return c.kind === 'pokemon' && c.stage === 0
}

/** The player who must act in the current phase (null if no one / game over). */
export function actingPlayer(state: GameState): PlayerIndex | null {
  switch (state.phase) {
    case 'setup': {
      const placing = state.players.findIndex((p) => !p.setupDone)
      return placing === -1 ? null : (placing as PlayerIndex)
    }
    case 'awaitingKOReplacement':
      return state.koReplacements[0] ?? null
    case 'awaitingAttackChoice':
      return state.pendingAttackChoice?.chooser ?? null
    case 'main':
      return state.current
    case 'gameOver':
      return null
  }
}

export function legalMoves(state: GameState): Move[] {
  if (state.phase === 'setup') {
    const placing = state.players.findIndex((p) => !p.setupDone)
    return placing === -1 ? [] : setupMoves(state, placing as PlayerIndex)
  }

  if (state.phase === 'awaitingKOReplacement') {
    const who = state.koReplacements[0]
    if (who === undefined) return []
    return state.players[who].bench.map((b): Move => ({ type: 'KOReplace', benchUid: b.uid }))
  }

  if (state.phase === 'awaitingAttackChoice') {
    const choice = state.pendingAttackChoice
    if (!choice) return []
    return choice.cardIds.map((cardId): Move => ({ type: 'AttackChoice', cardId }))
  }

  if (state.phase !== 'main') return []

  const me = state.current
  const p = state.players[me]
  const moves: Move[] = []
  const ourPokemon = inPlay(p)
  const handIds = uniq(p.hand)

  // Play Basic to Bench
  if (p.bench.length < MAX_BENCH) {
    for (const id of handIds) if (isBasicCard(id)) moves.push({ type: 'PlayBasic', cardId: id })
  }

  // Evolve (normal line)
  for (const id of handIds) {
    const c = getCard(id)
    if (c.kind !== 'pokemon' || c.evolvesFrom === null) continue
    for (const target of ourPokemon) {
      if (pokemonCard(target).name === c.evolvesFrom && canEvolveTarget(state, target)) {
        moves.push({ type: 'Evolve', cardId: id, targetUid: target.uid })
      }
    }
  }

  // Rare Candy: Basic -> Stage 2, skipping Stage 1
  if (p.hand.includes(RARE_CANDY)) {
    for (const id of handIds) {
      const c = getCard(id)
      if (c.kind !== 'pokemon' || c.stage !== 2) continue
      for (const target of ourPokemon) {
        const tc = pokemonCard(target)
        if (tc.stage === 0 && tc.name === c.basicName && canEvolveTarget(state, target)) {
          moves.push({ type: 'RareCandyEvolve', candyId: RARE_CANDY, cardId: id, targetUid: target.uid })
        }
      }
    }
  }

  // Attach Energy (once per turn)
  if (!p.energyAttachedThisTurn && p.currentEnergy !== null) {
    for (const target of ourPokemon) moves.push({ type: 'AttachEnergy', targetUid: target.uid })
  }

  // Attach Tool
  for (const id of handIds) {
    const c = getCard(id)
    if (c.kind !== 'trainer' || c.trainerType !== 'Tool') continue
    for (const target of ourPokemon) {
      if (toolAttachable(id, target)) moves.push({ type: 'AttachTool', cardId: id, targetUid: target.uid })
    }
  }

  // Items (unlimited per turn), excluding Rare Candy (own move type)
  for (const id of handIds) {
    if (id === RARE_CANDY) continue
    const c = getCard(id)
    if (c.kind !== 'trainer' || c.trainerType !== 'Item') continue
    const desc = getTrainer(id)
    if (desc && desc.playable(state, me)) moves.push(...desc.enumerate(state, me))
  }

  // Supporters (one per turn)
  if (!p.supporterPlayedThisTurn) {
    for (const id of handIds) {
      const c = getCard(id)
      if (c.kind !== 'trainer' || c.trainerType !== 'Supporter') continue
      const desc = getTrainer(id)
      if (desc && desc.playable(state, me)) moves.push(...desc.enumerate(state, me))
    }
  }

  // Stadium
  for (const id of handIds) {
    const c = getCard(id)
    if (c.kind !== 'trainer' || c.trainerType !== 'Stadium') continue
    if (state.stadium !== id) moves.push({ type: 'PlayStadium', cardId: id })
  }

  // Retreat (once per turn)
  if (
    !p.retreatedThisTurn &&
    p.active &&
    !isActionLocked(p.active) &&
    p.bench.length > 0 &&
    p.active.attachedEnergy.length >= retreatCost(state, me)
  ) {
    for (const b of p.bench) moves.push({ type: 'Retreat', benchUid: b.uid })
  }

  // Abilities
  for (const source of ourPokemon) {
    moves.push(...enumerateAbility(state, source, me))
  }

  // Attacks (affordable only). Attacking ends the turn.
  if (p.active && !isActionLocked(p.active)) {
    const card: PokemonCard = pokemonCard(p.active)
    card.attacks.forEach((atk, idx) => {
      if (canPayCost(p.active!.attachedEnergy, atk.cost)) {
        moves.push(...enumerateAttack(state, p.active!, me, idx))
      }
    })
  }

  // End turn
  moves.push({ type: 'EndTurn' })

  return moves
}
