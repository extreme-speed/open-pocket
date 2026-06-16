import { describe, expect, it } from 'vitest'
import { legalMoves } from '../src/engine/moves'
import { apply } from '../src/engine/reducer'
import type { GameState, Move } from '../src/engine/types'
import { autoSetup, DECK_DARK, DECK_FIRE, DECK_LIGHTNING, DECK_WATER } from './helpers'

/** A greedy hotseat driver: attack as soon as possible, otherwise build up and
 *  exercise abilities / trainers before passing. */
function chooseMove(s: GameState): Move {
  const moves = legalMoves(s)
  // Forced single-purpose phases (promote a new Active, pick a Supporter to
  // discard) offer only their own moves — take the first.
  if (s.phase === 'awaitingKOReplacement' || s.phase === 'awaitingAttackChoice') return moves[0]
  const pick = (t: Move['type']) => moves.find((m) => m.type === t)
  return (
    pick('Attack') ??
    pick('AttachEnergy') ??
    pick('UseAbility') ??
    pick('Evolve') ??
    pick('RareCandyEvolve') ??
    pick('PlayBasic') ??
    pick('PlaySupporter') ??
    pick('PlayItem') ??
    moves.find((m) => m.type === 'EndTurn')!
  )
}

function assertInvariants(s: GameState): void {
  for (const p of s.players) {
    expect(p.bench.length).toBeLessThanOrEqual(3)
    if (s.phase === 'main') {
      // In the main phase the current player must always have an Active.
      if (p === s.players[s.current]) expect(p.active).not.toBeNull()
    }
  }
  if (s.phase !== 'gameOver') {
    // There is always at least one legal move to make (no soft-locks).
    expect(legalMoves(s).length).toBeGreaterThan(0)
  }
}

function playOut(deckA: string, deckB: string, seed: number): GameState {
  let s = autoSetup(deckA, deckB, { seed, firstPlayer: 0 }, 3)
  for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
    assertInvariants(s)
    const move = chooseMove(s)
    s = apply(s, move).state
  }
  return s
}

describe('full game loop', () => {
  const matchups: Array<[string, string]> = [
    [DECK_FIRE, DECK_WATER],
    [DECK_WATER, DECK_DARK],
    [DECK_DARK, DECK_FIRE],
    [DECK_LIGHTNING, DECK_FIRE],
    [DECK_WATER, DECK_LIGHTNING],
  ]

  for (const [a, b] of matchups) {
    for (let seed = 0; seed < 4; seed++) {
      it(`plays ${a} vs ${b} (seed ${seed}) to completion`, () => {
        const final = playOut(a, b, seed)
        expect(final.phase).toBe('gameOver')
        expect(final.winner).not.toBeNull()
        const winner = final.players[final.winner!]
        const loser = final.players[final.winner === 0 ? 1 : 0]
        // Win is by 3 points, or by the opponent having no Pokémon left.
        const wipedOut = !loser.active && loser.bench.length === 0
        expect(winner.points >= 3 || wipedOut).toBe(true)
      })
    }
  }
})
