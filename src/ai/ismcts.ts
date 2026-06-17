// Single-Observer Information-Set Monte Carlo Tree Search (Cowling et al. 2012).
//
// One shared tree, but a *fresh hidden world is re-sampled every iteration*
// (`sampleWorld`) so the search can only act on what the seat legitimately knows
// — this is what avoids PIMC strategy fusion and keeps the advice honest.
//
// Per iteration: determinize → descend the tree choosing among the moves legal in
// *that* world (UCB1, availability-aware) → expand one new node → roll out with a
// heuristic policy, cut off after a fixed number of plies, and score the leaf with
// the value function → backpropagate. Acting player is read from each node via
// `actingPlayer`, so the tree spans setup / main / KO-replacement / attack-choice
// uniformly. Rewards are stored from the *root seat's* perspective; at an
// opponent node we flip the exploitation term so they maximize their own value.

import { actingPlayer, legalMoves } from '../engine/moves'
import { apply } from '../engine/reducer'
import { makeRng, nextFloat, type RngState } from '../engine/rng'
import type { GameState, Move, PlayerIndex } from '../engine/types'
import { winProb } from './eval'
import { observe, sampleWorld } from './observation'
import { rolloutPolicy } from './policies'
import type { Policy, RankedMove } from './types'

export interface SearchOptions {
  /** Number of determinized iterations to run (more = stronger, slower). */
  iterations?: number
  /** Plies to roll out before cutting off and scoring with the value function. */
  rolloutDepth?: number
  /** UCB1 exploration constant. */
  exploration?: number
  /** Rollout policy (defaults to attach-and-attack). */
  policy?: Policy
  /** Search RNG — *separate* from the game's, so search never perturbs the real
   *  line. Defaults to a fresh stream seeded off the iteration count. */
  rng?: RngState
}

export interface SearchResult {
  best: Move
  /** The chosen move's win probability, from the searching seat's perspective. */
  winProb: number
  /** Every root move the search visited, best (most-visited) first. */
  ranked: RankedMove[]
}

interface Edge {
  move: Move
  visits: number
  /** Sum of rollout values, in [0, 1], from the root seat's perspective. */
  reward: number
  /** Times this move was *available* when its parent was visited (ISMCTS N′). */
  available: number
  child: TreeNode
}

interface TreeNode {
  children: Map<string, Edge>
}

/** A stable key for a move, used to index the tree. Moves are flat records of
 *  primitives (plus the occasional small object), so a sorted JSON of the fields
 *  is canonical. */
function moveKey(m: Move): string {
  const rec = m as Record<string, unknown>
  let key = ''
  for (const k of Object.keys(rec).sort()) key += `${k}=${JSON.stringify(rec[k])};`
  return key
}

function newNode(): TreeNode {
  return { children: new Map() }
}

/** Roll out from `state` with `policy`, cutting off after `depth` plies, then
 *  score the resulting leaf with the value function (1/0 if it actually ended). */
function rollout(state: GameState, seat: PlayerIndex, policy: Policy, rng: RngState, depth: number): number {
  let s = state
  for (let d = 0; d < depth && s.winner === null; d++) {
    const moves = legalMoves(s)
    if (moves.length === 0) break
    s = apply(s, policy(s, moves, rng)).state
  }
  return winProb(s, seat)
}

/** UCB1 pick among the currently-legal edges (all already expanded). */
function selectUCB(node: TreeNode, legal: Move[], maximizing: boolean, c: number): Edge {
  let best: Edge | null = null
  let bestScore = -Infinity
  for (const m of legal) {
    const e = node.children.get(moveKey(m))!
    const mean = e.reward / e.visits
    const exploit = maximizing ? mean : 1 - mean
    const explore = c * Math.sqrt(Math.log(e.available) / e.visits)
    const score = exploit + explore
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return best!
}

/**
 * Run SO-ISMCTS from `rootState` for the seat that must act there.
 *
 * The caller is responsible for `seat === actingPlayer(rootState)` (the search
 * optimizes that seat's decision). Trivially returns the only move when there's
 * no choice. Throws on a terminal / no-move state.
 */
export function search(rootState: GameState, seat: PlayerIndex, opts: SearchOptions = {}): SearchResult {
  const rootMoves = legalMoves(rootState)
  if (rootMoves.length === 0) throw new Error('search: no legal moves at root')
  if (rootMoves.length === 1) {
    const only = rootMoves[0]
    const p = winProb(apply(rootState, only).state, seat)
    return { best: only, winProb: p, ranked: [{ move: only, visits: 1, winProb: p }] }
  }

  const iterations = opts.iterations ?? 1000
  const depth = opts.rolloutDepth ?? 40
  const c = opts.exploration ?? 1.4
  const policy = opts.policy ?? rolloutPolicy
  const rng = opts.rng ?? makeRng(iterations * 2654435761)

  const obs = observe(rootState, seat)
  const root = newNode()

  for (let i = 0; i < iterations; i++) {
    let world = sampleWorld(obs, rng)
    let node = root
    const path: Edge[] = []

    // Selection + single expansion.
    for (;;) {
      if (world.winner !== null) break
      const legal = legalMoves(world)
      if (legal.length === 0) break

      const untried: Move[] = []
      for (const m of legal) {
        const e = node.children.get(moveKey(m))
        if (e) e.available++ // this move was available on this visit
        else untried.push(m)
      }

      if (untried.length > 0) {
        const m = untried[Math.floor(nextFloat(rng) * untried.length)]
        const edge: Edge = { move: m, visits: 0, reward: 0, available: 1, child: newNode() }
        node.children.set(moveKey(m), edge)
        world = apply(world, m).state
        path.push(edge)
        break // expanded → hand off to the rollout
      }

      const edge = selectUCB(node, legal, actingPlayer(world) === seat, c)
      world = apply(world, edge.move).state
      path.push(edge)
      node = edge.child
    }

    const value = rollout(world, seat, policy, rng, depth)
    for (const e of path) {
      e.visits++
      e.reward += value
    }
  }

  const ranked: RankedMove[] = [...root.children.values()]
    .map((e) => ({ move: e.move, visits: e.visits, winProb: e.visits > 0 ? e.reward / e.visits : 0 }))
    .sort((a, b) => b.visits - a.visits)

  return { best: ranked[0].move, winProb: ranked[0].winProb, ranked }
}
