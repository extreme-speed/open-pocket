import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { legalMoves } from '../engine/moves'
import { useGame } from './store'

const DECK_A = 'mega-blaziken-ex-b1-greninja-a1'
const DECK_B = 'suicune-ex-a4a-baxcalibur-b2a'

beforeEach(() => {
  useGame.getState().start(DECK_A, DECK_B, { seed: 7 })
})

afterEach(() => {
  useGame.getState().abandon()
  localStorage.clear()
})

describe('undo', () => {
  it('does nothing when there is no history', () => {
    expect(useGame.getState().history).toHaveLength(0)
    useGame.getState().undo()
    expect(useGame.getState().history).toHaveLength(0)
  })

  it('restores the exact pre-move state, including legal moves', () => {
    const before = useGame.getState().state!
    const move = legalMoves(before).find((m) => m.type === 'SetupActive')!

    useGame.getState().dispatch(move)
    expect(useGame.getState().state).not.toEqual(before)
    expect(useGame.getState().history).toHaveLength(1)

    useGame.getState().undo()
    expect(useGame.getState().state).toEqual(before)
    expect(useGame.getState().moves).toEqual(legalMoves(before))
    expect(useGame.getState().history).toHaveLength(0)
  })

  it('rewinds multiple moves one at a time', () => {
    const s0 = useGame.getState().state!
    const m0 = legalMoves(s0).find((m) => m.type === 'SetupActive')!
    useGame.getState().dispatch(m0)

    const s1 = useGame.getState().state!
    const m1 = legalMoves(s1)[0]
    useGame.getState().dispatch(m1)

    expect(useGame.getState().history).toHaveLength(2)
    useGame.getState().undo()
    expect(useGame.getState().state).toEqual(s1)
    useGame.getState().undo()
    expect(useGame.getState().state).toEqual(s0)
  })
})
