// Core rules and the cards whose effect lives outside the effect handlers:
// Tools (Rocky Helmet, Giant Cape, Inflatable Boat), the Hiking Trail Stadium,
// Rare Candy, Weakness, the special-condition checkup, and KO/points/replacement.

import { describe, expect, it } from 'vitest'
import { getCard } from './data/cards'
import {
  BOMBIRDIER,
  GIANT_CAPE,
  HIKING_TRAIL,
  HYDREIGON,
  INFLATABLE_BOAT,
  MAGNEMITE,
  MAGNETON,
  MAGNEZONE,
  MEGA_BLAZIKEN_EX,
  RARE_CANDY,
  ROCKY_HELMET,
  SUICUNE_EX,
} from './data/ids'
import { isKnockedOut, maxHp, pointsFor, retreatCost } from './rules'
import { HEADS, TAILS, baseDamage, game, mon, player, run } from './testkit'
import type { PokemonCard, Status } from './types'

// A high-HP, no-status opponent that survives so beginTurn (after a turn-ending
// attack) has energy to generate and we read clean post-attack state.
const oppSide = () => player({ active: mon(MEGA_BLAZIKEN_EX), registeredEnergy: ['Lightning'] })

describe('Weakness', () => {
  it('adds a flat +20 when the attacker type matches the Active defender weakness', () => {
    // Magneton (Lightning, Spinning Attack 60) vs Suicune ex (weak Lightning).
    const me = player({ active: mon(MAGNETON) })
    const foe = player({ active: mon(SUICUNE_EX), registeredEnergy: ['Water'] })
    const after = run(game(me, foe), { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[1].active!.damage).toBe(baseDamage(MAGNETON) + 20)
  })

  it('adds nothing when the type does not match', () => {
    const me = player({ active: mon(MAGNETON) })
    const foe = oppSide() // Mega Blaziken is weak to Water, not Lightning
    const after = run(game(me, foe), { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[1].active!.damage).toBe(baseDamage(MAGNETON))
  })
})

describe('Tool: Rocky Helmet', () => {
  it('deals 20 back to an attacker that damages the holder', () => {
    const me = player({ active: mon(MAGNETON) })
    const foe = player({ active: mon(MEGA_BLAZIKEN_EX, { tool: ROCKY_HELMET }), registeredEnergy: ['Fire'] })
    const after = run(game(me, foe), { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[0].active!.damage).toBe(20)
  })
})

describe('Tool: Giant Cape', () => {
  it('raises max HP by 20', () => {
    const base = (getCard(MAGNEMITE) as PokemonCard).hp
    expect(maxHp(mon(MAGNEMITE))).toBe(base)
    expect(maxHp(mon(MAGNEMITE, { tool: GIANT_CAPE }))).toBe(base + 20)
  })

  it('keeps the holder alive at damage that would otherwise KO it', () => {
    const base = (getCard(MAGNEMITE) as PokemonCard).hp
    expect(isKnockedOut(mon(MAGNEMITE, { damage: base }))).toBe(true)
    expect(isKnockedOut(mon(MAGNEMITE, { tool: GIANT_CAPE, damage: base }))).toBe(false)
  })
})

describe('Tool: Inflatable Boat', () => {
  it('shaves 1 retreat from a Water Active', () => {
    const base = (getCard(SUICUNE_EX) as PokemonCard).retreatCost
    const withBoat = game(player({ active: mon(SUICUNE_EX, { tool: INFLATABLE_BOAT }) }), player())
    expect(retreatCost(withBoat, 0)).toBe(base - 1)
  })
})

describe('Passive: Bombirdier (Villainous Delivery)', () => {
  it('shaves 1 retreat from a Darkness Active while Benched', () => {
    const base = (getCard(HYDREIGON) as PokemonCard).retreatCost
    const s = game(player({ active: mon(HYDREIGON), bench: [mon(BOMBIRDIER)] }), player())
    expect(retreatCost(s, 0)).toBe(base - 1)
  })
})

describe('Stadium: Hiking Trail', () => {
  it('draws the player ending their turn up to 3 cards', () => {
    const me = player({ active: mon(MAGNEZONE), hand: [], deck: ['a', 'b', 'c', 'd'] })
    const foe = player({ active: mon(MAGNEZONE), registeredEnergy: ['Lightning'] })
    const after = run(game(me, foe, { stadium: HIKING_TRAIL, stadiumOwner: 0 }), { type: 'EndTurn' }).state
    expect(after.players[0].hand).toHaveLength(3)
  })
})

describe('Rare Candy', () => {
  it('evolves a Basic straight to its Stage 2', () => {
    const basic = mon(MAGNEMITE)
    const me = player({ active: basic, hand: [RARE_CANDY, MAGNEZONE] })
    const after = run(game(me, player()), {
      type: 'RareCandyEvolve',
      candyId: RARE_CANDY,
      cardId: MAGNEZONE,
      targetUid: basic.uid,
    }).state
    expect(after.players[0].active!.cardId).toBe(MAGNEZONE)
    expect(after.players[0].active!.stack).toEqual([MAGNEMITE, MAGNEZONE])
    expect(after.players[0].discard).toContain(RARE_CANDY)
  })
})

describe('Special-condition checkup', () => {
  const endTurnWith = (status: Status[], seed = 1) => {
    const me = player({ active: mon(MEGA_BLAZIKEN_EX, { status }), deck: ['a'] })
    const foe = player({ active: mon(MAGNEZONE), registeredEnergy: ['Lightning'] })
    return run(game(me, foe, { seed }), { type: 'EndTurn' }).state
  }

  it('Poison deals 10 (no flip)', () => {
    expect(endTurnWith(['poisoned']).players[0].active!.damage).toBe(10)
  })

  it('Burn deals 20, then a tails flip leaves it Burned', () => {
    const after = endTurnWith(['burned'], TAILS)
    expect(after.players[0].active!.damage).toBe(20)
    expect(after.players[0].active!.status).toContain('burned')
  })

  it('Burn deals 20, then a heads flip clears it', () => {
    const after = endTurnWith(['burned'], HEADS)
    expect(after.players[0].active!.damage).toBe(20)
    expect(after.players[0].active!.status).not.toContain('burned')
  })

  it('Asleep wakes on heads, stays on tails', () => {
    expect(endTurnWith(['asleep'], HEADS).players[0].active!.status).not.toContain('asleep')
    expect(endTurnWith(['asleep'], TAILS).players[0].active!.status).toContain('asleep')
  })

  it('Paralysis recovers at the end of its own controller turn', () => {
    expect(endTurnWith(['paralyzed']).players[0].active!.status).not.toContain('paralyzed')
  })
})

describe('KO, points, and replacement', () => {
  it('a KO scores a point, empties the Active Spot, and queues a replacement', () => {
    // Magneton (Lightning, 60) + Weakness (+20) = 80 ≥ Magnemite 50 → KO.
    const me = player({ active: mon(MAGNETON) })
    const bench = mon(MAGNEZONE)
    const foe = player({ active: mon(MAGNEMITE), bench: [bench], registeredEnergy: ['Lightning'] })
    const koed = run(game(me, foe), { type: 'Attack', attackIndex: 0 }).state

    expect(koed.players[0].points).toBe(1)
    expect(koed.phase).toBe('awaitingKOReplacement')
    expect(koed.players[1].active).toBeNull()

    // Promote the Benched Pokémon; play resumes.
    const resumed = run(koed, { type: 'KOReplace', benchUid: bench.uid }).state
    expect(resumed.players[1].active!.uid).toBe(bench.uid)
    expect(resumed.phase).toBe('main')
  })

  it('point value scales: Mega = 3, ex = 2, otherwise 1', () => {
    expect(pointsFor(mon(MEGA_BLAZIKEN_EX))).toBe(3) // Mega
    expect(pointsFor(mon(SUICUNE_EX))).toBe(2) // ex
    expect(pointsFor(mon(MAGNEMITE))).toBe(1) // basic
  })
})
