// Simple heuristic players, ported in spirit from deckgym-core's simple players.
//
// Each is a `Policy`: given the legal `moves`, pick one. They serve three roles:
//   • the MCTS rollout policy (`rolloutPolicy`) — cheap, low-noise, lethal-aware;
//   • benchmark opponents for sanity win-rate checks (`attachAttackPolicy`,
//     `endTurnPolicy`, `evolutionRusherPolicy`);
//   • the random baseline (`randomPolicy`).

import { previewAttackDamage } from '../engine/reducer'
import { pickRandom, type RngState } from '../engine/rng'
import { getCard } from '../engine/data/cards'
import { other, remainingHp } from '../engine/rules'
import type { GameState, Move } from '../engine/types'
import type { Policy } from './types'

function ofType<T extends Move['type']>(moves: Move[], type: T): Extract<Move, { type: T }>[] {
  return moves.filter((m): m is Extract<Move, { type: T }> => m.type === type)
}

/** Pick the highest-HP Basic to lead with during setup, benching the rest. */
function setupChoice(state: GameState, moves: Move[]): Move | null {
  const actives = ofType(moves, 'SetupActive')
  if (actives.length > 0) {
    return [...actives].sort((a, b) => hp(b.cardId) - hp(a.cardId))[0]
  }
  // Bench a couple of extra Basics for resilience, then finish.
  const bench = ofType(moves, 'SetupBench')
  const me = state.players.findIndex((p) => !p.setupDone)
  const benched = me >= 0 ? state.players[me].bench.length : 0
  if (bench.length > 0 && benched < 2) return [...bench].sort((a, b) => hp(b.cardId) - hp(a.cardId))[0]
  return moves.find((m) => m.type === 'SetupDone') ?? null
}

function hp(cardId: string): number {
  const c = getCard(cardId)
  return c.kind === 'pokemon' ? c.hp : 0
}

/** The best damaging attack available, with the damage it would deal. */
function bestAttack(state: GameState, moves: Move[]): { move: Move; damage: number } | null {
  let best: { move: Move; damage: number } | null = null
  for (const m of ofType(moves, 'Attack')) {
    const dmg = previewAttackDamage(state, m) ?? 0
    if (!best || dmg > best.damage) best = { move: m, damage: dmg }
  }
  return best
}

/** Does this attack knock out the opponent's Active outright? */
function isLethal(state: GameState, damage: number): boolean {
  const foe = state.players[other(state.current)].active
  return foe !== null && damage >= remainingHp(foe)
}

/** Resolve the forced single-choice phases the same way for every policy. */
function forcedPhaseChoice(state: GameState, moves: Move[], rng: RngState): Move | null {
  switch (state.phase) {
    case 'setup':
      return setupChoice(state, moves)
    case 'awaitingKOReplacement': {
      // Promote the sturdiest bencher.
      const reps = ofType(moves, 'KOReplace')
      const me = state.koReplacements[0]
      if (reps.length === 0 || me === undefined) return reps[0] ?? null
      return [...reps].sort((a, b) => benchHp(state, me, b.benchUid) - benchHp(state, me, a.benchUid))[0]
    }
    case 'awaitingAttackChoice':
      return pickRandom(rng, moves)
    default:
      return null
  }
}

function benchHp(state: GameState, owner: number, uid: string): number {
  const pk = state.players[owner].bench.find((b) => b.uid === uid)
  return pk ? remainingHp(pk) : 0
}

/** Picks uniformly at random — the weakest baseline. */
export const randomPolicy: Policy = (_state, moves, rng) => pickRandom(rng, moves)

/**
 * Attach energy and swing. The default rollout policy: take a lethal attack
 * immediately; otherwise do the cheap build-up (attach, evolve, play a Basic,
 * fire a free ability) and then attack if it does damage, else pass. Greedy and
 * nearly deterministic, which keeps rollouts short and low-variance.
 */
export const attachAttackPolicy: Policy = (state, moves, rng) => {
  const forced = forcedPhaseChoice(state, moves, rng)
  if (forced) return forced

  const atk = bestAttack(state, moves)
  if (atk && isLethal(state, atk.damage)) return atk.move

  // Build up before committing the turn-ending attack.
  const attach = ofType(moves, 'AttachEnergy')
  if (attach.length > 0) return preferActive(state, attach)

  const evolve = moves.find((m) => m.type === 'Evolve' || m.type === 'RareCandyEvolve')
  if (evolve) return evolve

  const ability = moves.find((m) => m.type === 'UseAbility')
  if (ability) return ability

  if (atk && atk.damage > 0) return atk.move

  const playBasic = ofType(moves, 'PlayBasic')
  if (playBasic.length > 0) return playBasic[0]

  return moves.find((m) => m.type === 'EndTurn') ?? pickRandom(rng, moves)
}

/** Always evolve when possible, then behave like attach-and-attack. */
export const evolutionRusherPolicy: Policy = (state, moves, rng) => {
  const forced = forcedPhaseChoice(state, moves, rng)
  if (forced) return forced
  const evolve = moves.find((m) => m.type === 'Evolve' || m.type === 'RareCandyEvolve')
  if (evolve) return evolve
  const playBasic = ofType(moves, 'PlayBasic')
  if (playBasic.length > 0) return playBasic[0]
  return attachAttackPolicy(state, moves, rng)
}

/** Does as little as possible: only the forced phases and an immediate lethal,
 *  otherwise passes the turn. A deliberately weak baseline opponent. */
export const endTurnPolicy: Policy = (state, moves, rng) => {
  const forced = forcedPhaseChoice(state, moves, rng)
  if (forced) return forced
  const atk = bestAttack(state, moves)
  if (atk && isLethal(state, atk.damage)) return atk.move
  return moves.find((m) => m.type === 'EndTurn') ?? pickRandom(rng, moves)
}

/** Among attach moves, prefer the Active if it still needs energy, else the
 *  first benched Pokémon (building a follow-up threat). */
function preferActive(state: GameState, attaches: Extract<Move, { type: 'AttachEnergy' }>[]): Move {
  const active = state.players[state.current].active
  if (active) {
    const onActive = attaches.find((m) => m.targetUid === active.uid)
    if (onActive && needsEnergy(active.cardId, active.attachedEnergy.length)) return onActive
  }
  return attaches[0]
}

function needsEnergy(cardId: string, attached: number): boolean {
  const c = getCard(cardId)
  if (c.kind !== 'pokemon' || c.attacks.length === 0) return false
  const cheapest = Math.min(...c.attacks.map((a) => a.cost.length))
  return attached < cheapest
}

/** The rollout policy used by the searcher. */
export const rolloutPolicy: Policy = attachAttackPolicy
