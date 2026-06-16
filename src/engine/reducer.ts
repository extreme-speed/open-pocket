// apply(state, move) -> { state, events }: the single pure transition function.
//
// Strategy: structuredClone the state up front, then mutate the clone freely
// (including the RNG). Card-specific logic lives in effects/*; this file owns the
// turn structure, energy/evolution mechanics, KO resolution, and end-of-turn flow.

import { getCard } from './data/cards'
import { HIKING_TRAIL, ROCKY_HELMET } from './data/ids'
import { pickRandom } from './rng'
import { inPlay, isKnockedOut, other, pointsFor, pokemonCard, retreatCost } from './rules'
import { POINTS_TO_WIN } from './setup'
import { makeContext } from './effects/context'
import {
  activatedAbilities,
  getAttackHandler,
  getCheckupAbility,
  getEndOfTurnAbility,
  getTrainer,
} from './effects/registry'
import { discardStadium } from './effects/trainers'
import type {
  Flow,
  GameEvent,
  GameState,
  InPlayPokemon,
  Move,
  PlayerIndex,
  PlayerState,
} from './types'

export interface ApplyResult {
  state: GameState
  events: GameEvent[]
}

export function apply(state: GameState, move: Move): ApplyResult {
  const s: GameState = structuredClone(state)
  const events: GameEvent[] = []
  reduce(s, events, move)
  return { state: s, events }
}

/** A single beat of resolution: one event, plus a snapshot of the game state at
 *  the instant that event fired. The UI plays these back one at a time so the
 *  board shows the hit *before* the faint, the flip before the damage, etc. */
export interface Frame {
  event: GameEvent
  state: GameState
}

export interface SteppedResult extends ApplyResult {
  frames: Frame[]
}

/**
 * Like `apply`, but also records a state snapshot at every event. Same pure
 * transition (the returned `state`/`events` match `apply` exactly) — it just
 * watches the events array so the store can step through the resolution.
 */
export function applySteps(state: GameState, move: Move): SteppedResult {
  const s: GameState = structuredClone(state)
  const frames: Frame[] = []
  const events: GameEvent[] = []
  const push = events.push.bind(events)
  // Snapshot `s` as each event is pushed (events fire right after their mutation,
  // so the snapshot reflects the board at that beat). The override is a temporary
  // own-property on the array; remove it afterwards so the returned `events` is a
  // plain Array indistinguishable from apply()'s.
  events.push = (...items: GameEvent[]): number => {
    for (const e of items) frames.push({ event: e, state: structuredClone(s) })
    return push(...items)
  }
  reduce(s, events, move)
  delete (events as { push?: unknown }).push
  return { state: s, events, frames }
}

// ---------------------------------------------------------------------------
// In-play Pokémon helpers
// ---------------------------------------------------------------------------

function mintUid(s: GameState): string {
  return `pk${s.uidCounter++}`
}

function newInPlay(s: GameState, cardId: string, playedTurn: number, enteredBench: boolean): InPlayPokemon {
  return {
    uid: mintUid(s),
    cardId,
    stack: [cardId],
    damage: 0,
    attachedEnergy: [],
    tool: null,
    status: [],
    playedTurn,
    evolvedThisTurn: false,
    abilityUsedThisTurn: false,
    enteredBenchThisTurn: enteredBench,
    mustFlipToAttack: false,
  }
}

function removeFromHand(p: PlayerState, cardId: string): boolean {
  const i = p.hand.indexOf(cardId)
  if (i < 0) return false
  p.hand.splice(i, 1)
  return true
}

function findInPlayOf(p: PlayerState, uid: string): InPlayPokemon | null {
  return inPlay(p).find((x) => x.uid === uid) ?? null
}

/** Evolve `target` by stacking `cardId`; evolving cures all Special Conditions. */
function evolveInto(target: InPlayPokemon, cardId: string): void {
  target.stack.push(cardId)
  target.cardId = cardId
  target.evolvedThisTurn = true
  target.status = []
}

// ---------------------------------------------------------------------------
// Top-level dispatch
// ---------------------------------------------------------------------------

function reduce(s: GameState, events: GameEvent[], move: Move): void {
  switch (move.type) {
    case 'SetupActive':
    case 'SetupBench':
    case 'SetupDone':
      return setupMove(s, events, move)
    case 'KOReplace':
      return koReplace(s, events, move)
    case 'AttackChoice':
      return attackChoice(s, events, move)
    default:
      return mainMove(s, events, move)
  }
}

