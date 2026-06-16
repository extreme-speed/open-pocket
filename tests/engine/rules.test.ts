import { describe, expect, it } from 'vitest'
import { getCard } from '../../src/engine/data/cards'
import {
  BOMBIRDIER,
  CHIEN_PAO_EX,
  FRIGIBAX,
  GIANT_CAPE,
  INFLATABLE_BOAT,
  MEGA_ABSOL_EX,
  SUICUNE_EX,
  TORCHIC,
} from '../../src/engine/data/ids'
import {
  canPayCost,
  isKnockedOut,
  maxHp,
  pointsFor,
  retreatCost,
  weaknessBonus,
} from '../../src/engine/rules'
import type { PokemonCard } from '../../src/engine/types'
import { game, mon, player } from '../helpers'

const card = (id: string) => getCard(id) as PokemonCard

describe('rules', () => {
  it('matches energy costs with Colorless wildcards', () => {
    expect(canPayCost(['Fire'], ['Fire'])).toBe(true)
    expect(canPayCost(['Water'], ['Fire'])).toBe(false)
    expect(canPayCost(['Fire', 'Water'], ['Fire', 'Colorless'])).toBe(true)
    expect(canPayCost(['Fire'], ['Fire', 'Colorless'])).toBe(false)
    expect(canPayCost(['Water', 'Water', 'Water'], ['Water', 'Water', 'Water'])).toBe(true)
  })

  it('applies +20 Weakness when types match', () => {
    // Chien-Pao (Water) vs Frigibax (weakness Metal) → no bonus.
    expect(weaknessBonus(card(CHIEN_PAO_EX), card(FRIGIBAX))).toBe(0)
    // Chien-Pao (Water) vs Torchic (weakness Water) → +20.
    expect(weaknessBonus(card(CHIEN_PAO_EX), card(TORCHIC))).toBe(20)
  })

  it('awards points by rarity: normal 1, ex 2, Mega-ex 3', () => {
    expect(pointsFor(mon(TORCHIC))).toBe(1)
    expect(pointsFor(mon(SUICUNE_EX))).toBe(2)
    expect(pointsFor(mon(MEGA_ABSOL_EX))).toBe(3)
  })

  it('adds 20 HP for Giant Cape and detects KO at max HP', () => {
    const base = card(TORCHIC).hp
    expect(maxHp(mon(TORCHIC))).toBe(base)
    expect(maxHp(mon(TORCHIC, { tool: GIANT_CAPE }))).toBe(base + 20)
    expect(isKnockedOut(mon(TORCHIC, { damage: base }))).toBe(true)
    expect(isKnockedOut(mon(TORCHIC, { tool: GIANT_CAPE, damage: base }))).toBe(false)
  })

  it('reduces retreat cost via Bombirdier and Inflatable Boat', () => {
    // Bombirdier on Bench reduces a Darkness Active's retreat by 1 (Mega Absol: base 1 → 0).
    const dark = game(
      player({ active: mon(MEGA_ABSOL_EX), bench: [mon(BOMBIRDIER)] }),
      player({ active: mon(TORCHIC) }),
    )
    expect(retreatCost(dark, 0)).toBe(0)

    // Inflatable Boat on a Water Active reduces by 1 (Chien-Pao: base 1 → 0).
    const water = game(
      player({ active: mon(CHIEN_PAO_EX, { tool: INFLATABLE_BOAT }) }),
      player({ active: mon(TORCHIC) }),
    )
    expect(retreatCost(water, 0)).toBe(0)
  })
})
