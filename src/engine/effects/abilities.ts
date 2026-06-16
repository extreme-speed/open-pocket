// Pokémon abilities. Activated abilities expose `enumerate` (the legal UseAbility
// moves right now) and `run`. End-of-turn abilities run during the checkup.
// Passive abilities (Villainous Delivery) live in rules.ts, not here.

import { getCard } from '../data/cards'
import {
  BAXCALIBUR,
  GRENINJA,
  HYDREIGON,
  MAGNETON,
  MIRAIDON_EX,
  ROARING_MOON,
  SUICUNE_EX,
  ZERAORA,
} from '../data/ids'
import { findByUid, inPlay, other } from '../rules'
import type { EnergyType, GameState, InPlayPokemon, Move, PlayerIndex } from '../types'
import type { ActivatedAbility, CheckupAbility, EndOfTurnAbility } from './kinds'

export const activatedAbilities: Record<string, ActivatedAbility> = {
  // Water Shuriken: once per turn, 20 to any one of the opponent's Pokémon.
  [GRENINJA]: {
    enumerate(state, source, owner) {
      if (source.abilityUsedThisTurn) return []
      return inPlay(state.players[other(owner)]).map(
        (t): Move => ({ type: 'UseAbility', sourceUid: source.uid, targetUid: t.uid }),
      )
    },
    run(ctx, source, move) {
      const f = move.targetUid ? findByUid(ctx.state, move.targetUid) : null
      if (f) ctx.dealDamage(f.pokemon, 20)
      source.abilityUsedThisTurn = true
    },
  },

  // Ice Maker: once per turn, attach a Water Energy to the Active (if it's Water).
  [BAXCALIBUR]: {
    enumerate(state, source, owner) {
      if (source.abilityUsedThisTurn) return []
      const p = state.players[owner]
      if (!p.active) return []
      const active = getCard(p.active.cardId)
      if (active.kind !== 'pokemon' || active.energyType !== 'Water') return []
      if (!p.registeredEnergy.includes('Water')) return []
      return [{ type: 'UseAbility', sourceUid: source.uid }]
    },
    run(ctx, source) {
      if (ctx.self.active) ctx.attachEnergy(ctx.self.active, 'Water', 1)
      source.abilityUsedThisTurn = true
    },
  },

  // Roar in Unison: once per turn, attach 2 Darkness to self and take 30 damage.
  [HYDREIGON]: {
    enumerate(state, source, owner) {
      if (source.abilityUsedThisTurn) return []
      if (!state.players[owner].registeredEnergy.includes('Darkness')) return []
      return [{ type: 'UseAbility', sourceUid: source.uid }]
    },
    run(ctx, source) {
      ctx.attachEnergy(source, 'Darkness', 2)
      ctx.dealDamage(source, 30)
      source.abilityUsedThisTurn = true
    },
  },

  // Ancient Roar: the turn this enters the Bench, switch the opponent's Active out
  // (the new Active is one of their Bench).
  [ROARING_MOON]: {
    enumerate(state, source, owner) {
      if (source.abilityUsedThisTurn || !source.enteredBenchThisTurn) return []
      const foe = state.players[other(owner)]
      if (!foe.active || foe.bench.length === 0) return []
      return foe.bench.map(
        (b): Move => ({ type: 'UseAbility', sourceUid: source.uid, targetUid: b.uid }),
      )
    },
    run(ctx, source, move) {
      const foe = ctx.foe
      if (!foe.active || !move.targetUid) return
      const idx = foe.bench.findIndex((b) => b.uid === move.targetUid)
      if (idx < 0) return
      const newActive = foe.bench[idx]
      foe.bench.splice(idx, 1)
      foe.active.status = [] // leaving the Active Spot clears Special Conditions
      foe.bench.push(foe.active)
      foe.active = newActive
      source.abilityUsedThisTurn = true
    },
  },

  // Volt Charge: once per turn, attach a Lightning Energy to this Pokémon
  // (wherever it is — Active or Bench).
  [MAGNETON]: {
    enumerate(state, source, owner) {
      if (source.abilityUsedThisTurn) return []
      if (!state.players[owner].registeredEnergy.includes('Lightning')) return []
      return [{ type: 'UseAbility', sourceUid: source.uid }]
    },
    run(ctx, source) {
      ctx.attachEnergy(source, 'Lightning', 1)
      source.abilityUsedThisTurn = true
    },
  },

  // Legendary Drive: the turn this is put on the Bench from hand, you may switch
  // it into the Active Spot and move ALL your in-play Energy onto it.
  [MIRAIDON_EX]: {
    enumerate(state, source, owner) {
      if (source.abilityUsedThisTurn || !source.enteredBenchThisTurn) return []
      const p = state.players[owner]
      if (!p.active || !p.bench.some((b) => b.uid === source.uid)) return []
      return [{ type: 'UseAbility', sourceUid: source.uid }]
    },
    run(ctx, source) {
      const p = ctx.self
      const idx = p.bench.findIndex((b) => b.uid === source.uid)
      if (!p.active || idx < 0) return
      // Swap source (Bench) with the current Active.
      p.bench.splice(idx, 1)
      p.active.status = [] // leaving the Active Spot clears Special Conditions
      p.bench.push(p.active)
      p.active = source
      // Move all of your Energy in play onto Miraidon.
      const gathered: EnergyType[] = []
      for (const pk of inPlay(p)) {
        if (pk === source) continue
        gathered.push(...pk.attachedEnergy)
        pk.attachedEnergy = []
      }
      for (const e of gathered) ctx.attachEnergy(source, e, 1)
      source.abilityUsedThisTurn = true
    },
  },
}

export const endOfTurnAbilities: Record<string, EndOfTurnAbility> = {
  // Legendary Pulse: at the end of your turn, if Suicune is Active, draw a card.
  [SUICUNE_EX]: (ctx, source) => {
    if (ctx.self.active === source) ctx.draw(ctx.me, 1)
  },

  // Thunderclap Flash: at the end of YOUR FIRST turn, attach a Lightning Energy
  // to this Pokémon (wherever it is).
  [ZERAORA]: (ctx, source) => {
    const s = ctx.state
    const myFirstTurn = ctx.me === s.firstPlayer ? 1 : 2
    if (s.turn !== myFirstTurn) return
    if (!ctx.self.registeredEnergy.includes('Lightning')) return
    ctx.attachEnergy(source, 'Lightning', 1)
  },
}

/**
 * Abilities that resolve during the between-turns Pokémon Checkup, for BOTH
 * players. Register an entry here for "during Pokémon Checkup" effects (e.g.
 * heal/poison-on-checkup). No card in the current pool has one; this is the
 * wired-in extension point so the checkup actively looks for them.
 */
export const checkupAbilities: Record<string, CheckupAbility> = {}

/** True if this in-play Pokémon has an activated ability with a legal move now. */
export function hasActivatableAbility(
  state: GameState,
  source: InPlayPokemon,
  owner: PlayerIndex,
): boolean {
  const ability = activatedAbilities[source.cardId]
  return ability ? ability.enumerate(state, source, owner).length > 0 : false
}
