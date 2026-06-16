import { afterEach, describe, expect, it } from 'vitest'
import { createGame } from '../engine/setup'
import { apply } from '../engine/reducer'
import { legalMoves } from '../engine/moves'
import { clearGame, loadDeckSelection, loadGame, saveDeckSelection, saveGame } from './persistence'

const DECK_A = 'mega-blaziken-ex-b1-greninja-a1'
const DECK_B = 'suicune-ex-a4a-baxcalibur-b2a'

afterEach(() => {
  localStorage.clear()
})

describe('save/resume persistence', () => {
  it('returns null when nothing is saved', () => {
    expect(loadGame()).toBeNull()
  })

  it('round-trips a game state through localStorage', () => {
    const state = createGame(DECK_A, DECK_B, { seed: 7 })
    saveGame({ state, log: ['hello'], viewPerspective: 1 })

    const loaded = loadGame()
    expect(loaded).not.toBeNull()
    expect(loaded!.viewPerspective).toBe(1)
    expect(loaded!.log).toEqual(['hello'])
    // Deep-equal engine state survives the JSON round-trip.
    expect(loaded!.state).toEqual(state)
  })

  it('a resumed state is still playable (legalMoves works on it)', () => {
    const fresh = createGame(DECK_A, DECK_B, { seed: 7 })
    const firstSetup = legalMoves(fresh).find((m) => m.type === 'SetupActive')!
    const { state } = apply(fresh, firstSetup)
    saveGame({ state, log: [], viewPerspective: 0 })

    const loaded = loadGame()!
    const moves = legalMoves(loaded.state)
    expect(moves.length).toBeGreaterThan(0)
  })

  it('clearGame removes the save', () => {
    const state = createGame(DECK_A, DECK_B, { seed: 7 })
    saveGame({ state, log: [], viewPerspective: 0 })
    expect(loadGame()).not.toBeNull()
    clearGame()
    expect(loadGame()).toBeNull()
  })

  it('rejects a saved blob with a mismatched version', () => {
    localStorage.setItem('open-pocket:save', JSON.stringify({ version: 999, state: {} }))
    expect(loadGame()).toBeNull()
  })

  it('rejects corrupt JSON without throwing', () => {
    localStorage.setItem('open-pocket:save', '{not valid json')
    expect(loadGame()).toBeNull()
  })
})

describe('deck-selection persistence', () => {
  it('returns null when nothing is saved', () => {
    expect(loadDeckSelection()).toBeNull()
  })

  it('round-trips the deck and first-player choice', () => {
    saveDeckSelection({ deckA: DECK_A, deckB: DECK_B, first: 1 })
    expect(loadDeckSelection()).toEqual({ deckA: DECK_A, deckB: DECK_B, first: 1 })
  })

  it('coerces an invalid first-player value back to random', () => {
    localStorage.setItem('open-pocket:deck-select', JSON.stringify({ deckA: DECK_A, deckB: DECK_B, first: 7 }))
    expect(loadDeckSelection()!.first).toBe('random')
  })

  it('rejects a blob missing deck ids', () => {
    localStorage.setItem('open-pocket:deck-select', JSON.stringify({ first: 'random' }))
    expect(loadDeckSelection()).toBeNull()
  })
})