// ---------------------------------------------------------------------------
// Setup phase
// ---------------------------------------------------------------------------

function setupMove(s: GameState, events: GameEvent[], move: Move): void {
  if (s.phase !== 'setup') return
  const placing = s.players.findIndex((p) => !p.setupDone)
  if (placing < 0) return
  const p = s.players[placing]

  if (move.type === 'SetupActive') {
    if (p.active || !removeFromHand(p, move.cardId)) return
    p.active = newInPlay(s, move.cardId, 0, false)
    return
  }
  if (move.type === 'SetupBench') {
    if (p.bench.length >= 3 || !removeFromHand(p, move.cardId)) return
    p.bench.push(newInPlay(s, move.cardId, 0, false))
    return
  }
  // SetupDone
  if (!p.active) return
  p.setupDone = true
  if (s.players.every((pl) => pl.setupDone)) {
    beginTurn(s, events, s.firstPlayer, 1)
  }
}

// ---------------------------------------------------------------------------
// Main phase
// ---------------------------------------------------------------------------

function mainMove(s: GameState, events: GameEvent[], move: Move): void {
  if (s.phase !== 'main') return
  const me = s.current
  const p = s.players[me]

  switch (move.type) {
    case 'PlayBasic': {
      if (p.bench.length >= 3 || !removeFromHand(p, move.cardId)) return
      p.bench.push(newInPlay(s, move.cardId, s.turn, true))
      return
    }

    case 'Evolve': {
      const target = findInPlayOf(p, move.targetUid)
      if (!target || !removeFromHand(p, move.cardId)) return
      evolveInto(target, move.cardId)
      return
    }

    case 'RareCandyEvolve': {
      const target = findInPlayOf(p, move.targetUid)
      if (!target) return
      if (!removeFromHand(p, move.candyId)) return
      if (!removeFromHand(p, move.cardId)) {
        p.hand.push(move.candyId) // undo: shouldn't happen via legalMoves
        return
      }
      p.discard.push(move.candyId)
      evolveInto(target, move.cardId)
      return
    }

    case 'AttachEnergy': {
      if (p.energyAttachedThisTurn || p.currentEnergy === null) return
      const target = findInPlayOf(p, move.targetUid)
      if (!target) return
      target.attachedEnergy.push(p.currentEnergy)
      events.push({ type: 'energyAttached', uid: target.uid, energy: p.currentEnergy })
      p.energyAttachedThisTurn = true
      p.currentEnergy = null
      return
    }

    case 'AttachTool': {
      const target = findInPlayOf(p, move.targetUid)
      if (!target || target.tool || !removeFromHand(p, move.cardId)) return
      target.tool = move.cardId
      return
    }

    case 'PlayItem':
    case 'PlaySupporter':
      return playTrainer(s, events, move)

    case 'PlayStadium': {
      if (!removeFromHand(p, move.cardId)) return
      discardStadium(s, events)
      s.stadium = move.cardId
      s.stadiumOwner = me
      return
    }

    case 'Retreat': {
      if (p.retreatedThisTurn || !p.active) return
      const idx = p.bench.findIndex((b) => b.uid === move.benchUid)
      if (idx < 0) return
      const cost = retreatCost(s, me)
      if (p.active.attachedEnergy.length < cost) return
      // Paying the retreat cost discards that many Energy from the Active.
      p.discardedEnergy.push(...p.active.attachedEnergy.splice(0, cost))
      const incoming = p.bench.splice(idx, 1)[0]
      p.active.status = [] // leaving the Active Spot clears Special Conditions
      p.bench.push(p.active)
      p.active = incoming
      p.retreatedThisTurn = true
      return
    }

    case 'UseAbility':
      return useAbility(s, events, move)

    case 'Attack':
      return attack(s, events, move)

    case 'EndTurn':
      return endTurnSequence(s, events)
  }
}

