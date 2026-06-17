// Zustand store: holds the engine GameState and the derived legalMoves that the
// Action Panel renders.
//
// The engine stays pure — the store only calls applySteps()/legalMoves() and
// keeps React-facing view state (perspective, card preview, log).
// A move resolves in full on dispatch; applySteps gives per-event snapshots so
// the log can name Pokémon that were KO'd mid-resolution.

import { create } from 'zustand'
import { legalMoves, actingPlayer } from '../engine/moves'
import { applySteps, type Frame } from '../engine/reducer'
import { pokemonCard } from '../engine/rules'
import { createGame, type NewGameOptions } from '../engine/setup'
import type { GameEvent, GameState, Move, PlayerIndex } from '../engine/types'
import { clearGame, loadGame, saveGame } from './persistence'
import { NO_SELECTION, type Preview, type Selection, type Source } from './selection'

/** A snapshot taken before each move so it can be undone. The engine state is
 *  self-contained (RNG seed included), so restoring one fully rewinds the game. */
interface HistoryEntry {
  state: GameState
  log: string[]
  viewPerspective: PlayerIndex
}

/** How many moves back the player can undo (bounds memory on long games). */
const MAX_HISTORY = 50

/** How many log lines to retain — enough to read the whole game in the viewer. */
const MAX_LOG = 500

/** A transient damage/heal animation cue, derived from the last dispatch's events. */
export interface Fx {
  /** Unique, monotonic — used as a React key so each cue re-triggers its animation. */
  key: number
  uid: string
  kind: 'damage' | 'heal'
  amount: number
}

export interface GameStore {
  state: GameState | null
  moves: Move[]
  log: string[]
  viewPerspective: PlayerIndex
  /** The card currently shown enlarged (for reading, and acting if it can). */
  preview: Preview | null
  /** Whose discard pile is open in the discard modal, or null when closed. */
  discardView: PlayerIndex | null
  /** Damage/heal cues from the most recent dispatch (cleared on the next one). */
  fx: Fx[]
  /** Pre-move snapshots, oldest first; the last is what undo() restores. */
  history: HistoryEntry[]
  /** Tap-to-act selection: which source/target the player is choosing. */
  selection: Selection

  start: (deckA: string, deckB: string, opts?: NewGameOptions) => void
  dispatch: (move: Move) => void
  /** Rewind the most recent move. No-op when there is nothing to undo. */
  undo: () => void
  /** Enter target-picking for an action that needs a choice. */
  enterTargeting: (label: string, moves: Move[]) => void
  /** Clear any in-progress selection (back to nothing chosen). */
  cancelSelection: () => void
  /** Show a single card enlarged (optionally as an actionable source), or null to
   *  dismiss. */
  setPreview: (cardId: string | null, source?: Source | null) => void
  /** Show a browsable set of cards (an evolution stack + tool), opened at `index`. */
  openPreview: (cards: string[], index: number, source: Source | null) => void
  /** Step the open preview through its cards (clamped to the ends). */
  previewStep: (delta: number) => void
  /** Open a player's discard pile in the discard modal, or null to close. */
  setDiscardView: (owner: PlayerIndex | null) => void
  /** Discard the in-progress game and its saved snapshot. */
  abandon: () => void
}

/** The display name of the Pokémon with `uid`, found in either player's field. */
function nameOf(state: GameState, uid: string): string {
  for (const p of state.players) {
    for (const pk of [p.active, ...p.bench]) {
      if (pk && pk.uid === uid) return pokemonCard(pk).name
    }
  }
  // The Pokémon has already left play (e.g. read after removal) — fall back.
  return 'Pokémon'
}

/** A human-readable log line for an event, resolved against the state at that
 *  beat (so KO'd Pokémon can still be named). Returns null for events with no
 *  line of their own. */
function describe(e: GameEvent, state: GameState): string | null {
  switch (e.type) {
    case 'flip':
      return `Coin flip: ${e.result ? 'heads' : 'tails'}${e.reason ? ` (${e.reason})` : ''}`
    case 'damage':
      return `${nameOf(state, e.uid)} takes ${e.amount} damage`
    case 'heal':
      return `${nameOf(state, e.uid)} heals ${e.amount}`
    case 'status':
      return `${nameOf(state, e.uid)} is now ${e.status}`
    case 'ko':
      return `${nameOf(state, e.uid)} is Knocked Out! (+${e.points})`
    case 'points':
      return `Player ${e.player + 1}: ${e.total} point(s)`
    case 'energyAttached':
      return `${e.energy} Energy → ${nameOf(state, e.uid)}`
    case 'draw':
      return `Player ${e.player + 1} draws ${e.count}`
    case 'turnStart':
      return `— Turn ${e.turn}: Player ${e.player + 1} —`
    case 'gameOver':
      return e.winner === null ? 'Game over — draw (turn limit)' : `Game over — Player ${e.winner + 1} wins!`
    case 'info':
      return e.message
    default:
      return null
  }
}

