// Item and Supporter handlers. Tools, Stadiums, and Rare Candy are NOT here —
// they have dedicated move types handled in the reducer.
//
// The reducer removes the played card from hand BEFORE calling `run` (so Copycat
// counts/shuffles the rest of the hand correctly) and discards it AFTER, unless
// the handler sets ctx.keepPlayedCard.

import { getCard } from '../data/cards'
import {
  COPYCAT,
  CYRUS,
  FIELD_BLOWER,
  FLAME_PATCH,
  JULIANA,
  LISIA,
  LUCKY_ICE_POP,
  MIRAIDON_EX,
  POKE_BALL,
  POKEMON_CENTER_LADY,
  PROFESSOR_TURO,
  PROFESSORS_RESEARCH,
  SABRINA,
} from '../data/ids'
import { findByUid, inPlay, other } from '../rules'
import type { GameState, GameEvent, InPlayPokemon, Move, PlayerIndex } from '../types'
import type { ItemMove, TrainerDescriptor } from './kinds'

function isBasicPokemon(id: string): boolean {
  const c = getCard(id)
  return c.kind === 'pokemon' && c.stage === 0
}

function isStage2(id: string): boolean {
  const c = getCard(id)
  return c.kind === 'pokemon' && c.stage === 2
}

function isBasicWithin(id: string, maxHp: number): boolean {
  const c = getCard(id)
  return c.kind === 'pokemon' && c.stage === 0 && c.hp <= maxHp
}

// "Future" Pokémon (Paradox). Only Miraidon ex is Future in the current pool;
// deckgym's DB doesn't carry the trait, so we keep the list here.
const FUTURE_CARDS = new Set<string>([MIRAIDON_EX])
function isFuture(cardId: string): boolean {
  return FUTURE_CARDS.has(cardId)
}

/** Move the in-play Stadium to its owner's discard. */
export function discardStadium(state: GameState, events: GameEvent[]): void {
  if (state.stadium && state.stadiumOwner !== null) {
    state.players[state.stadiumOwner].discard.push(state.stadium)
    events.push({ type: 'info', message: `Stadium discarded` })
  }
  state.stadium = null
  state.stadiumOwner = null
}

/** Future Pokémon in play whose removal still leaves the player with a Pokémon. */
function futureTargets(state: GameState, owner: PlayerIndex): string[] {
  const all = inPlay(state.players[owner])
  if (all.length < 2) return []
  return all.filter((pk) => isFuture(pk.cardId)).map((pk) => pk.uid)
}

function fieldBlowerHasTarget(state: GameState): boolean {
  if (state.stadium) return true
  for (const pi of [0, 1] as PlayerIndex[]) {
    if (inPlay(state.players[pi]).some((p) => p.tool)) return true
  }
  return false
}

