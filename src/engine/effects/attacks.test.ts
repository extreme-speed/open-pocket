// Every non-vanilla attack handler, driven through the real reducer via apply().
// Attacking ends the turn, so each test gives the *next* player registered
// energy (beginTurn picks one and throws on an empty pool), and uses defenders
// with no matching Weakness + enough HP to survive (so we read clean damage).

import { describe, expect, it } from 'vitest'
import {
  CASTFORM_SUNNY,
  CHIEN_PAO_EX,
  CYRUS,
  HEATMOR,
  HIKING_TRAIL,
  HYDREIGON,
  MAGNEZONE,
  MEGA_ABSOL_EX,
  MEGA_BLAZIKEN_EX,
  MIRAIDON_EX,
  ROARING_MOON,
  SUICUNE_EX,
} from '../data/ids'
import { previewAttackDamage } from '../reducer'
import { HEADS, TAILS, baseDamage, byUid, game, mon, player, qty, run } from '../testkit'

// A roomy defender side: high-HP Active not weak to the attacker, plus registered
// energy so the opponent's automatic next turn can generate energy.
const defenderSide = (active = mon(MEGA_BLAZIKEN_EX), extra: Partial<Parameters<typeof player>[0]> = {}) =>
  player({ active, registeredEnergy: ['Lightning'], deck: ['B1 033'], ...extra })