function playTrainer(s: GameState, events: GameEvent[], move: Move): void {
  if (move.type !== 'PlayItem' && move.type !== 'PlaySupporter') return
  const me = s.current
  const p = s.players[me]
  const desc = getTrainer(move.cardId)
  if (!desc || !desc.playable(s, me)) return
  if (move.type === 'PlaySupporter' && p.supporterPlayedThisTurn) return
  if (!removeFromHand(p, move.cardId)) return

  const ctx = makeContext(s, events, me)
  desc.run(ctx, move)

  if (move.type === 'PlaySupporter') p.supporterPlayedThisTurn = true
  if (ctx.keepPlayedCard) p.hand.push(move.cardId)
  else p.discard.push(move.cardId)

  resolveKOs(s, events)
  enterReplacementOr(s, 'continueMain')
}

function useAbility(s: GameState, events: GameEvent[], move: Move): void {
  if (move.type !== 'UseAbility') return
  const me = s.current
  const p = s.players[me]
  const source = findInPlayOf(p, move.sourceUid)
  if (!source) return
  const ability = activatedAbilities[source.cardId]
  if (!ability || ability.enumerate(s, source, me).length === 0) return

  const ctx = makeContext(s, events, me)
  ability.run(ctx, source, move)

  resolveKOs(s, events)
  enterReplacementOr(s, 'continueMain')
}

function attack(s: GameState, events: GameEvent[], move: Move): void {
  if (move.type !== 'Attack') return
  const me = s.current
  const attacker = s.players[me].active
  if (!attacker) return
  const atk = pokemonCard(attacker).attacks[move.attackIndex]
  if (!atk) return

  // The attack's own damage/effects, separated from the turn machinery so the UI
  // can replay just this part for its damage preview (see previewAttackDamage).
  if (!resolveAttackEffects(s, events, move)) {
    endTurnSequence(s, events) // a failed attack (Mirror Shot tails) still ends the turn
    return
  }

  resolveKOs(s, events)
  if (s.phase === 'gameOver') return

  // The attack may owe the attacker a choice (e.g. Darkness Claw's Supporter
  // discard). Park the turn here; any queued KO replacement waits until after.
  if (s.pendingAttackChoice) {
    s.phase = 'awaitingAttackChoice'
    return
  }

  finishAttack(s, events)
}

/**
 * Apply just an attack's damage and card-specific effects to `s` (no KO
 * resolution, no end-of-turn). Returns false if the attack fizzled (Mirror
 * Shot). Shared by the reducer and the UI's damage preview so the two can never
 * disagree on what an attack does.
 */
function resolveAttackEffects(s: GameState, events: GameEvent[], move: Extract<Move, { type: 'Attack' }>): boolean {
  const me = s.current
  const foe = s.players[other(me)]
  const attacker = s.players[me].active
  if (!attacker) return false
  const card = pokemonCard(attacker)

  const ctx = makeContext(s, events, me)

  // Mirror Shot disruption: this Pokémon must flip heads or its attack fails.
  if (attacker.mustFlipToAttack) {
    attacker.mustFlipToAttack = false
    if (!ctx.flip(`${card.name} must flip to attack`)) {
      ctx.log(`${card.name}'s attack failed`)
      return false
    }
  }

  const defenderBefore = foe.active ? foe.active.damage : 0
  const atk = card.attacks[move.attackIndex]

  // Base damage (with Weakness) to the opponent's Active.
  if (foe.active && atk.damage > 0) ctx.dealAttackDamage(foe.active, atk.damage, card)

  // Card-specific extras.
  const handler = getAttackHandler(attacker.cardId)
  if (handler) handler(ctx, attacker, move.attackIndex, move)

  // Rocky Helmet: the damaged Active strikes back at the attacker.
  if (foe.active && foe.active.tool === ROCKY_HELMET && foe.active.damage > defenderBefore) {
    ctx.dealDamage(attacker, 20)
  }
  return true
}

/**
 * The damage an attack would land on its target — Weakness and card bonuses
 * included, but excluding follow-on effects like the end-of-turn Burn tick (so
 * it matches the number Pocket prints). Pure: runs on a throwaway clone.
 */
export function previewAttackDamage(state: GameState, move: Move): number | null {
  if (move.type !== 'Attack' || state.phase !== 'main') return null
  const me = state.current
  const targetUid = move.targetUid ?? state.players[other(me)].active?.uid
  if (!targetUid) return null

  const s = structuredClone(state)
  const events: GameEvent[] = []
  resolveAttackEffects(s, events, move)
  let total = 0
  for (const e of events) if (e.type === 'damage' && e.uid === targetUid) total += e.amount
  return total
}

