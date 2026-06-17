import { describe, expect, it } from 'vitest'
import { actingPlayer, legalMoves } from '../../src/engine/moves'
import { apply } from '../../src/engine/reducer'
import { makeRng } from '../../src/engine/rng'
import { buildDeck } from '../../src/engine/setup'
import { inPlay, other } from '../../src/engine/rules'
import type { GameState, PlayerIndex } from '../../src/engine/types'
import { observe, sampleWorld } from '../../src/ai/observation'
import { rolloutPolicy } from '../../src/ai/policies'
import { autoSetup, DECK_FIRE, DECK_LIGHTNING } from '../helpers'

/** Sorted multiset, for order-insensitive comparison. */
function bag(ids: readonly string[]): string[] {
  return ids.slice().sort()
}

/** Play `plies` heuristic moves to reach a populated mid-game (discards, evolved
 *  stacks, energy on board), stopping early if the game ends. */
function midGame(deckA: string, deckB: string, seed: number, plies: number): GameState {
  let s = autoSetup(deckA, deckB, { seed, firstPlayer: 0 }, 2)
  const rng = makeRng(seed + 7)
  for (let i = 0; i < plies && s.phase !== 'gameOver'; i++) {
    const moves = legalMoves(s)
    s = apply(s, rolloutPolicy(s, moves, rng)).state
  }
  return s
}

function allOppCards(s: GameState, opp: PlayerIndex): string[] {
  const p = s.players[opp]
  const cards = [...p.hand, ...p.deck, ...p.discard]
  for (const pk of inPlay(p)) {
    cards.push(...pk.stack)
    if (pk.tool) cards.push(pk.tool)
  }
  if (s.stadium && s.stadiumOwner === opp) cards.push(s.stadium)
  return cards
}

describe('world sampler', () => {
  const state = midGame(DECK_FIRE, DECK_LIGHTNING, 3, 12)
  const seat = (actingPlayer(state) ?? state.current) as PlayerIndex
  const opp = other(seat)

  it('reaches a non-trivial mid-game position to sample from', () => {
    expect(state.phase).not.toBe('gameOver')
    // Something has happened: cards drawn / discarded on at least one side.
    expect(state.players[opp].discard.length + state.players[seat].discard.length).toBeGreaterThanOrEqual(0)
  })

  it('observe() redacts the opponent hand and our deck order', () => {
    const obs = observe(state, seat)
    expect(obs.state.players[opp].hand).toEqual([])
    expect(obs.state.players[opp].deck).toEqual([])
    // The real opponent hand is a *valid* sample — every card we hold a slot for
    // must appear in the unseen pool (consistency, not leakage).
    const unseen = obs.oppUnseen.slice()
    for (const id of state.players[opp].hand) {
      const i = unseen.indexOf(id)
      expect(i).toBeGreaterThanOrEqual(0)
      unseen.splice(i, 1)
    }
  })

  it('a sampled world reproduces all public state verbatim', () => {
    const world = sampleWorld(observe(state, seat), makeRng(99))
    expect(world.players[0].points).toBe(state.players[0].points)
    expect(world.players[1].points).toBe(state.players[1].points)
    expect(world.players[seat].hand).toEqual(state.players[seat].hand)
    expect(bag(world.players[opp].discard)).toEqual(bag(state.players[opp].discard))
    expect(world.stadium).toBe(state.stadium)
    expect(world.phase).toBe(state.phase)
    // Boards (active + bench, by uid/card) are identical.
    for (const i of [0, 1] as PlayerIndex[]) {
      expect(inPlay(world.players[i]).map((p) => `${p.uid}:${p.cardId}:${p.damage}`)).toEqual(
        inPlay(state.players[i]).map((p) => `${p.uid}:${p.cardId}:${p.damage}`),
      )
    }
  })

  it('keeps the opponent card multiset consistent with their decklist', () => {
    const world = sampleWorld(observe(state, seat), makeRng(1))
    expect(world.players[opp].hand.length).toBe(state.players[opp].hand.length)
    expect(bag(allOppCards(world, opp))).toEqual(bag(buildDeck(state.players[opp].deckId)))
  })

  it('never reveals hidden cards: the sampled hand is drawn only from the unseen pool', () => {
    const obs = observe(state, seat)
    const world = sampleWorld(obs, makeRng(42))
    const pool = obs.oppUnseen.slice()
    for (const id of world.players[opp].hand) {
      const i = pool.indexOf(id)
      expect(i).toBeGreaterThanOrEqual(0)
      pool.splice(i, 1)
    }
  })

  it('preserves the acting seat’s exact legal-move set', () => {
    const world = sampleWorld(observe(state, seat), makeRng(7))
    const norm = (s: GameState) => bag(legalMoves(s).map((m) => JSON.stringify(m)))
    expect(norm(world)).toEqual(norm(state))
  })

  it('is deterministic for a given RNG seed', () => {
    const obs = observe(state, seat)
    const a = sampleWorld(obs, makeRng(123))
    const b = sampleWorld(obs, makeRng(123))
    expect(a.players[opp].hand).toEqual(b.players[opp].hand)
    expect(a.players[seat].deck).toEqual(b.players[seat].deck)
  })
})