describe('attack: Mega Burning (Mega Blaziken ex)', () => {
  it('discards one Fire from itself and Burns the opponent Active', () => {
    const attacker = mon(MEGA_BLAZIKEN_EX, { attachedEnergy: qty('Fire', 2) })
    // Defender Magnezone (Lightning, weak Fighting): no Weakness to Fire.
    const s = game(player({ active: attacker, registeredEnergy: ['Fire'] }), defenderSide(mon(MAGNEZONE)), {
      seed: TAILS, // burn check stays tails → Burn persists through the checkup
    })
    const after = run(s, { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[0].active!.attachedEnergy).toEqual(['Fire']) // 2 → 1
    expect(after.players[1].active!.status).toContain('burned')
    // 120 base + 20 from the immediate burn checkup tick.
    expect(after.players[1].active!.damage).toBe(baseDamage(MEGA_BLAZIKEN_EX) + 20)
  })
})

describe('attack: Sunny Scorching (Castform Sunny Form)', () => {
  const attack = (stadium: string | null) => {
    const s = game(
      player({ active: mon(CASTFORM_SUNNY), registeredEnergy: ['Fire'] }),
      defenderSide(mon(MAGNEZONE)),
      { stadium, stadiumOwner: stadium ? 0 : null, seed: TAILS },
    )
    return run(s, { type: 'Attack', attackIndex: 0 }).state
  }

  it('Burns the opponent Active when a Stadium is in play', () => {
    expect(attack(HIKING_TRAIL).players[1].active!.status).toContain('burned')
  })

  it('does not Burn when no Stadium is in play', () => {
    expect(attack(null).players[1].active!.status).not.toContain('burned')
  })
})

describe('attack: Tongue Whip (Heatmor)', () => {
  it('deals 30 to a chosen Benched Pokémon, not the Active', () => {
    const benched = mon(MAGNEZONE)
    const foe = defenderSide(mon(MEGA_BLAZIKEN_EX), { bench: [benched] })
    const s = game(player({ active: mon(HEATMOR) }), foe)
    const after = run(s, { type: 'Attack', attackIndex: 0, targetUid: benched.uid }).state
    expect(byUid(after, benched.uid)!.damage).toBe(30)
    expect(after.players[1].active!.damage).toBe(0) // Tongue Whip has 0 base
  })
})

describe('attack: Crystal Waltz (Suicune ex)', () => {
  it('adds 20 damage per Benched Pokémon on both sides', () => {
    const me = player({
      active: mon(SUICUNE_EX),
      bench: [mon(MAGNEZONE), mon(MAGNEZONE)],
      deck: ['B1 033'],
    })
    const foe = defenderSide(mon(MAGNEZONE), { bench: [mon(MAGNEZONE)] }) // 2 + 1 = 3 benched
    const after = run(game(me, foe), { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[1].active!.damage).toBe(baseDamage(SUICUNE_EX) + 20 * 3)
  })
})

describe('attack: Diving Icicles (Chien-Pao ex, attack #1)', () => {
  it('discards all Water from itself and deals 130 to a chosen target', () => {
    const attacker = mon(CHIEN_PAO_EX, { attachedEnergy: [...qty('Water', 3), 'Colorless'] })
    const target = mon(MEGA_BLAZIKEN_EX) // hp 210, weak Water — but it is Benched, so no Weakness
    const me = player({ active: attacker })
    const foe = defenderSide(mon(MAGNEZONE), { bench: [target] })
    const after = run(game(me, foe), { type: 'Attack', attackIndex: 1, targetUid: target.uid }).state
    expect(after.players[0].active!.attachedEnergy).toEqual(['Colorless']) // Water gone
    expect(byUid(after, target.uid)!.damage).toBe(130)
  })
})

describe('attack: Hyper Ray (Hydreigon)', () => {
  it('discards all energy from itself', () => {
    const attacker = mon(HYDREIGON, { attachedEnergy: [...qty('Darkness', 2), 'Colorless'] })
    const after = run(game(player({ active: attacker }), defenderSide()), {
      type: 'Attack',
      attackIndex: 0,
    }).state
    expect(after.players[0].active!.attachedEnergy).toEqual([])
    expect(after.players[1].active!.damage).toBe(baseDamage(HYDREIGON)) // 130, no Weakness
  })
})

describe('attack: Hadron Ray (Miraidon ex)', () => {
  it('adds 20 damage per Lightning Energy attached to itself', () => {
    const attacker = mon(MIRAIDON_EX, { attachedEnergy: qty('Lightning', 3) })
    const after = run(game(player({ active: attacker }), defenderSide()), {
      type: 'Attack',
      attackIndex: 0,
    }).state
    expect(after.players[1].active!.damage).toBe(baseDamage(MIRAIDON_EX) + 20 * 3)
  })
})

describe('attack: Mirror Shot (Magnezone)', () => {
  it('flags the opponent Active to flip-to-attack next turn', () => {
    const after = run(game(player({ active: mon(MAGNEZONE) }), defenderSide()), {
      type: 'Attack',
      attackIndex: 0,
    }).state
    // Cleared only for the current player's Pokémon at end of turn — the foe keeps it.
    expect(after.players[1].active!.mustFlipToAttack).toBe(true)
  })
})

describe('attack: Darkness Claw (Mega Absol ex)', () => {
  it('reveals the hand and parks the turn until a Supporter is chosen', () => {
    const foe = defenderSide(mon(MEGA_BLAZIKEN_EX), { hand: [CYRUS, 'B1 033'] })
    const start = game(player({ active: mon(MEGA_ABSOL_EX) }), foe)

    // Step 1: the attack hits but does not end the turn — it awaits the discard.
    const mid = run(start, { type: 'Attack', attackIndex: 0 }).state
    expect(mid.phase).toBe('awaitingAttackChoice')
    expect(mid.pendingAttackChoice).toEqual({
      kind: 'discardFromOpponentHand',
      chooser: 0,
      cardIds: [CYRUS], // only the Supporter, not the Torchic
    })
    expect(mid.players[1].hand).toContain(CYRUS) // not discarded yet

    // Step 2: choosing the Supporter discards it and ends the turn.
    const after = run(mid, { type: 'AttackChoice', cardId: CYRUS }).state
    expect(after.players[1].hand).not.toContain(CYRUS)
    expect(after.players[1].discard).toContain(CYRUS)
    expect(after.phase).toBe('main')
    expect(after.current).toBe(1) // turn passed to the opponent
  })

  it('ends the turn immediately when the opponent has no Supporter', () => {
    const foe = defenderSide(mon(MEGA_BLAZIKEN_EX), { hand: ['B1 033'] })
    const after = run(game(player({ active: mon(MEGA_ABSOL_EX) }), foe), {
      type: 'Attack',
      attackIndex: 0,
    }).state
    expect(after.phase).toBe('main')
    expect(after.current).toBe(1)
  })
})

describe('previewAttackDamage', () => {
  it('folds in Weakness against the opponent Active', () => {
    // Suicune ex (Water), no benched Pokémon, vs Mega Blaziken ex (weak Water).
    const me = player({ active: mon(SUICUNE_EX) })
    const foe = defenderSide(mon(MEGA_BLAZIKEN_EX))
    const preview = previewAttackDamage(game(me, foe), { type: 'Attack', attackIndex: 0 })
    expect(preview).toBe(baseDamage(SUICUNE_EX) + 20) // base + Weakness
  })

  it('folds in card bonuses (Crystal Waltz per-Bench)', () => {
    const me = player({ active: mon(SUICUNE_EX), bench: [mon(MAGNEZONE), mon(MAGNEZONE)] })
    const foe = defenderSide(mon(MAGNEZONE), { bench: [mon(MAGNEZONE)] }) // 2 + 1 = 3, no Weakness
    const preview = previewAttackDamage(game(me, foe), { type: 'Attack', attackIndex: 0 })
    expect(preview).toBe(baseDamage(SUICUNE_EX) + 20 * 3)
  })

  it('excludes follow-on effects like the Burn tick', () => {
    // Mega Burning Burns the defender; the +20 checkup tick is NOT attack damage.
    const me = player({ active: mon(MEGA_BLAZIKEN_EX, { attachedEnergy: qty('Fire', 2) }) })
    const foe = defenderSide(mon(MAGNEZONE)) // not Fire-weak
    const preview = previewAttackDamage(game(me, foe), { type: 'Attack', attackIndex: 0 })
    expect(preview).toBe(baseDamage(MEGA_BLAZIKEN_EX))
  })
})

describe('Mirror Shot timing: flip-to-attack consumption', () => {
  const attackWithFlag = (seed: number) => {
    const attacker = mon(ROARING_MOON, { mustFlipToAttack: true, attachedEnergy: qty('Darkness', 2) })
    // attacker (current player) is flagged; it tries to attack the opponent.
    const me = player({ active: attacker, registeredEnergy: ['Darkness'], deck: ['B1 033'] })
    const foe = defenderSide()
    return run(game(me, foe, { seed }), { type: 'Attack', attackIndex: 0 }).state
  }

  it('heads → the attack happens', () => {
    // ROARING_MOON Wind of Darkness = 70 to MEGA_BLAZIKEN_EX (no Weakness).
    expect(attackWithFlag(HEADS).players[1].active!.damage).toBe(70)
  })

  it('tails → the attack does not happen', () => {
    expect(attackWithFlag(TAILS).players[1].active!.damage).toBe(0)
  })
})
