import { describe, expect, it } from 'vitest'
import { actingPlayer, legalMoves } from '../../src/engine/moves'
import { apply } from '../../src/engine/reducer'
import { makeRng } from '../../src/engine/rng'
import { createGame } from '../../src/engine/setup'
import type { Move } from '../../src/engine/types'
import { attachAttackPolicy } from '../../src/ai/policies'
import { DECK_FIRE, DECK_LIGHTNING } from '../helpers'

/** The Replay UI's core contract: the recorded move list, applied in order from
 *  createGame(deck, deck, { seed, firstPlayer }), reproduces the game exactly.
 *  We don't need the searcher to prove this — any move list does, because the
 *  engine is deterministic from the seed and `apply` is pure. (The searcher only
 *  matters in that it runs on a *separate* RNG, never touching the game stream.) */
describe('recorded move list reproduces the game', () => {
  for (const seed of [0, 1, 2, 3]) {
    it(`seed ${seed} replays move-for-move`, () => {
      // Record a full game's moves with a cheap policy.
      const opts = { seed, firstPlayer: 0 as const }
      const polRng = makeRng(seed + 1)
      let s = createGame(DECK_FIRE, DECK_LIGHTNING, opts)
      const moves: Move[] = []
      for (let i = 0; i < 4000 && s.phase !== 'gameOver'; i++) {
        if (actingPlayer(s) === null) break
        const m = attachAttackPolicy(s, legalMoves(s), polRng)
        moves.push(m)
        s = apply(s, m).state
      }
      const finalWinner = s.winner

      // Replay from a fresh game built with the same seed/firstPlayer.
      let r = createGame(DECK_FIRE, DECK_LIGHTNING, opts)
      for (const m of moves) {
        // Each recorded move must still be legal at this point in the replay.
        expect(legalMoves(r)).toContainEqual(m)
        r = apply(r, m).state
      }
      expect(r.winner).toBe(finalWinner)
      // The full reconstructed state matches the original line.
      expect(r).toEqual(s)
    })
  }
})
