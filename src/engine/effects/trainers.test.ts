// Every Item and Supporter handler, through the real reducer. Trainers do not end
// the turn, so no opponent energy is needed. The reducer removes the played card
// from hand before run() and discards it after (unless the handler keeps it), so
// each test also confirms the card lands where it should.

import { describe, expect, it } from 'vitest'
import {
  COPYCAT,
  CYRUS,
  FIELD_BLOWER,
  FLAME_PATCH,
  FROAKIE,
  HIKING_TRAIL,
  JULIANA,
  LISIA,
  LUCKY_ICE_POP,
  MAGNEMITE,
  MAGNEZONE,
  MEGA_BLAZIKEN_EX,
  MIRAIDON_EX,
  POKE_BALL,
  POKEMON_CENTER_LADY,
  PROFESSOR_TURO,
  PROFESSORS_RESEARCH,
  ROCKY_HELMET,
  SABRINA,
} from '../data/ids'
import { legalMoves } from '../moves'
import { HEADS, TAILS, byUid, game, mon, player, run } from '../testkit'
import type { Move } from '../types'

describe("supporter: Professor's Research", () => {
  it('draws 2 cards', () => {
    const me = player({ hand: [PROFESSORS_RESEARCH], deck: ['a', 'b'] })
    const after = run(game(me, player()), { type: 'PlaySupporter', cardId: PROFESSORS_RESEARCH }).state
    expect(after.players[0].hand).toEqual(['a', 'b'])
    expect(after.players[0].discard).toContain(PROFESSORS_RESEARCH)
  })
})

describe('supporter: Copycat', () => {
  it('shuffles your hand away and draws equal to the opponent hand size', () => {
    const me = player({ hand: [COPYCAT, 'x', 'y'], deck: ['d1', 'd2'] })
    const foe = player({ hand: ['f1', 'f2', 'f3', 'f4'] })
    const after = run(game(me, foe), { type: 'PlaySupporter', cardId: COPYCAT }).state
    expect(after.players[0].hand).toHaveLength(4) // == opponent hand size
    expect(after.players[0].discard).toContain(COPYCAT)
  })
})

describe('supporter: Cyrus', () => {
  it('pulls a damaged Benched opponent into the Active Spot', () => {
    const foeActive = mon(MEGA_BLAZIKEN_EX)
    const foeBench = mon(MAGNEZONE, { damage: 30 })
    const me = player({ hand: [CYRUS] })
    const foe = player({ active: foeActive, bench: [foeBench] })
    const after = run(game(me, foe), { type: 'PlaySupporter', cardId: CYRUS, targetUid: foeBench.uid }).state
    expect(after.players[1].active!.uid).toBe(foeBench.uid)
    expect(after.players[1].bench.map((b) => b.uid)).toContain(foeActive.uid)
  })
})

describe('supporter: Juliana', () => {
  it('pulls a Stage 2 from the deck into hand', () => {
    const me = player({ hand: [JULIANA], deck: [MAGNEZONE] })
    const after = run(game(me, player()), { type: 'PlaySupporter', cardId: JULIANA }).state
    expect(after.players[0].hand).toContain(MAGNEZONE)
    expect(after.players[0].deck).not.toContain(MAGNEZONE)
  })

  it('whiffs (only discards) when the deck has no Stage 2', () => {
    const me = player({ hand: [JULIANA], deck: [FROAKIE] })
    const after = run(game(me, player()), { type: 'PlaySupporter', cardId: JULIANA }).state
    expect(after.players[0].deck).toEqual([FROAKIE])
    expect(after.players[0].discard).toContain(JULIANA)
  })
})

describe('supporter: Pokémon Center Lady', () => {
  it('heals 30 and clears all Special Conditions on a chosen Pokémon', () => {
    const target = mon(MEGA_BLAZIKEN_EX, { damage: 50, status: ['burned', 'poisoned'] })
    const me = player({ active: target, hand: [POKEMON_CENTER_LADY] })
    const after = run(game(me, player()), {
      type: 'PlaySupporter',
      cardId: POKEMON_CENTER_LADY,
      targetUid: target.uid,
    }).state
    expect(after.players[0].active!.damage).toBe(20)
    expect(after.players[0].active!.status).toEqual([])
  })
})

describe('supporter: Lisia', () => {
  it('pulls up to 2 Basics with HP ≤ 50 from the deck', () => {
    const me = player({ hand: [LISIA], deck: [MAGNEMITE, MAGNEMITE] }) // only Magnemite qualifies
    const after = run(game(me, player()), { type: 'PlaySupporter', cardId: LISIA }).state
    expect(after.players[0].hand.filter((c) => c === MAGNEMITE)).toHaveLength(2)
    expect(after.players[0].deck).toEqual([])
  })
})

