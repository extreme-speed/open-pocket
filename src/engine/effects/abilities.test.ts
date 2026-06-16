// Every ability — activated (UseAbility) and end-of-turn (EndTurn) — through the
// real reducer. UseAbility does not end the turn, so those tests need no opponent
// energy; EndTurn does (beginTurn picks the next player's energy), so those set it.

import { describe, expect, it } from 'vitest'
import {
  BAXCALIBUR,
  GRENINJA,
  HYDREIGON,
  MAGNETON,
  MAGNEZONE,
  MEGA_BLAZIKEN_EX,
  MIRAIDON_EX,
  ROARING_MOON,
  SUICUNE_EX,
  ZERAORA,
} from '../data/ids'
import { byUid, game, mon, player, qty, run } from '../testkit'

describe('ability: Water Shuriken (Greninja)', () => {
  it('deals 20 to any one opponent Pokémon and is once-per-turn', () => {
    const greninja = mon(GRENINJA)
    const foeActive = mon(MEGA_BLAZIKEN_EX)
    const s = game(player({ active: greninja }), player({ active: foeActive }))
    const after = run(s, { type: 'UseAbility', sourceUid: greninja.uid, targetUid: foeActive.uid }).state
    expect(after.players[1].active!.damage).toBe(20)
    expect(after.players[0].active!.abilityUsedThisTurn).toBe(true)
  })
})

describe('ability: Ice Maker (Baxcalibur)', () => {
  it('attaches a Water Energy to the Water-type Active', () => {
    const bax = mon(BAXCALIBUR) // Water type
    const s = game(player({ active: bax, registeredEnergy: ['Water'] }), player())
    const after = run(s, { type: 'UseAbility', sourceUid: bax.uid }).state
    expect(after.players[0].active!.attachedEnergy).toEqual(['Water'])
  })

  it('is unavailable without Water registered (no-op via guard)', () => {
    const bax = mon(BAXCALIBUR)
    const s = game(player({ active: bax, registeredEnergy: ['Fire'] }), player())
    const after = run(s, { type: 'UseAbility', sourceUid: bax.uid }).state
    expect(after.players[0].active!.attachedEnergy).toEqual([])
  })
})

describe('ability: Roar in Unison (Hydreigon)', () => {
  it('attaches 2 Darkness to itself and self-inflicts 30', () => {
    const hydreigon = mon(HYDREIGON)
    const s = game(player({ active: hydreigon, registeredEnergy: ['Darkness'] }), player())
    const after = run(s, { type: 'UseAbility', sourceUid: hydreigon.uid }).state
    expect(after.players[0].active!.attachedEnergy).toEqual(['Darkness', 'Darkness'])
    expect(after.players[0].active!.damage).toBe(30)
  })
})

describe('ability: Ancient Roar (Roaring Moon)', () => {
  it('switches the opponent Active for a chosen Benched Pokémon', () => {
    const roar = mon(ROARING_MOON, { enteredBenchThisTurn: true })
    const foeActive = mon(MEGA_BLAZIKEN_EX)
    const foeBench = mon(MAGNEZONE)
    const me = player({ active: mon(MAGNEZONE), bench: [roar] })
    const foe = player({ active: foeActive, bench: [foeBench] })
    const after = run(game(me, foe), {
      type: 'UseAbility',
      sourceUid: roar.uid,
      targetUid: foeBench.uid,
    }).state
    expect(after.players[1].active!.uid).toBe(foeBench.uid)
    expect(after.players[1].bench.map((b) => b.uid)).toContain(foeActive.uid)
  })
})

describe('ability: Volt Charge (Magneton)', () => {
  it('attaches a Lightning Energy to itself (on the Bench)', () => {
    const magneton = mon(MAGNETON)
    const s = game(
      player({ active: mon(MAGNEZONE), bench: [magneton], registeredEnergy: ['Lightning'] }),
      player(),
    )
    const after = run(s, { type: 'UseAbility', sourceUid: magneton.uid }).state
    expect(byUid(after, magneton.uid)!.attachedEnergy).toEqual(['Lightning'])
  })
})

describe('ability: Legendary Drive (Miraidon ex)', () => {
  it('swaps into Active and gathers all your in-play Energy onto itself', () => {
    const miraidon = mon(MIRAIDON_EX, { enteredBenchThisTurn: true })
    const oldActive = mon(MAGNEZONE, { attachedEnergy: qty('Lightning', 2) })
    const otherBench = mon(MAGNETON, { attachedEnergy: ['Lightning'] })
    const me = player({ active: oldActive, bench: [miraidon, otherBench] })
    const after = run(game(me, player()), { type: 'UseAbility', sourceUid: miraidon.uid }).state
    expect(after.players[0].active!.uid).toBe(miraidon.uid)
    expect(after.players[0].active!.attachedEnergy).toHaveLength(3) // 2 + 1 gathered
    expect(byUid(after, oldActive.uid)!.attachedEnergy).toEqual([])
    expect(byUid(after, otherBench.uid)!.attachedEnergy).toEqual([])
  })
})

describe('end-of-turn ability: Legendary Pulse (Suicune ex)', () => {
  it('draws a card at the end of your turn while Suicune is Active', () => {
    const me = player({ active: mon(SUICUNE_EX), deck: ['B1 033'] })
    const foe = player({ registeredEnergy: ['Lightning'] }) // beginTurn picks energy
    const after = run(game(me, foe, { current: 0 }), { type: 'EndTurn' }).state
    expect(after.players[0].hand).toEqual(['B1 033'])
  })
})

describe('end-of-turn ability: Thunderclap Flash (Zeraora)', () => {
  const endFirstTurn = (turn: number) => {
    const zeraora = mon(ZERAORA)
    const me = player({ active: mon(MAGNEZONE), bench: [zeraora], registeredEnergy: ['Lightning'] })
    const foe = player({ registeredEnergy: ['Lightning'] })
    return run(game(me, foe, { current: 0, firstPlayer: 0, turn }), { type: 'EndTurn' }).state
  }

  it('attaches a Lightning at the end of your first turn', () => {
    const after = endFirstTurn(1)
    const zeraora = after.players[0].bench.find((b) => b.cardId === ZERAORA)!
    expect(zeraora.attachedEnergy).toEqual(['Lightning'])
  })

  it('does nothing on later turns', () => {
    const after = endFirstTurn(3)
    const zeraora = after.players[0].bench.find((b) => b.cardId === ZERAORA)!
    expect(zeraora.attachedEnergy).toEqual([])
  })
})