/** Resolve what happens once an attack (and any choice it triggered) is done:
 *  promote KO'd Actives if needed, otherwise end the turn. */
function finishAttack(s: GameState, events: GameEvent[]): void {
  if (s.koReplacements.length > 0) {
    s.phase = 'awaitingKOReplacement'
    s.pendingFlow = 'endTurn'
    return
  }
  endTurnSequence(s, events)
}

function attackChoice(s: GameState, events: GameEvent[], move: Move): void {
  if (s.phase !== 'awaitingAttackChoice' || move.type !== 'AttackChoice') return
  const choice = s.pendingAttackChoice
  if (!choice || !choice.cardIds.includes(move.cardId)) return

  // Discard the chosen card from the opponent's revealed hand.
  const foe = s.players[other(choice.chooser)]
  const i = foe.hand.indexOf(move.cardId)
  if (i < 0) return
  const [c] = foe.hand.splice(i, 1)
  foe.discard.push(c)
  events.push({ type: 'info', message: `Discarded ${getCard(c).name} from opponent's hand` })

  s.pendingAttackChoice = null
  s.phase = 'main'
  finishAttack(s, events)
}

// ---------------------------------------------------------------------------
// KO replacement phase
// ---------------------------------------------------------------------------

function koReplace(s: GameState, events: GameEvent[], move: Move): void {
  if (s.phase !== 'awaitingKOReplacement' || move.type !== 'KOReplace') return
  const who = s.koReplacements[0]
  if (who === undefined) return
  const p = s.players[who]
  const idx = p.bench.findIndex((b) => b.uid === move.benchUid)
  if (idx < 0) return
  p.active = p.bench.splice(idx, 1)[0]
  s.koReplacements.shift()

  if (s.koReplacements.length > 0) return // more players still to promote

  const flow = s.pendingFlow
  s.pendingFlow = null
  s.phase = 'main'
  if (flow === 'endTurn') endTurnSequence(s, events)
  else if (flow === 'beginNextTurn') beginTurn(s, events, other(s.current), s.turn + 1)
  // 'continueMain' (or null): nothing more to do
}

// ---------------------------------------------------------------------------
// KO resolution & win check
// ---------------------------------------------------------------------------

function koPokemon(s: GameState, events: GameEvent[], owner: PlayerIndex, pkm: InPlayPokemon): void {
  const scorer = other(owner)
  const pts = pointsFor(pkm)
  s.players[scorer].points += pts
  events.push({ type: 'ko', uid: pkm.uid, owner, points: pts })
  // Discard the whole evolution stack + tool to the owner's discard, and its
  // attached Energy to the owner's discarded-Energy pile.
  s.players[owner].discard.push(...pkm.stack)
  if (pkm.tool) s.players[owner].discard.push(pkm.tool)
  s.players[owner].discardedEnergy.push(...pkm.attachedEnergy)
  events.push({ type: 'points', player: scorer, total: s.players[scorer].points })
}

function setWinner(s: GameState, events: GameEvent[], winner: PlayerIndex): void {
  if (s.winner !== null) return
  s.winner = winner
  s.phase = 'gameOver'
  events.push({ type: 'gameOver', winner })
}

function resolveKOs(s: GameState, events: GameEvent[]): void {
  for (const owner of [0, 1] as PlayerIndex[]) {
    const p = s.players[owner]
    if (p.active && isKnockedOut(p.active)) {
      koPokemon(s, events, owner, p.active)
      p.active = null
    }
    const survivors: InPlayPokemon[] = []
    for (const b of p.bench) {
      if (isKnockedOut(b)) koPokemon(s, events, owner, b)
      else survivors.push(b)
    }
    p.bench = survivors
  }

  // Win by points (Mega-ex KO of 3 also lands here).
  for (const owner of [0, 1] as PlayerIndex[]) {
    if (s.players[owner].points >= POINTS_TO_WIN) setWinner(s, events, owner)
  }
  if (s.phase === 'gameOver') return

  // Queue replacements; a player with no Pokémon at all loses.
  s.koReplacements = []
  for (const owner of [0, 1] as PlayerIndex[]) {
    const p = s.players[owner]
    if (!p.active) {
      if (p.bench.length > 0) s.koReplacements.push(owner)
      else setWinner(s, events, other(owner))
    }
  }
}

