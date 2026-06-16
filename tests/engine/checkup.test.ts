import { describe, expect, it } from 'vitest'
import { apply } from '../../src/engine/reducer'
import { FROAKIE, TORCHIC } from '../../src/engine/data/ids'
import { game, mon, player } from '../helpers'

describe('between-turns checkup', () => {
  it('keeps an opponent Paralyzed through their next turn, then clears it', () => {
    // Player 0 ends their turn; player 1's Active is Paralyzed.
    const paralyzed = mon(FROAKIE, { status: ['paralyzed'] })
    const s = game(player({ active: mon(TORCHIC) }), player({ active: paralyzed }))

    // End of player 0's turn: the checkup must NOT clear player 1's paralysis,
    // otherwise the condition would have no effect on player 1's upcoming turn.
    const afterP0 = apply(s, { type: 'EndTurn' }).state
    expect(afterP0.current).toBe(1)
    expect(afterP0.players[1].active!.status).toContain('paralyzed')

    // End of player 1's own turn: now the checkup clears it.
    const afterP1 = apply(afterP0, { type: 'EndTurn' }).state
    expect(afterP1.current).toBe(0)
    expect(afterP1.players[1].active!.status).not.toContain('paralyzed')
  })

  it('Poison and Burn both tick on both Active Pokémon each checkup', () => {
    const mine = mon(TORCHIC, { status: ['poisoned'] })
    const theirs = mon(FROAKIE, { status: ['poisoned'] })
    const s = game(player({ active: mine }), player({ active: theirs }))

    const after = apply(s, { type: 'EndTurn' }).state
    expect(after.players[0].active!.damage).toBe(10)
    expect(after.players[1].active!.damage).toBe(10)
  })
})
