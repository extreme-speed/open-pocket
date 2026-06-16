// Core card + game type definitions for the Open Pocket engine.
// Card data is normalized from deckgym-core's database.json (see scripts/build-card-db.ts).

import type { RngState } from './rng'

export type EnergyType =
  | 'Grass'
  | 'Fire'
  | 'Water'
  | 'Lightning'
  | 'Psychic'
  | 'Fighting'
  | 'Darkness'
  | 'Metal'
  | 'Dragon'
  | 'Colorless'

export type TrainerType = 'Supporter' | 'Item' | 'Tool' | 'Stadium'

export interface Attack {
  title: string
  /** Energy required, as a list of types (e.g. ['Fire', 'Fire', 'Colorless']). */
  cost: EnergyType[]
  /** Base ("fixed") damage before modifiers; 0 for effect-only attacks. */
  damage: number
  /** Raw effect text from the card, or null for a vanilla damage attack. */
  effect: string | null
}

export interface Ability {
  title: string
  effect: string
}

export interface PokemonCard {
  kind: 'pokemon'
  /** deckgym id, zero-padded, e.g. "B1 036". */
  id: string
  set: string
  number: number
  name: string
  /** 0 = Basic, 1 = Stage 1, 2 = Stage 2. */
  stage: number
  evolvesFrom: string | null
  /** Name of the root Basic of this evolution line (equals `name` for Basics). Used by Rare Candy. */
  basicName: string
  hp: number
  energyType: EnergyType
  ability: Ability | null
  attacks: Attack[]
  weakness: EnergyType | null
  /** Number of Colorless energy needed to retreat. */
  retreatCost: number
  isEx: boolean
  isMega: boolean
  rarity: string
  /** Public path to the card art, e.g. "/cards/B1_036.webp". */
  image: string
}

export interface TrainerCard {
  kind: 'trainer'
  id: string
  set: string
  number: number
  name: string
  trainerType: TrainerType
  effect: string
  rarity: string
  image: string
}

export type Card = PokemonCard | TrainerCard

/** A normalized card database keyed by deckgym id. */
export type CardDatabase = Record<string, Card>

export interface DeckCardRef {
  id: string
  count: number
}

