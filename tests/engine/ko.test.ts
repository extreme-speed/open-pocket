import { describe, expect, it } from 'vitest'
import { apply } from '../../src/engine/reducer'
import { retreatCost } from '../../src/engine/rules'
import {
  FROAKIE,
  MEGA_BLAZIKEN_EX,
  ROCKY_HELMET,
  TORCHIC,
} from '../../src/engine/data/ids'
import { game, mon, player } from '../helpers'

describe('KO, points, and replacement', () => {
  it('awards a point, requires promotion, then passes the turn', () => {
    const torchic = mon(TORCHIC, { attachedEnergy: ['Fire'] })
    const dying = mon(FROAKIE, { damage: 40 }) // hp 60; Peck (20) → KO
    const bench = mon(FROAKIE)
    const s = game(player({ active: torchic }), player({ active: dying, bench: [bench] }))

    const afterAttack = apply(s, { type: 'Attack', attackIndex: 0 }).state
    expect(afterAttack.players[0].points).toBe(1)
    expect(afterAttack.phase).toBe('awaitingKOReplacement')
    expect(afterAttack.koReplacements).toEqual([1])

    const promoted = apply(afterAttack, { type: 'KOReplace', benchUid: bench.uid }).state
    expect(promoted.players[1].active!.uid).toBe(bench.uid)
    expect(promoted.phase).toBe('main')
    expect(promoted.current).toBe(1) // attacking ended player 0's turn
  })

  it('a Mega-ex KO is worth 3 and ends the game immediately', () => {
    const torchic = mon(TORCHIC, { attachedEnergy: ['Fire'] }) // Peck 20, no Weakness vs Fire mon
    const megablaze = mon(MEGA_BLAZIKEN_EX, { damage: 200 }) // hp 210
    const s = game(player({ active: torchic }), player({ active: megablaze }))

    const after = apply(s, { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[0].points).toBe(3)
    expect(after.phase).toBe('gameOver')
    expect(after.winner).toBe(0)
  })

  it('losing your last Pokémon loses the game', () => {
    const torchic = mon(TORCHIC, { attachedEnergy: ['Fire'] })
    const lastMon = mon(FROAKIE, { damage: 40 }) // no Bench behind it
    const s = game(player({ active: torchic }), player({ active: lastMon }))
    const after = apply(s, { type: 'Attack', attackIndex: 0 }).state
    expect(after.phase).toBe('gameOver')
    expect(after.winner).toBe(0)
  })

  it('Rocky Helmet hits the attacker back for 20', () => {
    const attacker = mon(TORCHIC, { attachedEnergy: ['Fire'] })
    const defender = mon(FROAKIE, { tool: ROCKY_HELMET })
    const s = game(player({ active: attacker }), player({ active: defender }))
    const after = apply(s, { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[0].active!.damage).toBe(20)
    expect(after.players[1].active!.damage).toBe(20) // Peck
  })

  it("discards a KO'd Pokémon's attached Energy to its owner", () => {
    const torchic = mon(TORCHIC, { attachedEnergy: ['Fire'] })
    const dying = mon(FROAKIE, { damage: 40, attachedEnergy: ['Water', 'Water'] })
    const s = game(player({ active: torchic }), player({ active: dying, bench: [mon(FROAKIE)] }))

    const after = apply(s, { type: 'Attack', attackIndex: 0 }).state
    // The KO'd Froakie's two Water Energy land in player 1's discarded-Energy pile.
    expect(after.players[1].discardedEnergy).toEqual(['Water', 'Water'])
  })

  it('retreating discards Energy equal to the retreat cost', () => {
    const active = mon(FROAKIE, { attachedEnergy: ['Water', 'Water', 'Water'] })
    const benched = mon(TORCHIC)
    const s = game(player({ active, bench: [benched] }), player({ active: mon(TORCHIC) }))
    const cost = retreatCost(s, 0)
    expect(cost).toBeGreaterThan(0)

    const after = apply(s, { type: 'Retreat', benchUid: benched.uid }).state
    expect(after.players[0].discardedEnergy).toHaveLength(cost)
    expect(after.players[0].discardedEnergy.every((e) => e === 'Water')).toBe(true)
    // The retreated Pokémon (now benched) kept the rest of its Energy.
    const retreated = after.players[0].bench.find((b) => b.uid === active.uid)!
    expect(retreated.attachedEnergy).toHaveLength(3 - cost)
  })

  it('Burn ticks during the between-turns checkup and can KO', () => {
    const attacker = mon(TORCHIC)
    const burning = mon(FROAKIE, { damage: 50, status: ['burned'] }) // +20 burn → KO
    const s = game(
      player({ active: attacker }),
      player({ active: burning, bench: [mon(FROAKIE)] }),
    )
    const after = apply(s, { type: 'EndTurn' }).state
    expect(after.players[0].points).toBe(1)
    expect(after.phase).toBe('awaitingKOReplacement')
    expect(after.koReplacements).toEqual([1])
  })
})
