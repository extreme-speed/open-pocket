import { describe, expect, it } from 'vitest'
import { makeContext } from '../../src/engine/effects/context'
import { trainers } from '../../src/engine/effects/registry'
import {
  COPYCAT,
  CYRUS,
  FIELD_BLOWER,
  FLAME_PATCH,
  FROAKIE,
  GIANT_CAPE,
  GRENINJA,
  HIKING_TRAIL,
  JULIANA,
  LISIA,
  LUCKY_ICE_POP,
  MAGNEMITE,
  MAGNETON,
  MIRAIDON_EX,
  POKE_BALL,
  POKEMON_CENTER_LADY,
  PROFESSOR_TURO,
  PROFESSORS_RESEARCH,
  SABRINA,
  TORCHIC,
} from '../../src/engine/data/ids'
import type { TrainerMove } from '../../src/engine/effects/kinds'
import { game, mon, player } from '../helpers'

describe('trainer effects', () => {
  it("Professor's Research draws 2", () => {
    const s = game(
      player({ active: mon(TORCHIC), deck: [FROAKIE, TORCHIC, FROAKIE] }),
      player({ active: mon(FROAKIE) }),
    )
    trainers[PROFESSORS_RESEARCH].run(makeContext(s, [], 0), {
      type: 'PlaySupporter',
      cardId: PROFESSORS_RESEARCH,
    })
    expect(s.players[0].hand).toHaveLength(2)
    expect(s.players[0].deck).toHaveLength(1)
  })

  it('Copycat draws cards equal to the opponent hand size', () => {
    const s = game(
      player({ active: mon(TORCHIC), hand: ['x', 'y'], deck: [FROAKIE, FROAKIE, TORCHIC, TORCHIC] }),
      player({ active: mon(FROAKIE), hand: [TORCHIC, FROAKIE, TORCHIC] }),
    )
    trainers[COPYCAT].run(makeContext(s, [], 0), { type: 'PlaySupporter', cardId: COPYCAT })
    expect(s.players[0].hand).toHaveLength(3) // opponent had 3
  })

  it('Cyrus drags a damaged Benched opponent into the Active Spot', () => {
    const foeActive = mon(FROAKIE)
    const damaged = mon(TORCHIC, { damage: 20 })
    const s = game(
      player({ active: mon(TORCHIC) }),
      player({ active: foeActive, bench: [damaged] }),
    )
    trainers[CYRUS].run(makeContext(s, [], 0), { type: 'PlaySupporter', cardId: CYRUS, targetUid: damaged.uid })
    expect(s.players[1].active!.uid).toBe(damaged.uid)
    expect(s.players[1].bench.map((b) => b.uid)).toContain(foeActive.uid)
  })

  it('Juliana fetches a random Stage 2 from the deck', () => {
    const s = game(
      player({ active: mon(TORCHIC), deck: [FROAKIE, GRENINJA, TORCHIC] }),
      player({ active: mon(FROAKIE) }),
    )
    trainers[JULIANA].run(makeContext(s, [], 0), { type: 'PlaySupporter', cardId: JULIANA })
    expect(s.players[0].hand).toContain(GRENINJA)
    expect(s.players[0].deck).not.toContain(GRENINJA)
  })

  it('Juliana is playable regardless of deck contents (matches deckgym)', () => {
    // No Stage 2 in deck, and even an empty deck: still playable, it just whiffs.
    const noStage2 = game(
      player({ active: mon(TORCHIC), deck: [FROAKIE] }),
      player({ active: mon(FROAKIE) }),
    )
    expect(trainers[JULIANA].playable(noStage2, 0)).toBe(true)

    const emptyDeck = game(player({ active: mon(TORCHIC), deck: [] }), player({ active: mon(FROAKIE) }))
    expect(trainers[JULIANA].playable(emptyDeck, 0)).toBe(true)
  })

  it('Pokémon Center Lady heals 30 and clears Special Conditions', () => {
    const target = mon(TORCHIC, { damage: 40, status: ['burned'] })
    const s = game(player({ active: target }), player({ active: mon(FROAKIE) }))
    trainers[POKEMON_CENTER_LADY].run(makeContext(s, [], 0), {
      type: 'PlaySupporter',
      cardId: POKEMON_CENTER_LADY,
      targetUid: target.uid,
    })
    expect(target.damage).toBe(10)
    expect(target.status).toEqual([])
  })

  it('Flame Patch moves a discarded Fire Energy to a Fire Active', () => {
    const fire = mon(TORCHIC)
    const s = game(
      player({ active: fire, discardedEnergy: ['Fire'] }),
      player({ active: mon(FROAKIE) }),
    )
    expect(trainers[FLAME_PATCH].playable(s, 0)).toBe(true)
    trainers[FLAME_PATCH].run(makeContext(s, [], 0), { type: 'PlayItem', cardId: FLAME_PATCH })
    expect(fire.attachedEnergy).toContain('Fire')
    expect(s.players[0].discardedEnergy).toEqual([])
  })

  it('Flame Patch is unplayable without a discarded Fire Energy', () => {
    const s = game(player({ active: mon(TORCHIC) }), player({ active: mon(FROAKIE) }))
    expect(trainers[FLAME_PATCH].playable(s, 0)).toBe(false)
  })

  it('Poké Ball fetches a random Basic from the deck', () => {
    const s = game(
      player({ active: mon(TORCHIC), deck: [GRENINJA, FROAKIE] }),
      player({ active: mon(FROAKIE) }),
    )
    trainers[POKE_BALL].run(makeContext(s, [], 0), { type: 'PlayItem', cardId: POKE_BALL })
    expect(s.players[0].hand).toContain(FROAKIE) // only Basic in the deck
  })

  it('Poké Ball is playable regardless of deck contents (matches deckgym)', () => {
    // No Basic in deck, and even an empty deck: still playable, it just whiffs.
    const noBasic = game(
      player({ active: mon(TORCHIC), deck: [GRENINJA] }),
      player({ active: mon(FROAKIE) }),
    )
    expect(trainers[POKE_BALL].playable(noBasic, 0)).toBe(true)

    const emptyDeck = game(player({ active: mon(TORCHIC), deck: [] }), player({ active: mon(FROAKIE) }))
    expect(trainers[POKE_BALL].playable(emptyDeck, 0)).toBe(true)
  })

  it('Poké Ball with no Basic in the deck draws nothing', () => {
    const s = game(
      player({ active: mon(TORCHIC), deck: [GRENINJA] }), // Greninja is not Basic
      player({ active: mon(FROAKIE) }),
    )
    trainers[POKE_BALL].run(makeContext(s, [], 0), { type: 'PlayItem', cardId: POKE_BALL })
    expect(s.players[0].hand).not.toContain(GRENINJA)
    expect(s.players[0].deck).toEqual([GRENINJA])
  })

  it('Lucky Ice Pop heals 20 from the Active', () => {
    const active = mon(TORCHIC, { damage: 30 })
    const s = game(player({ active }), player({ active: mon(FROAKIE) }))
    trainers[LUCKY_ICE_POP].run(makeContext(s, [], 0), { type: 'PlayItem', cardId: LUCKY_ICE_POP })
    expect(active.damage).toBe(10)
  })

  it('Lisia pulls 2 random Basics with 50 HP or less from the deck', () => {
    // Magnemite is a 50-HP Basic; Magneton is Stage 1; Miraidon ex is a 140-HP Basic.
    const s = game(
      player({ active: mon(TORCHIC), deck: [MAGNEMITE, MAGNETON, MIRAIDON_EX, MAGNEMITE] }),
      player({ active: mon(FROAKIE) }),
    )
    trainers[LISIA].run(makeContext(s, [], 0), { type: 'PlaySupporter', cardId: LISIA })
    expect(s.players[0].hand.filter((id) => id === MAGNEMITE)).toHaveLength(2)
    expect(s.players[0].deck).toContain(MAGNETON) // Stage 1 — not eligible
    expect(s.players[0].deck).toContain(MIRAIDON_EX) // 140 HP — not eligible
  })

  it('Professor Turo shuffles a Future Pokémon (Miraidon) back into the deck', () => {
    const miraidon = mon(MIRAIDON_EX, { attachedEnergy: ['Lightning'] })
    const s = game(
      player({ active: mon(TORCHIC), bench: [miraidon], deck: [FROAKIE] }),
      player({ active: mon(FROAKIE) }),
    )
    expect(trainers[PROFESSOR_TURO].playable(s, 0)).toBe(true)
    trainers[PROFESSOR_TURO].run(makeContext(s, [], 0), {
      type: 'PlaySupporter',
      cardId: PROFESSOR_TURO,
      targetUid: miraidon.uid,
    })
    expect(s.players[0].bench).toHaveLength(0)
    expect(s.players[0].deck).toContain(MIRAIDON_EX)
  })

  it('Professor Turo needs a Future Pokémon and something else left in play', () => {
    const noFuture = game(
      player({ active: mon(TORCHIC), bench: [mon(FROAKIE)] }),
      player({ active: mon(FROAKIE) }),
    )
    expect(trainers[PROFESSOR_TURO].playable(noFuture, 0)).toBe(false)

    // Future Pokémon is the only one in play — can't leave yourself empty.
    const onlyFuture = game(player({ active: mon(MIRAIDON_EX) }), player({ active: mon(FROAKIE) }))
    expect(trainers[PROFESSOR_TURO].playable(onlyFuture, 0)).toBe(false)
  })

  it('Sabrina benches the opponent Active and clears its Special Conditions', () => {
    const foeActive = mon(FROAKIE, { status: ['burned'] })
    const foeBench = mon(TORCHIC)
    const s = game(
      player({ active: mon(TORCHIC) }),
      player({ active: foeActive, bench: [foeBench] }),
    )
    expect(trainers[SABRINA].playable(s, 0)).toBe(true)
    trainers[SABRINA].run(makeContext(s, [], 0), { type: 'PlaySupporter', cardId: SABRINA })
    expect(s.players[1].active).toBeNull()
    expect(s.players[1].bench.map((b) => b.uid)).toContain(foeActive.uid)
    expect(foeActive.status).toEqual([])
  })

  it('Sabrina is not playable when the opponent has no Bench', () => {
    const s = game(player({ active: mon(TORCHIC) }), player({ active: mon(FROAKIE) }))
    expect(trainers[SABRINA].playable(s, 0)).toBe(false)
  })

  it('Field Blower discards a Stadium or a Tool', () => {
    const helmeted = mon(FROAKIE, { tool: GIANT_CAPE })
    const stad = game(player({ active: mon(TORCHIC) }), player({ active: helmeted }), {
      stadium: HIKING_TRAIL,
      stadiumOwner: 0,
    })
    const blowStadium: TrainerMove = { type: 'PlayItem', cardId: FIELD_BLOWER, fieldBlower: { kind: 'stadium' } }
    trainers[FIELD_BLOWER].run(makeContext(stad, [], 0), blowStadium)
    expect(stad.stadium).toBeNull()

    const blowTool: TrainerMove = {
      type: 'PlayItem',
      cardId: FIELD_BLOWER,
      fieldBlower: { kind: 'tool', uid: helmeted.uid },
    }
    trainers[FIELD_BLOWER].run(makeContext(stad, [], 0), blowTool)
    expect(helmeted.tool).toBeNull()
    expect(stad.players[1].discard).toContain(GIANT_CAPE)
  })

  it('marks Field Blower playable only when there is a Tool or Stadium', () => {
    const empty = game(player({ active: mon(TORCHIC) }), player({ active: mon(FROAKIE) }))
    expect(trainers[FIELD_BLOWER].playable(empty, 0)).toBe(false)
  })
})
