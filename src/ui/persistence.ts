// Save/resume: the GameState is plain JSON-serializable data (the RNG is just a
// numeric seed), so a game round-trips through localStorage losslessly. We persist
// the engine state plus the small amount of view state worth keeping (perspective,
// log); `moves` is recomputed on resume.

import type { GameState, PlayerIndex } from '../engine/types'

const STORAGE_KEY = 'open-pocket:save'
const VERSION = 1

export interface SavedGame {
  version: number
  state: GameState
  log: string[]
  viewPerspective: PlayerIndex
}

export type GameSnapshot = Omit<SavedGame, 'version'>

/** localStorage, or null when unavailable (SSR, private mode, disabled). */
function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function saveGame(snapshot: GameSnapshot): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...snapshot }))
  } catch {
    // Ignore quota / serialization failures — a lost save isn't fatal.
  }
}

export function loadGame(): SavedGame | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedGame>
    if (parsed.version !== VERSION || !parsed.state) return null
    return parsed as SavedGame
  } catch {
    return null
  }
}

export function clearGame(): void {
  const s = storage()
  if (!s) return
  try {
    s.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}

// Deck-select preferences: remember the last decks and first-player choice so the
// setup screen comes back the way the player left it. Kept separate from the saved
// game so it survives across matches (and discarding one).
const DECK_SELECTION_KEY = 'open-pocket:deck-select'

export interface DeckSelection {
  deckA: string
  deckB: string
  first: 'random' | PlayerIndex
}

export function saveDeckSelection(sel: DeckSelection): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(DECK_SELECTION_KEY, JSON.stringify(sel))
  } catch {
    // Ignore — a forgotten preference isn't fatal.
  }
}

export function loadDeckSelection(): DeckSelection | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(DECK_SELECTION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DeckSelection>
    if (typeof parsed.deckA !== 'string' || typeof parsed.deckB !== 'string') return null
    const first = parsed.first === 0 || parsed.first === 1 ? parsed.first : 'random'
    return { deckA: parsed.deckA, deckB: parsed.deckB, first }
  } catch {
    return null
  }
}