function enterReplacementOr(s: GameState, flowIfPending: Flow): void {
  if (s.phase === 'gameOver') return
  if (s.koReplacements.length > 0) {
    s.phase = 'awaitingKOReplacement'
    s.pendingFlow = flowIfPending
  }
}

// ---------------------------------------------------------------------------
// Turn boundaries
// ---------------------------------------------------------------------------

function endTurnSequence(s: GameState, events: GameEvent[]): void {
  const me = s.current

  // End-of-turn abilities (e.g. Legendary Pulse) for the current player.
  const abilityCtx = makeContext(s, events, me)
  for (const source of inPlay(s.players[me])) {
    const fn = getEndOfTurnAbility(source.cardId)
    if (fn) fn(abilityCtx, source)
  }

  // Stadium: Hiking Trail draws the current player up to 3 cards.
  if (s.stadium === HIKING_TRAIL) {
    const p = s.players[me]
    while (p.hand.length < 3 && p.deck.length > 0) {
      const id = p.deck.shift()!
      p.hand.push(id)
    }
  }

  // Special-condition checkup on both Active Pokémon.
  runCheckup(s, events)

  // Mirror Shot only disrupts the opponent's next turn: clear any lingering flag
  // on the current player's Pokémon now that their turn is ending.
  for (const pk of inPlay(s.players[me])) pk.mustFlipToAttack = false

  resolveKOs(s, events)
  if (s.phase === 'gameOver') return
  if (s.koReplacements.length > 0) {
    s.phase = 'awaitingKOReplacement'
    s.pendingFlow = 'beginNextTurn'
    return
  }

  beginTurn(s, events, other(me), s.turn + 1)
}

function runCheckup(s: GameState, events: GameEvent[]): void {
  // Special conditions resolve on both Active Pokémon, in the canonical
  // Pokémon Checkup order: Poison, Burn, Asleep, Paralysis.
  for (const owner of [s.current, other(s.current)]) {
    const active = s.players[owner].active
    if (!active) continue
    const ctx = makeContext(s, events, owner)
    if (active.status.includes('poisoned')) ctx.dealDamage(active, 10)
    if (active.status.includes('burned')) {
      ctx.dealDamage(active, 20)
      const name = pokemonCard(active).name
      if (ctx.flip(`${name} burn check`)) active.status = active.status.filter((x) => x !== 'burned')
    }
    if (active.status.includes('asleep') && ctx.flip(`${pokemonCard(active).name} sleep check`)) {
      active.status = active.status.filter((x) => x !== 'asleep')
    }
    // Paralysis only recovers during the checkup at the end of its OWN
    // controller's turn, so a Pokémon you Paralyze stays locked through the
    // opponent's whole next turn. `s.current` is the player whose turn ended.
    if (owner === s.current && active.status.includes('paralyzed')) {
      active.status = active.status.filter((x) => x !== 'paralyzed')
    }
  }

  // Checkup abilities (both players) fire after conditions resolve.
  for (const owner of [s.current, other(s.current)]) {
    const ctx = makeContext(s, events, owner)
    for (const source of inPlay(s.players[owner])) {
      const fn = getCheckupAbility(source.cardId)
      if (fn) fn(ctx, source)
    }
  }
}

function beginTurn(s: GameState, events: GameEvent[], player: PlayerIndex, turn: number): void {
  s.current = player
  s.turn = turn
  s.phase = 'main'
  const p = s.players[player]

  p.energyAttachedThisTurn = false
  p.retreatedThisTurn = false
  p.supporterPlayedThisTurn = false
  for (const pk of inPlay(p)) {
    pk.evolvedThisTurn = false
    pk.abilityUsedThisTurn = false
    pk.enteredBenchThisTurn = false
  }

  // Energy Zone: the player going first generates none on the very first turn.
  const skipEnergy = turn === 1 && player === s.firstPlayer
  p.currentEnergy = skipEnergy ? null : pickRandom(s.rng, p.registeredEnergy)

  // Draw for turn (Pocket: no deck-out loss; an empty deck just draws nothing).
  if (p.deck.length > 0) {
    p.hand.push(p.deck.shift()!)
    events.push({ type: 'draw', player, count: 1 })
  }

  events.push({ type: 'turnStart', player, turn })
}