function perspectiveOf(state: GameState): PlayerIndex {
  return actingPlayer(state) ?? state.current
}

let fxKey = 0

/** Collapse a dispatch's frames into one damage/heal cue per affected Pokémon. */
function cuesFromFrames(frames: Frame[]): Fx[] {
  const damage = new Map<string, number>()
  const heal = new Map<string, number>()
  for (const { event: e } of frames) {
    if (e.type === 'damage') damage.set(e.uid, (damage.get(e.uid) ?? 0) + e.amount)
    else if (e.type === 'heal') heal.set(e.uid, (heal.get(e.uid) ?? 0) + e.amount)
  }
  const fx: Fx[] = []
  for (const [uid, amount] of damage) fx.push({ key: fxKey++, uid, kind: 'damage', amount })
  // A Pokémon healed and damaged in the same dispatch is rare; show the net heal.
  for (const [uid, amount] of heal) {
    if (!damage.has(uid)) fx.push({ key: fxKey++, uid, kind: 'heal', amount })
  }
  return fx
}

// Eager hydration: a refresh on /game (or returning from deck select) restores
// the in-progress game. `moves` is recomputed rather than persisted.
const saved = loadGame()

export const useGame = create<GameStore>((set, get) => {
  function persist(): void {
    const { state, log, viewPerspective } = get()
    if (state) saveGame({ state, log, viewPerspective })
  }

  return {
    state: saved?.state ?? null,
    moves: saved ? legalMoves(saved.state) : [],
    log: saved?.log ?? [],
    viewPerspective: saved?.viewPerspective ?? 0,
    preview: null,
    discardView: null,
    fx: [],
    history: [],
    selection: NO_SELECTION,

    start(deckA, deckB, opts) {
      const state = createGame(deckA, deckB, opts)
      set({
        state,
        moves: legalMoves(state),
        log: [],
        viewPerspective: perspectiveOf(state),
        preview: null,
        discardView: null,
        fx: [],
        history: [],
        selection: NO_SELECTION,
      })
      persist()
    },

    dispatch(move) {
      const { state: current, log, viewPerspective, history } = get()
      if (!current) return
      const { state, frames } = applySteps(current, move)
      // Build log lines from each event against the state at that beat, so a
      // Pokémon KO'd mid-resolution is still named correctly.
      const lines = frames.map((f) => describe(f.event, f.state)).filter((l): l is string => l !== null)
      set({
        state,
        moves: legalMoves(state),
        viewPerspective: perspectiveOf(state),
        preview: null,
        discardView: null,
        fx: cuesFromFrames(frames),
        log: [...log, ...lines].slice(-MAX_LOG),
        // Snapshot the pre-move state so this move can be undone.
        history: [...history, { state: current, log, viewPerspective }].slice(-MAX_HISTORY),
        selection: NO_SELECTION,
      })
      persist()
    },

    undo() {
      const { history } = get()
      const previous = history[history.length - 1]
      if (!previous) return
      set({
        state: previous.state,
        moves: legalMoves(previous.state),
        log: previous.log,
        viewPerspective: previous.viewPerspective,
        preview: null,
        discardView: null,
        fx: [],
        history: history.slice(0, -1),
        selection: NO_SELECTION,
      })
      persist()
    },

    enterTargeting(label, moves) {
      set({ selection: { kind: 'target', label, moves } })
    },

    cancelSelection() {
      set({ selection: NO_SELECTION })
    },

    setPreview(cardId, source = null) {
      set({ preview: cardId === null ? null : { cards: [cardId], index: 0, mainIndex: 0, source } })
    },

    openPreview(cards, index, source) {
      if (cards.length === 0) return
      const i = Math.max(0, Math.min(cards.length - 1, index))
      set({ preview: { cards, index: i, mainIndex: i, source } })
    },

    previewStep(delta) {
      const { preview } = get()
      if (!preview) return
      const index = Math.max(0, Math.min(preview.cards.length - 1, preview.index + delta))
      set({ preview: { ...preview, index } })
    },

    setDiscardView(owner) {
      set({ discardView: owner })
    },

    abandon() {
      clearGame()
      set({
        state: null,
        moves: [],
        log: [],
        preview: null,
        discardView: null,
        fx: [],
        history: [],
        selection: NO_SELECTION,
      })
    },
  }
})
