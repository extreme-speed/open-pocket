import { describe, expect, it } from 'vitest'
import { makeRng } from '../../src/engine/rng'
import { TORCHIC, DEINO, MAGNEMITE } from '../../src/engine/data/ids'
import type { GameState } from '../../src/engine/types'
import { search } from '../../src/ai/ismcts'
import { game, mon, player, DECK_FIRE, DECK_LIGHTNING } from '../helpers'

/** Give the two players real deck ids so the world sampler can reconstruct the
 *  opponent's unseen pool. */
function withDecks(over: Partial<GameState>, g: GameState): GameState {
  g.players[0].deckId = DECK_FIRE
  g.players[1].deckId = DECK_LIGHTNING
  return Object.assign(g, over)
}

const SEARCH = { iterations: 400, rng: makeRng(1) }

describe('IS-MCTS tactical sanity', () => {
  it('takes an available lethal', () => {
    // Our Torchic (Peck, 20) is loaded; the opponent Active sits at 10 HP with an
    // empty bench, and we are at 2 points — the KO wins outright.
    const me = player({
      registered: ['Fire'],
      active: mon(TORCHIC, { uid: 'me', attachedEnergy: ['Fire'] }),
      bench: [mon(TORCHIC, { uid: 'meBench' })],
      points: 2,
    })
    const foe = player({ active: mon(DEINO, { uid: 'foe', damage: 50 }) })
    const state = withDecks({ current: 0 }, game(me, foe))

    const res = search(state, 0, SEARCH)
    expect(res.best.type).toBe('Attack')
    expect(res.winProb).toBeGreaterThan(0.8)
  })

  it('does not retreat a strong online Active for a weak bencher', () => {
    // The Active is a healthy attacker with energy to spare; the only bench option
    // is a bare Magnemite. Retreating would discard energy and weaken us.
    const me = player({
      registered: ['Fire'],
      active: mon(TORCHIC, { uid: 'me', attachedEnergy: ['Fire', 'Fire'] }),
      bench: [mon(MAGNEMITE, { uid: 'weak' })],
    })
    const foe = player({ active: mon(DEINO, { uid: 'foe' }), bench: [mon(DEINO, { uid: 'foe2' })] })
    const state = withDecks({ current: 0 }, game(me, foe))

    const res = search(state, 0, SEARCH)
    expect(res.best.type).not.toBe('Retreat')
  })

  it('attaches to the attacker when that is what unlocks the turn', () => {
    // The Active can't attack yet (no energy); placing our one energy on it brings
    // Peck online for a game-winning KO (we are at 2 points, the foe Active at 10
    // HP). Anything else throws the win away.
    const me = player({
      registered: ['Fire'],
      active: mon(TORCHIC, { uid: 'me' }),
      bench: [mon(MAGNEMITE, { uid: 'bench' })],
      currentEnergy: 'Fire',
      points: 2,
    })
    const foe = player({ active: mon(DEINO, { uid: 'foe', damage: 50 }), bench: [mon(DEINO, { uid: 'foe2' })] })
    const state = withDecks({ current: 0 }, game(me, foe))

    const res = search(state, 0, SEARCH)
    expect(res.best.type).toBe('AttachEnergy')
    expect(res.best).toMatchObject({ targetUid: 'me' })
  })
})
