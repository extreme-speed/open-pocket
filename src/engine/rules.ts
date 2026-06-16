// Stateless rules helpers: card lookups, energy affordability, damage/weakness,
// retreat cost (with passive modifiers), KO detection, and point values.

import { getCard } from './data/cards'
import { BOMBIRDIER, GIANT_CAPE, INFLATABLE_BOAT } from './data/ids'
import type {
  EnergyType,
  GameState,
  InPlayPokemon,
  PlayerIndex,
  PlayerState,
  PokemonCard,
} from './types'

export function other(p: PlayerIndex): PlayerIndex {
  return p === 0 ? 1 : 0
}

export function pokemonCard(p: InPlayPokemon): PokemonCard {
  const card = getCard(p.cardId)
  if (card.kind !== 'pokemon') throw new Error(`In-play card ${p.cardId} is not a Pokémon`)
  return card
}

/** Every Pokémon a player has in play (Active first, then Bench). */
export function inPlay(player: PlayerState): InPlayPokemon[] {
  return player.active ? [player.active, ...player.bench] : [...player.bench]
}

/** Locate an in-play Pokémon by uid across both players. */
export function findByUid(
  state: GameState,
  uid: string,
): { pokemon: InPlayPokemon; owner: PlayerIndex } | null {
  for (const owner of [0, 1] as PlayerIndex[]) {
    for (const p of inPlay(state.players[owner])) {
      if (p.uid === uid) return { pokemon: p, owner }
    }
  }
  return null
}

/** Max HP including the Giant Cape tool's +20. */
export function maxHp(p: InPlayPokemon): number {
  const base = pokemonCard(p).hp
  return p.tool === GIANT_CAPE ? base + 20 : base
}

export function remainingHp(p: InPlayPokemon): number {
  return Math.max(0, maxHp(p) - p.damage)
}

export function isKnockedOut(p: InPlayPokemon): boolean {
  return p.damage >= maxHp(p)
}

/** KO point value: Mega-ex = 3, ex = 2, otherwise 1. */
export function pointsFor(p: InPlayPokemon): number {
  const card = pokemonCard(p)
  if (card.isMega) return 3
  if (card.isEx) return 2
  return 1
}

/** Weakness in Pocket is a flat +20 when the attacker's type matches. */
export function weaknessBonus(attacker: PokemonCard, defender: PokemonCard): number {
  return defender.weakness !== null && defender.weakness === attacker.energyType ? 20 : 0
}

/**
 * Can `energy` pay `cost`? Each specific (non-Colorless) type must be matched
 * exactly; Colorless is paid by any remaining energy.
 */
export function canPayCost(energy: readonly EnergyType[], cost: readonly EnergyType[]): boolean {
  const pool = new Map<EnergyType, number>()
  for (const e of energy) pool.set(e, (pool.get(e) ?? 0) + 1)

  let colorless = 0
  for (const need of cost) {
    if (need === 'Colorless') {
      colorless++
      continue
    }
    const have = pool.get(need) ?? 0
    if (have <= 0) return false
    pool.set(need, have - 1)
  }
  let remaining = 0
  for (const n of pool.values()) remaining += n
  return remaining >= colorless
}

/**
 * Effective retreat cost for a player's Active, after passive reductions:
 * Bombirdier (Villainous Delivery) and Inflatable Boat each shave 1 for the
 * matching energy type.
 */
export function retreatCost(state: GameState, playerIndex: PlayerIndex): number {
  const player = state.players[playerIndex]
  if (!player.active) return 0
  const card = pokemonCard(player.active)
  let cost = card.retreatCost

  const hasBombirdierBench = player.bench.some((b) => b.cardId === BOMBIRDIER)
  if (hasBombirdierBench && card.energyType === 'Darkness') cost -= 1

  if (player.active.tool === INFLATABLE_BOAT && card.energyType === 'Water') cost -= 1

  return Math.max(0, cost)
}

/** True if this Pokémon's special conditions block attacking/retreating. */
export function isActionLocked(p: InPlayPokemon): boolean {
  return p.status.includes('asleep') || p.status.includes('paralyzed')
}
