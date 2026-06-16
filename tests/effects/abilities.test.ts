import { describe, expect, it } from 'vitest'
import { makeContext } from '../../src/engine/effects/context'
import { activatedAbilities, endOfTurnAbilities } from '../../src/engine/effects/registry'
import {
  BAXCALIBUR,
  FRIGIBAX,
  FROAKIE,
  GRENINJA,
  HYDREIGON,
  MAGNEMITE,
  MAGNETON,
  MIRAIDON_EX,
  ROARING_MOON,
  SUICUNE_EX,
  TORCHIC,
  ZERAORA,
} from '../../src/engine/data/ids'
import type { AbilityMove } from '../../src/engine/effects/kinds'
import { game, mon, player } from '../helpers'

const useAbility = (sourceUid: string, targetUid?: string): AbilityMove => ({
  type: 'UseAbility',
  sourceUid,
  targetUid,
})

describe('ability effects', () => {
  it('Water Shuriken does 20 to a chosen Pokémon, once per turn', () => {
    const greninja = mon(GRENINJA)
    const target = mon(FROAKIE)
    const s = game(player({ active: greninja }), player({ active: target }))
    const ability = activatedAbilities[GRENINJA]

    expect(ability.enumerate(s, greninja, 0).length).toBe(1)
    ability.run(makeContext(s, [], 0), greninja, useAbility(greninja.uid, target.uid))
    expect(target.damage).toBe(20)
    expect(greninja.abilityUsedThisTurn).toBe(true)
    expect(ability.enumerate(s, greninja, 0).length).toBe(0)
  })

  it('Ice Maker attaches a Water Energy to a Water Active', () => {
    const bax = mon(BAXCALIBUR)
    const waterActive = mon(FRIGIBAX)
    const s = game(
      player({ registered: ['Water'], active: waterActive, bench: [bax] }),
      player({ active: mon(TORCHIC) }),
    )
    const ability = activatedAbilities[BAXCALIBUR]
    expect(ability.enumerate(s, bax, 0).length).toBe(1)
    ability.run(makeContext(s, [], 0), bax, useAbility(bax.uid))
    expect(waterActive.attachedEnergy).toContain('Water')

    // Unavailable when the Active is not a Water Pokémon.
    const noWater = game(
      player({ registered: ['Water'], active: mon(TORCHIC), bench: [mon(BAXCALIBUR)] }),
      player({ active: mon(TORCHIC) }),
    )
    expect(activatedAbilities[BAXCALIBUR].enumerate(noWater, noWater.players[0].bench[0], 0)).toHaveLength(0)
  })

  it('Roar in Unison attaches 2 Darkness to itself and deals 30 self-damage', () => {
    const hydreigon = mon(HYDREIGON)
    const s = game(player({ registered: ['Darkness'], active: hydreigon }), player({ active: mon(TORCHIC) }))
    activatedAbilities[HYDREIGON].run(makeContext(s, [], 0), hydreigon, useAbility(hydreigon.uid))
    expect(hydreigon.attachedEnergy).toEqual(['Darkness', 'Darkness'])
    expect(hydreigon.damage).toBe(30)
  })

  it('Ancient Roar switches the opponent Active out, only the turn it enters the Bench', () => {
    const roaring = mon(ROARING_MOON, { enteredBenchThisTurn: true })
    const foeActive = mon(TORCHIC)
    const foeBench = mon(FROAKIE)
    const s = game(
      player({ active: mon(FRIGIBAX), bench: [roaring] }),
      player({ active: foeActive, bench: [foeBench] }),
    )
    const ability = activatedAbilities[ROARING_MOON]
    expect(ability.enumerate(s, roaring, 0).length).toBe(1)
    ability.run(makeContext(s, [], 0), roaring, useAbility(roaring.uid, foeBench.uid))
    expect(s.players[1].active!.uid).toBe(foeBench.uid)
    expect(s.players[1].bench.map((b) => b.uid)).toContain(foeActive.uid)

    // Not available once the entering turn has passed.
    const settled = mon(ROARING_MOON, { enteredBenchThisTurn: false })
    const s2 = game(
      player({ active: mon(FRIGIBAX), bench: [settled] }),
      player({ active: mon(TORCHIC), bench: [mon(FROAKIE)] }),
    )
    expect(ability.enumerate(s2, settled, 0)).toHaveLength(0)
  })

  it('Volt Charge attaches a Lightning Energy to Magneton, once per turn', () => {
    const magneton = mon(MAGNETON)
    const s = game(
      player({ registered: ['Lightning'], active: magneton }),
      player({ active: mon(TORCHIC) }),
    )
    const ability = activatedAbilities[MAGNETON]
    expect(ability.enumerate(s, magneton, 0).length).toBe(1)
    ability.run(makeContext(s, [], 0), magneton, useAbility(magneton.uid))
    expect(magneton.attachedEnergy).toEqual(['Lightning'])
    expect(ability.enumerate(s, magneton, 0).length).toBe(0)
  })

  it('Legendary Drive swaps Miraidon into the Active Spot and gathers all your Energy', () => {
    const miraidon = mon(MIRAIDON_EX, { enteredBenchThisTurn: true })
    const oldActive = mon(ZERAORA, { attachedEnergy: ['Lightning', 'Lightning'] })
    const benched = mon(MAGNEMITE, { attachedEnergy: ['Lightning'] })
    const s = game(
      player({ active: oldActive, bench: [benched, miraidon] }),
      player({ active: mon(TORCHIC) }),
    )
    const ability = activatedAbilities[MIRAIDON_EX]
    expect(ability.enumerate(s, miraidon, 0).length).toBe(1)
    ability.run(makeContext(s, [], 0), miraidon, useAbility(miraidon.uid))
    expect(s.players[0].active!.uid).toBe(miraidon.uid)
    expect(miraidon.attachedEnergy).toEqual(['Lightning', 'Lightning', 'Lightning'])
    expect(oldActive.attachedEnergy).toEqual([])
    expect(benched.attachedEnergy).toEqual([])
    // Only the turn it enters the Bench.
    const settled = mon(MIRAIDON_EX, { enteredBenchThisTurn: false })
    const s2 = game(
      player({ active: mon(ZERAORA), bench: [settled] }),
      player({ active: mon(TORCHIC) }),
    )
    expect(ability.enumerate(s2, settled, 0)).toHaveLength(0)
  })

  it('Thunderclap Flash attaches a Lightning only at the end of the first turn', () => {
    const zeraora = mon(ZERAORA)
    const firstTurn = game(
      player({ registered: ['Lightning'], active: zeraora }),
      player({ active: mon(TORCHIC) }),
      { turn: 1, current: 0, firstPlayer: 0 },
    )
    endOfTurnAbilities[ZERAORA](makeContext(firstTurn, [], 0), zeraora)
    expect(zeraora.attachedEnergy).toEqual(['Lightning'])

    const z2 = mon(ZERAORA)
    const laterTurn = game(
      player({ registered: ['Lightning'], active: z2 }),
      player({ active: mon(TORCHIC) }),
      { turn: 3, current: 0, firstPlayer: 0 },
    )
    endOfTurnAbilities[ZERAORA](makeContext(laterTurn, [], 0), z2)
    expect(z2.attachedEnergy).toEqual([])
  })

  it('Legendary Pulse draws a card at end of turn only while Suicune is Active', () => {
    const suicune = mon(SUICUNE_EX)
    const active = game(
      player({ active: suicune, deck: [FROAKIE, TORCHIC] }),
      player({ active: mon(TORCHIC) }),
    )
    endOfTurnAbilities[SUICUNE_EX](makeContext(active, [], 0), suicune)
    expect(active.players[0].hand).toHaveLength(1)

    const benched = mon(SUICUNE_EX)
    const onBench = game(
      player({ active: mon(FROAKIE), bench: [benched], deck: [FROAKIE] }),
      player({ active: mon(TORCHIC) }),
    )
    endOfTurnAbilities[SUICUNE_EX](makeContext(onBench, [], 0), benched)
    expect(onBench.players[0].hand).toHaveLength(0)
  })
})
