// EffectContext: the safe, mutation-only surface card handlers use.
//
// Handlers run against an already-cloned GameState (the reducer clones before
// apply), so they mutate freely. Handlers DO NOT resolve KOs, end turns, or
// award points — the reducer does that after the handler returns. They just
// move damage, energy, and cards around and push events.

import { getCard } from '../data/cards'
import { flipCoin, nextInt, shuffle } from '../rng'
import { other, pokemonCard } from '../rules'
import type {
  Card,
  EnergyType,
  GameEvent,
  GameState,
  InPlayPokemon,
  PlayerIndex,
  PlayerState,
  PokemonCard,
  Status,
} from '../types'

export interface EffectContext {
  state: GameState
  events: GameEvent[]
  /** The player performing the action (current player for their own moves). */
  readonly me: PlayerIndex
  readonly opp: PlayerIndex
  readonly self: PlayerState
  readonly foe: PlayerState

  /** Set by a trainer handler to keep the played card in hand (e.g. Lucky Ice Pop). */
  keepPlayedCard: boolean

  getCard(id: string): Card
  card(p: InPlayPokemon): PokemonCard

  /** Plain damage (no weakness) — abilities, bench hits, recoil. */
  dealDamage(target: InPlayPokemon, amount: number): void
  /** Attack damage to a target; applies Weakness only vs the opponent's Active. */
  dealAttackDamage(target: InPlayPokemon, amount: number, attacker: PokemonCard): void
  heal(target: InPlayPokemon, amount: number): void
  addStatus(target: InPlayPokemon, status: Status): void

  draw(player: PlayerIndex, count: number): void
  attachEnergy(target: InPlayPokemon, type: EnergyType, count?: number): void
  /**
   * Remove energy from a Pokémon, moving it to its controller's discarded-energy
   * pile (recoverable by cards like Flame Patch). No `type` → all energy. With a
   * `type`, removes up to `count` of it (default = all of that type).
   */
  discardEnergy(target: InPlayPokemon, type?: EnergyType, count?: number): void

  /** A coin flip (heads === true), recorded in the log. `reason` names what it
   *  decided so the log reads e.g. "Coin flip: heads (Magnezone burn check)". */
  flip(reason?: string): boolean
  randomInt(n: number): number
  shuffleInto(player: PlayerIndex, cardIds: string[]): void

  /** All in-play Pokémon for a player (Active first). */
  inPlay(player: PlayerIndex): InPlayPokemon[]
  log(message: string): void
}

export function makeContext(state: GameState, events: GameEvent[], me: PlayerIndex): EffectContext {
  const opp = other(me)
  const self = state.players[me]
  const foe = state.players[opp]

  const ctx: EffectContext = {
    state,
    events,
    me,
    opp,
    self,
    foe,

    keepPlayedCard: false,

    getCard,
    card: pokemonCard,

    dealDamage(target, amount) {
      if (amount <= 0) return
      target.damage += amount
      events.push({ type: 'damage', uid: target.uid, amount })
    },

    dealAttackDamage(target, amount, attacker) {
      let total = amount
      // Weakness is a flat +20, only against the opponent's Active Pokémon.
      if (target === foe.active) {
        const def = pokemonCard(target)
        if (def.weakness !== null && def.weakness === attacker.energyType) total += 20
      }
      ctx.dealDamage(target, total)
    },

    heal(target, amount) {
      const healed = Math.min(amount, target.damage)
      if (healed <= 0) return
      target.damage -= healed
      events.push({ type: 'heal', uid: target.uid, amount: healed })
    },

    addStatus(target, status) {
      // Asleep / Paralyzed / Confused are mutually exclusive; Poison & Burn stack.
      const exclusive: Status[] = ['asleep', 'paralyzed', 'confused']
      if (exclusive.includes(status)) {
        target.status = target.status.filter((s) => !exclusive.includes(s))
      }
      if (!target.status.includes(status)) {
        target.status.push(status)
        events.push({ type: 'status', uid: target.uid, status })
      }
    },

    draw(player, count) {
      const p = state.players[player]
      let drawn = 0
      for (let i = 0; i < count; i++) {
        const id = p.deck.shift()
        if (id === undefined) break
        p.hand.push(id)
        drawn++
      }
      if (drawn > 0) events.push({ type: 'draw', player, count: drawn })
    },

    attachEnergy(target, type, count = 1) {
      for (let i = 0; i < count; i++) {
        target.attachedEnergy.push(type)
        events.push({ type: 'energyAttached', uid: target.uid, energy: type })
      }
    },

    discardEnergy(target, type, count = Infinity) {
      const removed: EnergyType[] = []
      if (type === undefined) {
        removed.push(...target.attachedEnergy)
        target.attachedEnergy = []
      } else {
        target.attachedEnergy = target.attachedEnergy.filter((e) => {
          if (e === type && removed.length < count) {
            removed.push(e)
            return false
          }
          return true
        })
      }
      if (removed.length === 0) return
      // Send the discarded energy to its controller's discarded-energy pile.
      const owner = state.players.find((pl) => pl.active === target || pl.bench.includes(target))
      if (owner) (owner.discardedEnergy ??= []).push(...removed)
    },

    flip(reason) {
      const result = flipCoin(state.rng)
      events.push({ type: 'flip', result, reason })
      return result
    },

    randomInt(n) {
      return nextInt(state.rng, n)
    },

    shuffleInto(player, cardIds) {
      const p = state.players[player]
      p.deck = shuffle(state.rng, [...p.deck, ...cardIds])
    },

    inPlay(player) {
      const p = state.players[player]
      return p.active ? [p.active, ...p.bench] : [...p.bench]
    },

    log(message) {
      events.push({ type: 'info', message })
    },
  }

  return ctx
}