describe('supporter: Professor Turo', () => {
  it('shuffles a Future Pokémon in play back into the deck', () => {
    const miraidon = mon(MIRAIDON_EX)
    const me = player({ active: mon(MAGNEZONE), bench: [miraidon], hand: [PROFESSOR_TURO], deck: [] })
    const after = run(game(me, player()), {
      type: 'PlaySupporter',
      cardId: PROFESSOR_TURO,
      targetUid: miraidon.uid,
    }).state
    expect(after.players[0].bench).toHaveLength(0)
    expect(after.players[0].deck).toContain(MIRAIDON_EX)
  })
})

describe('supporter: Sabrina', () => {
  it('benches the opponent Active and queues their replacement choice', () => {
    const foeActive = mon(MEGA_BLAZIKEN_EX)
    const foe = player({ active: foeActive, bench: [mon(MAGNEZONE)] })
    const me = player({ active: mon(MAGNEZONE), hand: [SABRINA] })
    const after = run(game(me, foe), { type: 'PlaySupporter', cardId: SABRINA }).state
    expect(after.phase).toBe('awaitingKOReplacement')
    expect(after.koReplacements).toEqual([1])
    expect(after.players[1].active).toBeNull()
    expect(after.players[1].bench.map((b) => b.uid)).toContain(foeActive.uid)
  })
})

describe('item: Flame Patch', () => {
  it('moves a Fire Energy from the discard pile onto your Active Fire Pokémon', () => {
    const me = player({ active: mon(MEGA_BLAZIKEN_EX), hand: [FLAME_PATCH], discardedEnergy: ['Fire'] })
    const after = run(game(me, player()), { type: 'PlayItem', cardId: FLAME_PATCH }).state
    expect(after.players[0].active!.attachedEnergy).toEqual(['Fire'])
    expect(after.players[0].discardedEnergy).toEqual([])
  })

  it('is not playable when no Fire Energy is in the discard pile', () => {
    const me = player({ active: mon(MEGA_BLAZIKEN_EX), hand: [FLAME_PATCH] })
    const moves = legalMoves(game(me, player()))
    expect(moves.some((m) => m.type === 'PlayItem' && m.cardId === FLAME_PATCH)).toBe(false)
  })
})

describe('item: Poké Ball', () => {
  it('pulls a random Basic from the deck into hand', () => {
    const me = player({ hand: [POKE_BALL], deck: [FROAKIE] })
    const after = run(game(me, player()), { type: 'PlayItem', cardId: POKE_BALL }).state
    expect(after.players[0].hand).toContain(FROAKIE)
    expect(after.players[0].deck).toEqual([])
  })
})

describe('item: Lucky Ice Pop', () => {
  const play = (seed: number) => {
    const me = player({ active: mon(MEGA_BLAZIKEN_EX, { damage: 30 }), hand: [LUCKY_ICE_POP] })
    return run(game(me, player(), { seed }), { type: 'PlayItem', cardId: LUCKY_ICE_POP }).state
  }

  it('heals 20; heads keeps the card in hand', () => {
    const after = play(HEADS)
    expect(after.players[0].active!.damage).toBe(10)
    expect(after.players[0].hand).toContain(LUCKY_ICE_POP)
  })

  it('heals 20; tails discards the card', () => {
    const after = play(TAILS)
    expect(after.players[0].active!.damage).toBe(10)
    expect(after.players[0].hand).not.toContain(LUCKY_ICE_POP)
    expect(after.players[0].discard).toContain(LUCKY_ICE_POP)
  })
})

describe('item: Field Blower', () => {
  it('discards a Pokémon Tool', () => {
    const foeActive = mon(MEGA_BLAZIKEN_EX, { tool: ROCKY_HELMET })
    const move: Move = { type: 'PlayItem', cardId: FIELD_BLOWER, fieldBlower: { kind: 'tool', uid: foeActive.uid } }
    const after = run(game(player({ hand: [FIELD_BLOWER] }), player({ active: foeActive })), move).state
    expect(byUid(after, foeActive.uid)!.tool).toBeNull()
    expect(after.players[1].discard).toContain(ROCKY_HELMET)
  })

  it('discards the Stadium', () => {
    const move: Move = { type: 'PlayItem', cardId: FIELD_BLOWER, fieldBlower: { kind: 'stadium' } }
    const s = game(player({ hand: [FIELD_BLOWER] }), player(), { stadium: HIKING_TRAIL, stadiumOwner: 1 })
    const after = run(s, move).state
    expect(after.stadium).toBeNull()
    expect(after.players[1].discard).toContain(HIKING_TRAIL)
  })
})
