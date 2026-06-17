import { describe, expect, it } from 'vitest'
import { TORCHIC, DEINO } from '../../src/engine/data/ids'
import { evaluate, winProb } from '../../src/ai/eval'
import { game, mon, player } from '../helpers'

describe('value function', () => {
  it('reports a decided game as a certain win/loss', () => {
    const state = game(player(), player(), { winner: 0, phase: 'gameOver' })
    expect(winProb(state, 0)).toBe(1)
    expect(winProb(state, 1)).toBe(0)
    expect(evaluate(state, 0)).toBeGreaterThan(0)
  })

  it('is zero-sum in score between the two seats', () => {
    const me = player({ active: mon(TORCHIC, { attachedEnergy: ['Fire'] }), points: 1 })
    const foe = player({ active: mon(DEINO) })
    const state = game(me, foe)
    expect(evaluate(state, 0)).toBeCloseTo(-evaluate(state, 1), 6)
    expect(winProb(state, 0) + winProb(state, 1)).toBeCloseTo(1, 6)
  })

  it('rewards being ahead on points', () => {
    const ahead = game(player({ active: mon(TORCHIC), points: 2 }), player({ active: mon(DEINO) }))
    const even = game(player({ active: mon(TORCHIC) }), player({ active: mon(DEINO) }))
    expect(winProb(ahead, 0)).toBeGreaterThan(winProb(even, 0))
  })

  it('rewards an Active that can already attack', () => {
    const online = game(player({ active: mon(TORCHIC, { attachedEnergy: ['Fire'] }) }), player({ active: mon(DEINO) }))
    const offline = game(player({ active: mon(TORCHIC) }), player({ active: mon(DEINO) }))
    expect(winProb(online, 0)).toBeGreaterThan(winProb(offline, 0))
  })
})
