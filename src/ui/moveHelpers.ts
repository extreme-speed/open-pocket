// Helpers that bridge the engine's flat Move[] to UI affordances: which hand
// cards are playable, which Pokémon are valid targets, etc.

import { getCard } from '../engine/data/cards'
import { actingPlayer } from '../engine/moves'
import { previewAttackDamage } from '../engine/reducer'
import { inPlay, pokemonCard } from '../engine/rules'
import type { EnergyType, GameState, Move } from '../engine/types'

/** Moves that play/consume a given card (by main cardId or Rare Candy's candyId). */
export function movesForCard(moves: readonly Move[], cardId: string): Move[] {
  return moves.filter(
    (m) =>
      ('cardId' in m && m.cardId === cardId) || (m.type === 'RareCandyEvolve' && m.candyId === cardId),
  )
}

export function isCardPlayable(moves: readonly Move[], cardId: string): boolean {
  return movesForCard(moves, cardId).length > 0
}

// --- Action enumeration ------------------------------------------------------
// The engine's legalMoves() is already the full list of valid actions; these
// helpers fold it into the labelled, grouped form the Action Panel renders.

export type ActionSection = 'Setup' | 'Attacks' | 'Abilities' | 'Energy' | 'Play' | 'Field' | 'Turn'

/** One concrete, ready-to-dispatch variant of an action (a specific target). */
export interface ActionOption {
  move: Move
  /** Names the target/variant when the action offers a choice (else null). */
  target: string | null
  /** For attacks: the damage this variant actually lands on its target, with
   *  Weakness and card bonuses folded in (else undefined). */
  damage?: number
}

/** One enumerated action and every target it can be aimed at. The panel renders
 *  each option as its own row, so the player never has to click the board. */
export interface ActionGroup {
  key: string
  section: ActionSection
  label: string
  sub?: string
  cost?: readonly EnergyType[]
  options: ActionOption[]
}

const RANK: Record<ActionSection, number> = {
  Setup: 0,
  Attacks: 1,
  Abilities: 2,
  Energy: 3,
  Play: 4,
  Field: 5,
  Turn: 6,
}

interface Descriptor {
  section: ActionSection
  /** Moves sharing a signature collapse into one action (with multiple targets). */
  sig: string
  label: string
  sub?: string
  cost?: readonly EnergyType[]
}

/** Map a single Move to its human-readable action descriptor. */
function describeMove(state: GameState, move: Move): Descriptor {
  const me = actingPlayer(state)
  const player = me !== null ? state.players[me] : null
  const name = (id: string) => getCard(id).name

  switch (move.type) {
    case 'SetupActive':
      return { section: 'Setup', sig: `sa:${move.cardId}`, label: `Active: ${name(move.cardId)}` }
    case 'SetupBench':
      return { section: 'Setup', sig: `sb:${move.cardId}`, label: `Bench: ${name(move.cardId)}` }
    case 'SetupDone':
      return { section: 'Setup', sig: 'done', label: 'Done placing' }
    case 'KOReplace':
      return { section: 'Setup', sig: 'ko', label: 'Choose new Active', sub: 'from your Bench' }
    case 'PlayBasic':
      return { section: 'Play', sig: `pb:${move.cardId}`, label: name(move.cardId), sub: 'to Bench' }
    case 'Evolve':
      return { section: 'Play', sig: `ev:${move.cardId}`, label: `Evolve → ${name(move.cardId)}` }
    case 'RareCandyEvolve':
      return { section: 'Play', sig: `rc:${move.cardId}`, label: `Rare Candy → ${name(move.cardId)}` }
    case 'AttachTool':
      return { section: 'Play', sig: `tl:${move.cardId}`, label: `Attach ${name(move.cardId)}` }
    case 'PlayItem':
      return { section: 'Play', sig: `it:${move.cardId}`, label: name(move.cardId) }
    case 'PlaySupporter':
      return { section: 'Play', sig: `sp:${move.cardId}`, label: name(move.cardId) }
    case 'PlayStadium':
      return { section: 'Play', sig: `st:${move.cardId}`, label: name(move.cardId) }
    case 'AttachEnergy':
      return { section: 'Energy', sig: 'energy', label: 'Attach Energy' }
    case 'Retreat':
      return { section: 'Field', sig: 'retreat', label: 'Retreat', sub: 'swap your Active' }
    case 'EndTurn':
      return { section: 'Turn', sig: 'end', label: 'End Turn' }
    case 'Attack': {
      const atk = player?.active ? pokemonCard(player.active).attacks[move.attackIndex] : undefined
      return {
        section: 'Attacks',
        sig: `at:${move.attackIndex}`,
        label: atk?.title ?? 'Attack',
        cost: atk?.cost,
      }
    }
    case 'UseAbility': {
      const source = player ? inPlay(player).find((x) => x.uid === move.sourceUid) : undefined
      const ability = source ? pokemonCard(source).ability : null
      return { section: 'Abilities', sig: `ab:${move.sourceUid}`, label: ability?.title ?? 'Ability' }
    }
    case 'AttackChoice':
      // The Supporter-discard step Darkness Claw hands back after it hits.
      return { section: 'Attacks', sig: 'attackchoice', label: 'Discard a Supporter' }
  }
}

