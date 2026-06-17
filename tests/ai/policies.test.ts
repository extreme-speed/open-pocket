import { describe, expect, it } from 'vitest'
import { legalMoves } from '../../src/engine/moves'
import { apply } from '../../src/engine/reducer'
import { makeRng } from '../../src/engine/rng'
import type { GameState, PlayerIndex } from '../../src/engine/types'
import type { Policy } from '../../src/ai/types'
import { attachAttackPolicy, endTurnPolicy, evolutionRusherPolicy, randomPolicy } from '../../src/ai/policies'
import { autoSetup, DECK_FIRE, DECK_LIGHTNING } from '../helpers'

/** Play one full game, each seat driven by its own policy. */
function playMatch(a: Policy, b: Policy, seed: number): GameState {
  let s = autoSetup(DECK_FIRE, DECK_LIGHTNING, { seed, firstPlayer: 0 }, 2)
  const rng = makeRng(seed * 1000 + 1)
  const policies: [Policy, Policy] = [a, b]
  for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
    const moves = legalMoves(s)
    const seat = (s.current ?? 0) as PlayerIndex
    s = apply(s, policies[seat](s, moves, rng)).state
  }
  return s
}

/** Win rate for seat A and the fraction of games that reached a result. (A rare
 *  matchup can stall when neither simple policy can make progress — e.g. a lone
 *  Heatmor, whose only attack hits the bench, vs a benchless Active — so we
 *  measure rather than require termination.) */
function results(a: Policy, b: Policy, games: number): { rate: number; finished: number } {
  let aWins = 0
  let finished = 0
  for (let seed = 0; seed < games; seed++) {
    const final = playMatch(a, b, seed)
    if (final.phase === 'gameOver') finished++
    if (final.winner === 0) aWins++
  }
  return { rate: aWins / games, finished: finished / games }
}

describe('benchmark policies (cross-check)', () => {
  it('attach-and-attack mirror plays out and is roughly balanced', () => {
    const { rate, finished } = results(attachAttackPolicy, attachAttackPolicy, 16)
    expect(finished).toBeGreaterThan(0.7) // most games actually resolve
    // Not degenerate: neither seat sweeps every game.
    expect(rate).toBeGreaterThan(0.05)
    expect(rate).toBeLessThan(0.95)
  })

  it('attach-and-attack crushes the do-nothing baseline', () => {
    const { rate } = results(attachAttackPolicy, endTurnPolicy, 12)
    expect(rate).toBeGreaterThan(0.6)
  })

  it('every policy always returns a legal move', () => {
    for (const pol of [randomPolicy, attachAttackPolicy, evolutionRusherPolicy, endTurnPolicy]) {
      let s = autoSetup(DECK_FIRE, DECK_LIGHTNING, { seed: 5, firstPlayer: 0 }, 1)
      const rng = makeRng(1)
      for (let i = 0; i < 200 && s.phase !== 'gameOver'; i++) {
        const moves = legalMoves(s)
        const move = pol(s, moves, rng)
        expect(moves).toContainEqual(move)
        s = apply(s, move).state
      }
    }
  })
})
