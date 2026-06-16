import { describe, expect, it } from 'vitest'
import { makeContext } from '../../src/engine/effects/context'
import { attackHandlers } from '../../src/engine/effects/registry'
import {
  CASTFORM_SUNNY,
  CHIEN_PAO_EX,
  FROAKIE,
  FRIGIBAX,
  HEATMOR,
  HIKING_TRAIL,
  HYDREIGON,
  MAGNEZONE,
  MEGA_ABSOL_EX,
  MEGA_BLAZIKEN_EX,
  MIRAIDON_EX,
  PROFESSORS_RESEARCH,
  SUICUNE_EX,
} from '../../src/engine/data/ids'
import type { AttackMove } from '../../src/engine/effects/kinds'
import { game, mon, player } from '../helpers'

const attack = (i: number, extra: Partial<AttackMove> = {}): AttackMove => ({
  type: 'Attack',
  attackIndex: i,
  ...extra,
})

describe('attack effects', () => {
  it('Mega Burning discards a Fire Energy and Burns the opponent', () => {
    const attacker = mon(MEGA_BLAZIKEN_EX, { attachedEnergy: ['Fire', 'Fire'] })
    const s = game(player({ active: attacker }), player({ active: mon(FROAKIE) }))
    const ctx = makeContext(s, [], 0)
    attackHandlers[MEGA_BLAZIKEN_EX](ctx, attacker, 0, attack(0))
    expect(attacker.attachedEnergy).toEqual(['Fire'])
    expect(s.players[1].active!.status).toContain('burned')
  })

  it('Sunny Scorching only Burns while a Stadium is in play', () => {
    const attacker = mon(CASTFORM_SUNNY, { attachedEnergy: ['Fire'] })
    const noStadium = game(player({ active: attacker }), player({ active: mon(FROAKIE) }))
    attackHandlers[CASTFORM_SUNNY](makeContext(noStadium, [], 0), attacker, 0, attack(0))
    expect(noStadium.players[1].active!.status).not.toContain('burned')

    const withStadium = game(player({ active: attacker }), player({ active: mon(FROAKIE) }), {
      stadium: HIKING_TRAIL,
      stadiumOwner: 0,
    })
    attackHandlers[CASTFORM_SUNNY](makeContext(withStadium, [], 0), attacker, 0, attack(0))
    expect(withStadium.players[1].active!.status).toContain('burned')
  })

  it('Tongue Whip hits a chosen Benched Pokémon for 30 (no Weakness)', () => {
    const attacker = mon(HEATMOR, { attachedEnergy: ['Fire'] })
    const benched = mon(FRIGIBAX)
    const s = game(player({ active: attacker }), player({ active: mon(FROAKIE), bench: [benched] }))
    attackHandlers[HEATMOR](makeContext(s, [], 0), attacker, 0, attack(0, { targetUid: benched.uid }))
    expect(benched.damage).toBe(30)
  })

  it('Crystal Waltz adds 20 per Benched Pokémon (both sides)', () => {
    const attacker = mon(SUICUNE_EX, { attachedEnergy: ['Water', 'Water'] })
    const s = game(
      player({ active: attacker, bench: [mon(FROAKIE), mon(FRIGIBAX)] }),
      player({ active: mon(FROAKIE), bench: [mon(FRIGIBAX)] }),
    )
    attackHandlers[SUICUNE_EX](makeContext(s, [], 0), attacker, 0, attack(0))
    expect(s.players[1].active!.damage).toBe(60) // 20 × (2 + 1) bench; base handled by reducer
  })

  it('Diving Icicles discards all Water and does 130 (with Weakness vs the Active)', () => {
    const attacker = mon(CHIEN_PAO_EX, { attachedEnergy: ['Water', 'Water', 'Water'] })
    const defender = mon(MEGA_BLAZIKEN_EX) // weakness Water
    const s = game(player({ active: attacker }), player({ active: defender }))
    attackHandlers[CHIEN_PAO_EX](makeContext(s, [], 0), attacker, 1, attack(1, { targetUid: defender.uid }))
    expect(attacker.attachedEnergy).toEqual([])
    expect(defender.damage).toBe(150)
  })

  it('Diving Icicles applies no Weakness to a Benched target', () => {
    const attacker = mon(CHIEN_PAO_EX, { attachedEnergy: ['Water', 'Water', 'Water'] })
    const benched = mon(MEGA_BLAZIKEN_EX)
    const s = game(player({ active: attacker }), player({ active: mon(FROAKIE), bench: [benched] }))
    attackHandlers[CHIEN_PAO_EX](makeContext(s, [], 0), attacker, 1, attack(1, { targetUid: benched.uid }))
    expect(benched.damage).toBe(130)
  })

  it('Hyper Ray discards all Energy from itself', () => {
    const attacker = mon(HYDREIGON, { attachedEnergy: ['Darkness', 'Darkness', 'Darkness'] })
    const s = game(player({ active: attacker }), player({ active: mon(FROAKIE) }))
    attackHandlers[HYDREIGON](makeContext(s, [], 0), attacker, 0, attack(0))
    expect(attacker.attachedEnergy).toEqual([])
  })

  it('Hadron Ray adds 20 damage per Lightning Energy attached', () => {
    const attacker = mon(MIRAIDON_EX, { attachedEnergy: ['Lightning', 'Lightning', 'Colorless'] })
    const s = game(player({ active: attacker }), player({ active: mon(FROAKIE) }))
    attackHandlers[MIRAIDON_EX](makeContext(s, [], 0), attacker, 0, attack(0))
    expect(s.players[1].active!.damage).toBe(40) // 20 × 2 Lightning; base handled by reducer
  })

  it('Mirror Shot flags the opponent Active to flip before its next attack', () => {
    const attacker = mon(MAGNEZONE, { attachedEnergy: ['Lightning', 'Colorless', 'Colorless'] })
    const defender = mon(FROAKIE)
    const s = game(player({ active: attacker }), player({ active: defender }))
    attackHandlers[MAGNEZONE](makeContext(s, [], 0), attacker, 0, attack(0))
    expect(defender.mustFlipToAttack).toBe(true)
  })

  it('Darkness Claw reveals the hand and queues the Supporter discard', () => {
    const attacker = mon(MEGA_ABSOL_EX, { attachedEnergy: ['Darkness', 'Darkness'] })
    const s = game(
      player({ active: attacker }),
      player({ active: mon(FROAKIE), hand: [PROFESSORS_RESEARCH, FROAKIE] }),
    )
    attackHandlers[MEGA_ABSOL_EX](makeContext(s, [], 0), attacker, 0, attack(0))
    // The handler only queues the choice (the reducer discards once it's made).
    expect(s.pendingAttackChoice).toEqual({
      kind: 'discardFromOpponentHand',
      chooser: 0,
      cardIds: [PROFESSORS_RESEARCH], // only the Supporter, not Froakie
    })
    expect(s.players[1].hand).toContain(PROFESSORS_RESEARCH)
  })
})