interface UidInfo {
  name: string
  active: boolean
  opponent: boolean
}

/** Index every in-play Pokémon by uid, tagged with zone and ownership, so we
 *  can name a move's target without the player having to look at the board. */
function pokemonByUid(state: GameState): Map<string, UidInfo> {
  const acting = actingPlayer(state)
  const map = new Map<string, UidInfo>()
  state.players.forEach((p, idx) => {
    const opponent = acting !== null && idx !== acting
    if (p.active) map.set(p.active.uid, { name: getCard(p.active.cardId).name, active: true, opponent })
    for (const b of p.bench) map.set(b.uid, { name: getCard(b.cardId).name, active: false, opponent })
  })
  return map
}

function uidLabel(map: Map<string, UidInfo>, uid: string): string | null {
  const info = map.get(uid)
  if (!info) return null
  return `${info.opponent ? 'Opp. ' : ''}${info.name}${info.active ? ' (Active)' : ''}`
}

/** A human label for the specific target/variant a move resolves to. */
function targetLabel(map: Map<string, UidInfo>, move: Move): string | null {
  switch (move.type) {
    case 'Retreat':
      return uidLabel(map, move.benchUid)
    case 'KOReplace':
      return uidLabel(map, move.benchUid)
    case 'Attack':
      return move.targetUid ? uidLabel(map, move.targetUid) : null
    case 'AttackChoice':
      return getCard(move.cardId).name
    case 'PlayItem':
      if (move.fieldBlower?.kind === 'stadium') return 'the Stadium'
      if (move.fieldBlower?.kind === 'tool') return uidLabel(map, move.fieldBlower.uid)
      return move.targetUid ? uidLabel(map, move.targetUid) : null
    default:
      return 'targetUid' in move && move.targetUid ? uidLabel(map, move.targetUid) : null
  }
}

/** Every legal action, labelled and grouped — the Action Panel's data source.
 *  Each group carries one option per concrete target, all directly dispatchable. */
export function groupActions(state: GameState, moves: readonly Move[]): ActionGroup[] {
  const targets = pokemonByUid(state)
  const bySig = new Map<string, ActionGroup>()
  for (const move of moves) {
    const d = describeMove(state, move)
    const damage = previewAttackDamage(state, move) ?? undefined
    const option: ActionOption = { move, target: targetLabel(targets, move), damage }
    const existing = bySig.get(d.sig)
    if (existing) existing.options.push(option)
    else
      bySig.set(d.sig, {
        key: d.sig,
        section: d.section,
        label: d.label,
        sub: d.sub,
        cost: d.cost,
        options: [option],
      })
  }
  return [...bySig.values()].sort((a, b) => RANK[a.section] - RANK[b.section])
}
