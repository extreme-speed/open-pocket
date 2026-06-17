import { describe, expect, it } from 'vitest'
import { apply } from '../../src/engine/reducer'
import { legalMoves } from '../../src/engine/moves'
import { TORCHIC, DEINO } from '../../src/engine/data/ids'
import { TURN_LIMIT } from '../../src/engine/setup'
import { game, mon, player } from '../helpers'

describe('turn limit', () => {
  it('ending the 30th turn draws the game (no winner)', () => {
    const me = player({ active: mon(TORCHIC, { uid: 'a' }), bench: [mon(TORCHIC, { uid: 'b' })], points: 1 })
    const foe = player({ active: mon(DEINO, { uid: 'c' }), bench: [mon(DEINO, { uid: 'd' })], points: 2 })
    const state = game(me, foe, { turn: TURN_LIMIT, current: 0 })

    const after = apply(state, { type: 'EndTurn' }).state
    expect(after.phase).toBe('gameOver')
    expect(after.winner).toBeNull() // a points lead does NOT decide it — always a draw
    expect(legalMoves(after)).toEqual([])
  })

  it('does not draw before the cap', () => {
    const me = player({ active: mon(TORCHIC, { uid: 'a' }), bench: [mon(TORCHIC, { uid: 'b' })] })
    const foe = player({ active: mon(DEINO, { uid: 'c' }), bench: [mon(DEINO, { uid: 'd' })] })
    const state = game(me, foe, { turn: TURN_LIMIT - 1, current: 0 })

    const after = apply(state, { type: 'EndTurn' }).state
    expect(after.phase).toBe('main')
    expect(after.turn).toBe(TURN_LIMIT)
  })
})
