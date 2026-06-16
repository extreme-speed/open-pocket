import { describe, expect, it } from 'vitest'
import { apply } from '../../src/engine/reducer'
import {
  COMBUSKEN,
  FROAKIE,
  GRENINJA,
  PROFESSORS_RESEARCH,
  RARE_CANDY,
  TORCHIC,
} from '../../src/engine/data/ids'
import { game, hasMove, mon, player } from '../helpers'

describe('legalMoves constraints', () => {
  it('cannot Play Basic to a full Bench', () => {
    const p0 = player({
      active: mon(TORCHIC),
      bench: [mon(FROAKIE), mon(FROAKIE), mon(FROAKIE)],
      hand: [FROAKIE],
    })
    const s = game(p0, player({ active: mon(FROAKIE) }))
    expect(hasMove(s, (m) => m.type === 'PlayBasic')).toBe(false)
  })

  it('cannot attach energy twice in a turn', () => {
    const p0 = player({ active: mon(TORCHIC), currentEnergy: 'Fire' })
    const s = game(p0, player({ active: mon(FROAKIE) }))
    expect(hasMove(s, (m) => m.type === 'AttachEnergy')).toBe(true)

    const after = apply(s, { type: 'AttachEnergy', targetUid: p0.active!.uid }).state
    expect(after.players[0].energyAttachedThisTurn).toBe(true)
    expect(hasMove(after, (m) => m.type === 'AttachEnergy')).toBe(false)
  })

  it('cannot evolve a Pokémon the turn it was played, nor on a first turn', () => {
    const handEvolve = { active: mon(TORCHIC, { playedTurn: 3 }), hand: [COMBUSKEN] }
    const playedThisTurn = game(player(handEvolve), player({ active: mon(FROAKIE) }), { turn: 3 })
    expect(hasMove(playedThisTurn, (m) => m.type === 'Evolve')).toBe(false)

    const settled = game(
      player({ active: mon(TORCHIC, { playedTurn: 0 }), hand: [COMBUSKEN] }),
      player({ active: mon(FROAKIE) }),
      { turn: 3 },
    )
    expect(hasMove(settled, (m) => m.type === 'Evolve')).toBe(true)

    const firstTurn = game(
      player({ active: mon(TORCHIC, { playedTurn: 0 }), hand: [COMBUSKEN] }),
      player({ active: mon(FROAKIE) }),
      { turn: 1 },
    )
    expect(hasMove(firstTurn, (m) => m.type === 'Evolve')).toBe(false)
  })

  it('offers Rare Candy from Basic to Stage 2, but not on the first turn', () => {
    const mk = (turn: number) =>
      game(
        player({ active: mon(FROAKIE, { playedTurn: 0 }), hand: [RARE_CANDY, GRENINJA] }),
        player({ active: mon(TORCHIC) }),
        { turn },
      )
    expect(hasMove(mk(3), (m) => m.type === 'RareCandyEvolve')).toBe(true)
    expect(hasMove(mk(1), (m) => m.type === 'RareCandyEvolve')).toBe(false)

    const noCandy = game(
      player({ active: mon(FROAKIE), hand: [GRENINJA] }),
      player({ active: mon(TORCHIC) }),
    )
    expect(hasMove(noCandy, (m) => m.type === 'RareCandyEvolve')).toBe(false)
  })

  it('hides Retreat unless affordable and there is a Bench', () => {
    const noBench = game(
      player({ active: mon(TORCHIC, { attachedEnergy: ['Fire'] }) }),
      player({ active: mon(FROAKIE) }),
    )
    expect(hasMove(noBench, (m) => m.type === 'Retreat')).toBe(false)

    const noEnergy = game(
      player({ active: mon(TORCHIC), bench: [mon(FROAKIE)] }),
      player({ active: mon(FROAKIE) }),
    )
    expect(hasMove(noEnergy, (m) => m.type === 'Retreat')).toBe(false)

    const ok = game(
      player({ active: mon(TORCHIC, { attachedEnergy: ['Fire'] }), bench: [mon(FROAKIE)] }),
      player({ active: mon(FROAKIE) }),
    )
    expect(hasMove(ok, (m) => m.type === 'Retreat')).toBe(true)
  })

  it('only offers attacks the Active can afford', () => {
    const broke = game(player({ active: mon(TORCHIC) }), player({ active: mon(FROAKIE) }))
    expect(hasMove(broke, (m) => m.type === 'Attack')).toBe(false)

    const armed = game(
      player({ active: mon(TORCHIC, { attachedEnergy: ['Fire'] }) }),
      player({ active: mon(FROAKIE) }),
    )
    expect(hasMove(armed, (m) => m.type === 'Attack')).toBe(true)
  })

  it('allows only one Supporter per turn', () => {
    const p0 = player({ active: mon(TORCHIC), hand: [PROFESSORS_RESEARCH], deck: [FROAKIE, TORCHIC] })
    const s = game(p0, player({ active: mon(FROAKIE) }))
    expect(hasMove(s, (m) => m.type === 'PlaySupporter')).toBe(true)

    const after = apply(s, { type: 'PlaySupporter', cardId: PROFESSORS_RESEARCH }).state
    expect(after.players[0].supporterPlayedThisTurn).toBe(true)
    expect(hasMove(after, (m) => m.type === 'PlaySupporter')).toBe(false)
  })
})
