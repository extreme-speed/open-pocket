// Tap-to-act selection model. The engine's legalMoves() already enumerates every
// valid action with its concrete target; these helpers re-project that flat list
// onto the board so the player taps a source (hand card / Pokémon / energy) and
// then, when an action needs a choice, taps a highlighted target.
//
// Nothing here mutates engine state — it only decides which board elements are
// actionable and which Move a given tap should dispatch.

import type { GameState, InPlayPokemon, Move } from '../engine/types'

/** The board element a player taps to *begin* an action. */
export type Source =
  | { kind: 'hand'; cardId: string }
  | { kind: 'pokemon'; uid: string }
  | { kind: 'energy' }

/** Transient UI selection state (never persisted; cleared on every dispatch). */
export type Selection =
  | { kind: 'none' }
  // An action that needs a choice was picked; the board highlights `targets`.
  | { kind: 'target'; label: string; moves: Move[] }

export const NO_SELECTION: Selection = { kind: 'none' }

/** A card opened in the enlarged preview. `cards` is everything browsable with
 *  the ‹ › arrows — an in-play Pokémon's evolution stack plus its attached tool;
 *  a single card otherwise. `index` is the card on show, `mainIndex` the one the
 *  actions belong to (the current top card). When `source` is set and that main
 *  card is showing, the preview lists its actions underneath. */
export interface Preview {
  cards: string[]
  index: number
  mainIndex: number
  source: Source | null
}

/** Find an in-play Pokémon by uid in either player's Active/Bench. */
export function findInPlay(state: GameState, uid: string): InPlayPokemon | null {
  for (const p of state.players) {
    if (p.active?.uid === uid) return p.active
    const b = p.bench.find((x) => x.uid === uid)
    if (b) return b
  }
  return null
}

/** The card ids browsable when previewing a Pokémon: its evolution stack
 *  (Basic → current) followed by any attached tool. */
export function previewCardsFor(pkm: InPlayPokemon): string[] {
  return [...pkm.stack, ...(pkm.tool ? [pkm.tool] : [])]
}

export function sameSource(a: Source, b: Source): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'hand' && b.kind === 'hand') return a.cardId === b.cardId
  if (a.kind === 'pokemon' && b.kind === 'pokemon') return a.uid === b.uid
  return a.kind === 'energy' && b.kind === 'energy'
}

/** The in-play Pokémon a move resolves against (so a tap on the board can play
 *  it). Returns null for moves that have no single board target. */
export function targetUidOf(move: Move): string | null {
  switch (move.type) {
    case 'Evolve':
    case 'RareCandyEvolve':
    case 'AttachTool':
    case 'AttachEnergy':
      return move.targetUid
    case 'UseAbility':
    case 'Attack':
    case 'PlaySupporter':
      return move.targetUid ?? null
    case 'PlayItem':
      // Field Blower's stadium/tool variants aren't a plain board target; they
      // surface as explicit menu rows instead (see ActionBar).
      if (move.fieldBlower) return move.fieldBlower.kind === 'tool' ? move.fieldBlower.uid : null
      return move.targetUid ?? null
    case 'Retreat':
    case 'KOReplace':
      return move.benchUid
    default:
      return null
  }
}

/** The board element you tap to start `move` (null = a phase/bar action with no
 *  board source, e.g. EndTurn, SetupDone, KOReplace, AttackChoice). */
export function sourceOf(state: GameState, move: Move): Source | null {
  switch (move.type) {
    case 'SetupActive':
    case 'SetupBench':
    case 'PlayBasic':
    case 'Evolve':
    case 'RareCandyEvolve':
    case 'AttachTool':
    case 'PlayItem':
    case 'PlaySupporter':
    case 'PlayStadium':
      return { kind: 'hand', cardId: move.cardId }
    case 'AttachEnergy':
      return { kind: 'energy' }
    case 'UseAbility':
      return { kind: 'pokemon', uid: move.sourceUid }
    case 'Attack':
    case 'Retreat': {
      const active = state.players[state.current].active
      return active ? { kind: 'pokemon', uid: active.uid } : null
    }
    default:
      return null
  }
}

/** Every move that the given source can initiate. */
export function movesForSource(state: GameState, moves: readonly Move[], source: Source): Move[] {
  return moves.filter((m) => {
    const s = sourceOf(state, m)
    return s !== null && sameSource(s, source)
  })
}

// --- Highlight sets (drive the rings when nothing is selected) ---------------

/** Hand card ids that can start at least one action. */
export function handSources(state: GameState, moves: readonly Move[]): Set<string> {
  const set = new Set<string>()
  for (const m of moves) {
    const s = sourceOf(state, m)
    if (s?.kind === 'hand') set.add(s.cardId)
  }
  return set
}

/** In-play Pokémon uids that have an action of their own (ability/attack/retreat). */
export function pokemonSources(state: GameState, moves: readonly Move[]): Set<string> {
  const set = new Set<string>()
  for (const m of moves) {
    const s = sourceOf(state, m)
    if (s?.kind === 'pokemon') set.add(s.uid)
  }
  return set
}

export function energyAvailable(moves: readonly Move[]): boolean {
  return moves.some((m) => m.type === 'AttachEnergy')
}

// --- Targeting ---------------------------------------------------------------

/** The active targeting step: which board uids / hand cards are valid taps, and
 *  the Move each one dispatches. */
export interface Targeting {
  label: string
  /** Board Pokémon targets, keyed by uid. */
  byUid: Map<string, Move>
  /** Hand-card targets (the Darkness Claw "discard a Supporter" step). */
  byHandCard: Map<string, Move>
}

function buildTargeting(label: string, moves: readonly Move[]): Targeting {
  const byUid = new Map<string, Move>()
  const byHandCard = new Map<string, Move>()
  for (const m of moves) {
    if (m.type === 'AttackChoice') byHandCard.set(m.cardId, m)
    else {
      const uid = targetUidOf(m)
      if (uid !== null) byUid.set(uid, m)
    }
  }
  return { label, byUid, byHandCard }
}

/**
 * The targeting step currently in effect, or null if the player isn't choosing a
 * target. Forced mid-resolution choices (replace a KO'd Active, discard a
 * Supporter) are derived straight from the phase, so they don't depend on the
 * transient `selection`.
 */
export function currentTargeting(
  state: GameState,
  moves: readonly Move[],
  selection: Selection,
): Targeting | null {
  if (state.phase === 'awaitingKOReplacement') {
    return buildTargeting('Choose a new Active', moves)
  }
  if (state.phase === 'awaitingAttackChoice') {
    return buildTargeting('Discard a Supporter', moves)
  }
  if (selection.kind === 'target') return buildTargeting(selection.label, selection.moves)
  return null
}
