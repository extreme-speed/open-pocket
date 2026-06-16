import { describe, expect, it } from 'vitest'
import { getCard } from '../../src/engine/data/cards'
import { createGame, dealOpeningHand, buildDeck, isBasic } from '../../src/engine/setup'
import { apply } from '../../src/engine/reducer'
import { makeRng } from '../../src/engine/rng'
import { autoSetup, DECK_FIRE, DECK_WATER, findMove } from '../helpers'

describe('setup', () => {
  it('builds 20-card decks', () => {
    expect(buildDeck(DECK_FIRE)).toHaveLength(20)
    expect(buildDeck(DECK_WATER)).toHaveLength(20)
  })

  it('always deals an opening hand with at least one Basic', () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = makeRng(seed)
      const { hand, deck } = dealOpeningHand(rng, buildDeck(DECK_WATER))
      expect(hand).toHaveLength(5)
      expect(deck).toHaveLength(15)
      expect(hand.some((id) => isBasic(getCard(id)))).toBe(true)
    }
  })

  it('starts in setup phase with both hands dealt', () => {
    const s = createGame(DECK_FIRE, DECK_WATER, { seed: 1, firstPlayer: 0 })
    expect(s.phase).toBe('setup')
    expect(s.players[0].hand).toHaveLength(5)
    expect(s.players[1].hand).toHaveLength(5)
    expect(s.players[0].active).toBeNull()
  })

  it('the player going first generates no energy on turn 1; the second does on turn 2', () => {
    const s = autoSetup(DECK_FIRE, DECK_WATER, { seed: 3, firstPlayer: 0 })
    expect(s.phase).toBe('main')
    expect(s.turn).toBe(1)
    expect(s.current).toBe(0)
    expect(s.players[0].currentEnergy).toBeNull()

    const next = apply(s, findMove(s, (m) => m.type === 'EndTurn')).state
    expect(next.turn).toBe(2)
    expect(next.current).toBe(1)
    expect(next.players[1].currentEnergy).not.toBeNull()
  })

  it('draws one card at the start of each turn', () => {
    const s = autoSetup(DECK_FIRE, DECK_WATER, { seed: 5, firstPlayer: 0 })
    // 5 dealt − 1 placed as Active + 1 drawn for turn = 5
    expect(s.players[0].hand).toHaveLength(5)
  })
})