export interface Deck {
  id: string
  title: string
  energyTypes: EnergyType[]
  cards: DeckCardRef[]
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

/** Special conditions. Only Burn is inflicted by our 30 cards, but the
 *  between-turns checkup handles the others for completeness. */
export type Status = 'poisoned' | 'burned' | 'asleep' | 'paralyzed' | 'confused'

export type PlayerIndex = 0 | 1

/** A Pokémon as it exists on the mat (one card, plus its evolution stack). */
export interface InPlayPokemon {
  /** Stable instance id, unique within a game. */
  uid: string
  /** The current top (active) card of this Pokémon. */
  cardId: string
  /** Evolution stack, Basic first … current last (for KO discard / devolve). */
  stack: string[]
  damage: number
  attachedEnergy: EnergyType[]
  /** Attached Pokémon Tool card id, if any. */
  tool: string | null
  status: Status[]
  /** Turn number on which this Pokémon was put into play (0 = during setup). */
  playedTurn: number
  /** True if this Pokémon evolved this turn (can't evolve twice / attack-block n/a). */
  evolvedThisTurn: boolean
  /** True once this Pokémon's activated ability was used this turn. */
  abilityUsedThisTurn: boolean
  /** True the turn this Pokémon entered the Bench (for on-enter abilities). */
  enteredBenchThisTurn: boolean
  /** Set by Magnezone's Mirror Shot: next turn, this Pokémon must flip heads to
   *  attack or the attack fails. Cleared at the end of its controller's turn. */
  mustFlipToAttack: boolean
}

export interface PlayerState {
  deckId: string
  registeredEnergy: EnergyType[]
  active: InPlayPokemon | null
  bench: InPlayPokemon[]
  hand: string[]
  deck: string[]
  discard: string[]
  /** Energy that has been discarded from this player's Pokémon (Pocket has no
   *  energy cards, so this is tracked separately from the card `discard`). Fed by
   *  attack costs that discard Energy; drained by cards like Flame Patch that
   *  recover Energy "from your discard pile". */
  discardedEnergy: EnergyType[]
  points: number
  /** Energy generated into the Energy Zone this turn, available to attach once. */
  currentEnergy: EnergyType | null
  energyAttachedThisTurn: boolean
  retreatedThisTurn: boolean
  supporterPlayedThisTurn: boolean
  /** True only while choosing the opening Active/Bench during setup. */
  setupDone: boolean
}

export type Phase = 'setup' | 'main' | 'awaitingKOReplacement' | 'awaitingAttackChoice' | 'gameOver'

/** What to resume once all pending KO replacements have been chosen. */
export type Flow = 'continueMain' | 'endTurn' | 'beginNextTurn'

/** A choice an attack hands back to the attacker mid-resolution — e.g. Mega
 *  Absol ex's Darkness Claw revealing the opponent's hand to discard a Supporter.
 *  Held on the state while `phase === 'awaitingAttackChoice'`; the turn does not
 *  end until it's resolved. */
export interface PendingAttackChoice {
  /** Discard one of `cardIds` from the opponent's revealed hand. */
  kind: 'discardFromOpponentHand'
  /** The player who must choose (the attacker). */
  chooser: PlayerIndex
  /** The candidate card ids to choose among (deduped). */
  cardIds: string[]
}

export interface GameState {
  turn: number
  current: PlayerIndex
  firstPlayer: PlayerIndex
  phase: Phase
  players: [PlayerState, PlayerState]
  /** Shared in-play Stadium card id, or null. */
  stadium: string | null
  stadiumOwner: PlayerIndex | null
  /** Players (by index) who must promote a new Active after a KO, in order. */
  koReplacements: PlayerIndex[]
  /** Continuation after the koReplacements queue drains. */
  pendingFlow: Flow | null
  /** A mid-attack choice the attacker still owes (else null). Set while
   *  `phase === 'awaitingAttackChoice'`. */
  pendingAttackChoice: PendingAttackChoice | null
  rng: RngState
  winner: PlayerIndex | null
  /** Monotonic counter for minting InPlayPokemon uids. */
  uidCounter: number
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export type Move =
  // setup phase
  | { type: 'SetupActive'; cardId: string }
  | { type: 'SetupBench'; cardId: string }
  | { type: 'SetupDone' }
  // main phase
  | { type: 'PlayBasic'; cardId: string }
  | { type: 'Evolve'; cardId: string; targetUid: string }
  | { type: 'RareCandyEvolve'; candyId: string; cardId: string; targetUid: string }
  | { type: 'AttachEnergy'; targetUid: string }
  | { type: 'AttachTool'; cardId: string; targetUid: string }
  | { type: 'PlayItem'; cardId: string; targetUid?: string; fieldBlower?: FieldBlowerTarget }
  | { type: 'PlaySupporter'; cardId: string; targetUid?: string }
  | { type: 'PlayStadium'; cardId: string }
  | { type: 'Retreat'; benchUid: string }
  | { type: 'UseAbility'; sourceUid: string; targetUid?: string }
  | { type: 'Attack'; attackIndex: number; targetUid?: string }
  | { type: 'EndTurn' }
  // KO replacement phase
  | { type: 'KOReplace'; benchUid: string }
  // mid-attack choice phase (e.g. Darkness Claw's Supporter discard)
  | { type: 'AttackChoice'; cardId: string }

export type MoveType = Move['type']

/** Field Blower discards one Tool from a chosen Pokémon, or the Stadium. */
export type FieldBlowerTarget =
  | { kind: 'tool'; uid: string }
  | { kind: 'stadium' }

// ---------------------------------------------------------------------------
// Events (emitted by the reducer for the UI log / animations)
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: 'damage'; uid: string; amount: number }
  | { type: 'heal'; uid: string; amount: number }
  | { type: 'ko'; uid: string; owner: PlayerIndex; points: number }
  | { type: 'status'; uid: string; status: Status }
  | { type: 'draw'; player: PlayerIndex; count: number }
  | { type: 'energyAttached'; uid: string; energy: EnergyType }
  | { type: 'points'; player: PlayerIndex; total: number }
  | { type: 'turnStart'; player: PlayerIndex; turn: number }
  | { type: 'gameOver'; winner: PlayerIndex }
  | { type: 'flip'; result: boolean; reason?: string }
  | { type: 'info'; message: string }