export const trainers: Record<string, TrainerDescriptor> = {
  // --- Supporters ---
  [PROFESSORS_RESEARCH]: {
    playable: () => true,
    enumerate: () => [{ type: 'PlaySupporter', cardId: PROFESSORS_RESEARCH }],
    run: (ctx) => ctx.draw(ctx.me, 2),
  },

  [COPYCAT]: {
    playable: () => true,
    enumerate: () => [{ type: 'PlaySupporter', cardId: COPYCAT }],
    run: (ctx) => {
      const n = ctx.foe.hand.length
      const hand = ctx.self.hand.splice(0)
      ctx.shuffleInto(ctx.me, hand)
      ctx.draw(ctx.me, n)
    },
  },

  [CYRUS]: {
    playable: (state, owner) => state.players[other(owner)].bench.some((b) => b.damage > 0),
    enumerate: (state, owner) =>
      state.players[other(owner)].bench
        .filter((b) => b.damage > 0)
        .map((b): Move => ({ type: 'PlaySupporter', cardId: CYRUS, targetUid: b.uid })),
    run: (ctx, move) => {
      const foe = ctx.foe
      if (!move.targetUid || !foe.active) return
      const idx = foe.bench.findIndex((b) => b.uid === move.targetUid)
      if (idx < 0) return
      const target = foe.bench[idx]
      foe.bench.splice(idx, 1)
      foe.active.status = [] // leaving the Active Spot clears Special Conditions
      foe.bench.push(foe.active)
      foe.active = target
    },
  },

  [JULIANA]: {
    // Like Poké Ball: playable whenever Supporters are allowed; it whiffs (just
    // shuffles) if the deck has no Stage 2. Matches deckgym-core (no deck guard).
    playable: () => true,
    enumerate: () => [{ type: 'PlaySupporter', cardId: JULIANA }],
    run: (ctx) => {
      const candidates = ctx.self.deck.map((id, i) => ({ id, i })).filter((x) => isStage2(x.id))
      if (candidates.length === 0) return
      const pick = candidates[ctx.randomInt(candidates.length)]
      ctx.self.deck.splice(pick.i, 1)
      ctx.self.hand.push(pick.id)
    },
  },

  [POKEMON_CENTER_LADY]: {
    playable: (state, owner) => inPlay(state.players[owner]).length > 0,
    enumerate: (state, owner) =>
      inPlay(state.players[owner]).map(
        (p): Move => ({ type: 'PlaySupporter', cardId: POKEMON_CENTER_LADY, targetUid: p.uid }),
      ),
    run: (ctx, move) => {
      const f = move.targetUid ? findByUid(ctx.state, move.targetUid) : null
      if (!f) return
      ctx.heal(f.pokemon, 30)
      f.pokemon.status = []
    },
  },

  // Lisia: put 2 random Basics with HP <= 50 from your deck into your hand.
  // Like Poké Ball, playable regardless of deck contents (it just whiffs).
  [LISIA]: {
    playable: () => true,
    enumerate: () => [{ type: 'PlaySupporter', cardId: LISIA }],
    run: (ctx) => {
      for (let n = 0; n < 2; n++) {
        const candidates = ctx.self.deck
          .map((id, i) => ({ id, i }))
          .filter((x) => isBasicWithin(x.id, 50))
        if (candidates.length === 0) break
        const pick = candidates[ctx.randomInt(candidates.length)]
        ctx.self.deck.splice(pick.i, 1)
        ctx.self.hand.push(pick.id)
      }
    },
  },

  // Professor Turo: shuffle one of your Future Pokémon in play into your deck.
  // Only offered when you'd keep at least one Pokémon in play afterwards.
  [PROFESSOR_TURO]: {
    playable: (state, owner) => futureTargets(state, owner).length > 0,
    enumerate: (state, owner) =>
      futureTargets(state, owner).map(
        (uid): Move => ({ type: 'PlaySupporter', cardId: PROFESSOR_TURO, targetUid: uid }),
      ),
    run: (ctx, move) => {
      if (!move.targetUid) return
      const p = ctx.self
      let target: InPlayPokemon
      if (p.active && p.active.uid === move.targetUid) {
        target = p.active
        p.active = null // resolveKOs queues promotion of a Benched Pokémon
      } else {
        const idx = p.bench.findIndex((b) => b.uid === move.targetUid)
        if (idx < 0) return
        target = p.bench.splice(idx, 1)[0]
      }
      if (target.tool) p.discard.push(target.tool) // Energy is lost (no pile)
      ctx.shuffleInto(ctx.me, target.stack)
    },
  },

  // Sabrina: switch out the opponent's Active to the Bench; the opponent chooses
  // its replacement (handled via the KO-replacement queue in the reducer).
  [SABRINA]: {
    playable: (state, owner) => {
      const foe = state.players[other(owner)]
      return !!foe.active && foe.bench.length > 0
    },
    enumerate: () => [{ type: 'PlaySupporter', cardId: SABRINA }],
    run: (ctx) => {
      const foe = ctx.foe
      if (!foe.active || foe.bench.length === 0) return
      foe.active.status = [] // leaving the Active Spot clears Special Conditions
      foe.bench.push(foe.active)
      foe.active = null // resolveKOs queues the opponent's promotion
    },
  },

  // --- Items ---
  // Flame Patch: attach a Fire Energy from your discarded-energy pile to your
  // Active Fire Pokémon. Unplayable unless a Fire Energy is in that pile.
  [FLAME_PATCH]: {
    playable: (state, owner) => {
      const p = state.players[owner]
      const a = p.active
      if (!a) return false
      const c = getCard(a.cardId)
      if (c.kind !== 'pokemon' || c.energyType !== 'Fire') return false
      return (p.discardedEnergy ?? []).includes('Fire')
    },
    enumerate: () => [{ type: 'PlayItem', cardId: FLAME_PATCH }],
    run: (ctx) => {
      const a = ctx.self.active
      if (!a) return
      const i = (ctx.self.discardedEnergy ?? []).indexOf('Fire')
      if (i < 0) return
      ctx.self.discardedEnergy.splice(i, 1)
      ctx.attachEnergy(a, 'Fire', 1)
    },
  },

  [POKE_BALL]: {
    // Playable whenever Items are allowed; it whiffs (just shuffles) if the deck
    // has no Basic. Matches deckgym-core, which has no deck guard.
    playable: () => true,
    enumerate: () => [{ type: 'PlayItem', cardId: POKE_BALL }],
    run: (ctx) => {
      const candidates = ctx.self.deck.map((id, i) => ({ id, i })).filter((x) => isBasicPokemon(x.id))
      if (candidates.length === 0) return
      const pick = candidates[ctx.randomInt(candidates.length)]
      ctx.self.deck.splice(pick.i, 1)
      ctx.self.hand.push(pick.id)
    },
  },

  [LUCKY_ICE_POP]: {
    playable: (state, owner) => {
      const a = state.players[owner].active
      return !!a && a.damage > 0
    },
    enumerate: () => [{ type: 'PlayItem', cardId: LUCKY_ICE_POP }],
    run: (ctx) => {
      const a = ctx.self.active
      if (!a) return
      const before = a.damage
      ctx.heal(a, 20)
      if (a.damage < before && ctx.flip('Lucky Ice Pop')) ctx.keepPlayedCard = true
    },
  },

  [FIELD_BLOWER]: {
    playable: (state) => fieldBlowerHasTarget(state),
    enumerate: (state) => {
      const moves: Move[] = []
      for (const pi of [0, 1] as PlayerIndex[]) {
        for (const p of inPlay(state.players[pi])) {
          if (p.tool) moves.push({ type: 'PlayItem', cardId: FIELD_BLOWER, fieldBlower: { kind: 'tool', uid: p.uid } })
        }
      }
      if (state.stadium) moves.push({ type: 'PlayItem', cardId: FIELD_BLOWER, fieldBlower: { kind: 'stadium' } })
      return moves
    },
    run: (ctx, move) => {
      const fb = (move as ItemMove).fieldBlower
      if (!fb) return
      if (fb.kind === 'stadium') {
        discardStadium(ctx.state, ctx.events)
        return
      }
      const f = findByUid(ctx.state, fb.uid)
      if (f && f.pokemon.tool) {
        ctx.state.players[f.owner].discard.push(f.pokemon.tool)
        f.pokemon.tool = null
      }
    },
  },
}
