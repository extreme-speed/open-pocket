import { describe, expect, it } from 'vitest'
import type { GameState, Move } from '../engine/types'
import {
  currentTargeting,
  energyAvailable,
  handSources,
  movesForSource,
  pokemonSources,
  sameSource,
  sourceOf,
  targetUidOf,
} from './selection'

// A minimal stub with just the fields the projection helpers read. Casting keeps
// the tests focused on move→affordance mapping rather than full engine setup.
function stateWith(overrides: Partial<GameState> = {}): GameState {
  return {
    current: 0,
    phase: 'main',
    players: [{ active: { uid: 'self-active' } }, { active: { uid: 'opp-active' } }],
    ...overrides,
  } as unknown as GameState
}

describe('sourceOf', () => {
  const state = stateWith()

  it('maps hand-played cards to their hand card', () => {
    expect(sourceOf(state, { type: 'PlayBasic', cardId: 'c1' })).toEqual({ kind: 'hand', cardId: 'c1' })
    expect(sourceOf(state, { type: 'Evolve', cardId: 'c2', targetUid: 'u' })).toEqual({
      kind: 'hand',
      cardId: 'c2',
    })
    // Rare Candy: the source is the Stage-2 you tap, not the candy.
    expect(
      sourceOf(state, { type: 'RareCandyEvolve', candyId: 'rc', cardId: 'stage2', targetUid: 'u' }),
    ).toEqual({ kind: 'hand', cardId: 'stage2' })
  })

  it('maps energy attachment to the energy zone', () => {
    expect(sourceOf(state, { type: 'AttachEnergy', targetUid: 'u' })).toEqual({ kind: 'energy' })
  })

  it('maps a Pokémon ability to its own Pokémon', () => {
    expect(sourceOf(state, { type: 'UseAbility', sourceUid: 'bench-1' })).toEqual({
      kind: 'pokemon',
      uid: 'bench-1',
    })
  })

  it('maps attacks and retreat to the current Active', () => {
    expect(sourceOf(state, { type: 'Attack', attackIndex: 0 })).toEqual({
      kind: 'pokemon',
      uid: 'self-active',
    })
    expect(sourceOf(state, { type: 'Retreat', benchUid: 'b' })).toEqual({
      kind: 'pokemon',
      uid: 'self-active',
    })
  })

  it('has no board source for phase/bar moves', () => {
    expect(sourceOf(state, { type: 'EndTurn' })).toBeNull()
    expect(sourceOf(state, { type: 'KOReplace', benchUid: 'b' })).toBeNull()
  })
})

describe('targetUidOf', () => {
  it('reads the board target of a move', () => {
    expect(targetUidOf({ type: 'AttachEnergy', targetUid: 'u1' })).toBe('u1')
    expect(targetUidOf({ type: 'Retreat', benchUid: 'b1' })).toBe('b1')
    expect(targetUidOf({ type: 'KOReplace', benchUid: 'b2' })).toBe('b2')
    expect(targetUidOf({ type: 'Attack', attackIndex: 0, targetUid: 'opp' })).toBe('opp')
  })

  it('returns null when there is no single board target', () => {
    expect(targetUidOf({ type: 'EndTurn' })).toBeNull()
    expect(targetUidOf({ type: 'Attack', attackIndex: 0 })).toBeNull()
    // Field Blower's stadium variant is not a board Pokémon.
    expect(targetUidOf({ type: 'PlayItem', cardId: 'fb', fieldBlower: { kind: 'stadium' } })).toBeNull()
  })
})

describe('movesForSource', () => {
  const state = stateWith()
  const moves: Move[] = [
    { type: 'PlayBasic', cardId: 'c1' },
    { type: 'Evolve', cardId: 'c2', targetUid: 'u' },
    { type: 'Attack', attackIndex: 0, targetUid: 'opp-active' },
    { type: 'EndTurn' },
  ]

  it('keeps only the moves a given source can start', () => {
    expect(movesForSource(state, moves, { kind: 'hand', cardId: 'c1' })).toEqual([
      { type: 'PlayBasic', cardId: 'c1' },
    ])
    expect(movesForSource(state, moves, { kind: 'pokemon', uid: 'self-active' })).toEqual([
      { type: 'Attack', attackIndex: 0, targetUid: 'opp-active' },
    ])
  })
})

describe('highlight sets', () => {
  const state = stateWith()
  const moves: Move[] = [
    { type: 'PlayBasic', cardId: 'c1' },
    { type: 'UseAbility', sourceUid: 'bench-1' },
    { type: 'AttachEnergy', targetUid: 'self-active' },
  ]

  it('collects hand, Pokémon, and energy affordances', () => {
    expect(handSources(state, moves)).toEqual(new Set(['c1']))
    expect(pokemonSources(state, moves)).toEqual(new Set(['bench-1']))
    expect(energyAvailable(moves)).toBe(true)
    expect(energyAvailable([{ type: 'EndTurn' }])).toBe(false)
  })
})

describe('sameSource', () => {
  it('compares by kind and identity', () => {
    expect(sameSource({ kind: 'hand', cardId: 'a' }, { kind: 'hand', cardId: 'a' })).toBe(true)
    expect(sameSource({ kind: 'hand', cardId: 'a' }, { kind: 'hand', cardId: 'b' })).toBe(false)
    expect(sameSource({ kind: 'energy' }, { kind: 'energy' })).toBe(true)
    expect(sameSource({ kind: 'pokemon', uid: 'x' }, { kind: 'energy' })).toBe(false)
  })
})

describe('currentTargeting', () => {
  it('derives a forced KO replacement from the phase, ignoring selection', () => {
    const state = stateWith({ phase: 'awaitingKOReplacement' })
    const moves: Move[] = [
      { type: 'KOReplace', benchUid: 'b1' },
      { type: 'KOReplace', benchUid: 'b2' },
    ]
    const t = currentTargeting(state, moves, { kind: 'none' })
    expect(t?.label).toBe('Choose a new Active')
    expect([...t!.byUid.keys()]).toEqual(['b1', 'b2'])
  })

  it('derives the Supporter-discard step as hand-card targets', () => {
    const state = stateWith({ phase: 'awaitingAttackChoice' })
    const moves: Move[] = [{ type: 'AttackChoice', cardId: 'sup1' }]
    const t = currentTargeting(state, moves, { kind: 'none' })
    expect(t?.byHandCard.has('sup1')).toBe(true)
  })

  it('exposes a user-entered targeting selection', () => {
    const state = stateWith()
    const target: Move = { type: 'AttachEnergy', targetUid: 'self-active' }
    const t = currentTargeting(state, [], { kind: 'target', label: 'Attach Energy', moves: [target] })
    expect(t?.label).toBe('Attach Energy')
    expect(t?.byUid.get('self-active')).toEqual(target)
  })

  it('is null when nothing is being targeted', () => {
    expect(currentTargeting(stateWith(), [], { kind: 'none' })).toBeNull()
  })
})
