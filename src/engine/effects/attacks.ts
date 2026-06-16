// Non-vanilla attack handlers. The reducer applies the attack's base damage to
// the opponent's Active (with Weakness) BEFORE calling these — handlers only add
// the card-specific extras (spread/targeted damage, status, energy discard).

import { getCard } from '../data/cards'
import {
  CASTFORM_SUNNY,
  CHIEN_PAO_EX,
  HEATMOR,
  HYDREIGON,
  MAGNEZONE,
  MEGA_ABSOL_EX,
  MEGA_BLAZIKEN_EX,
  MIRAIDON_EX,
  SUICUNE_EX,
} from '../data/ids'
import { findByUid, inPlay, other } from '../rules'
import type { GameState, InPlayPokemon, Move, PlayerIndex } from '../types'
import type { AttackHandler } from './kinds'

export const attackHandlers: Record<string, AttackHandler> = {
  // Mega Burning: discard one Fire Energy from self, Burn the opponent's Active.
  [MEGA_BLAZIKEN_EX]: (ctx, attacker) => {
    ctx.discardEnergy(attacker, 'Fire', 1)
    if (ctx.foe.active) ctx.addStatus(ctx.foe.active, 'burned')
  },

  // Sunny Scorching: Burn the opponent's Active if a Stadium is in play.
  [CASTFORM_SUNNY]: (ctx) => {
    if (ctx.state.stadium && ctx.foe.active) ctx.addStatus(ctx.foe.active, 'burned')
  },

  // Tongue Whip: 30 to a chosen Benched Pokémon (no Weakness on the Bench).
  [HEATMOR]: (ctx, _attacker, _idx, move) => {
    if (!move.targetUid) return
    const f = findByUid(ctx.state, move.targetUid)
    if (f) ctx.dealDamage(f.pokemon, 30)
  },

  // Crystal Waltz: +20 per Benched Pokémon (both players) to the Active.
  [SUICUNE_EX]: (ctx) => {
    if (!ctx.foe.active) return
    const benched = ctx.self.bench.length + ctx.foe.bench.length
    ctx.dealDamage(ctx.foe.active, 20 * benched)
  },

  // Diving Icicles (attack #1): discard all Water Energy, 130 to a chosen Pokémon.
  [CHIEN_PAO_EX]: (ctx, attacker, idx, move) => {
    if (idx !== 1) return
    ctx.discardEnergy(attacker, 'Water')
    if (!move.targetUid) return
    const f = findByUid(ctx.state, move.targetUid)
    if (f) ctx.dealAttackDamage(f.pokemon, 130, ctx.card(attacker))
  },

  // Hyper Ray: discard all Energy from self.
  [HYDREIGON]: (ctx, attacker) => {
    ctx.discardEnergy(attacker)
  },

  // Hadron Ray: +20 damage per [L] Energy attached to this Pokémon (base 20 is
  // applied by the reducer). Weakness is a flat +20 added once, so the per-energy
  // bonus is plain damage.
  [MIRAIDON_EX]: (ctx, attacker) => {
    const lightning = attacker.attachedEnergy.filter((e) => e === 'Lightning').length
    if (ctx.foe.active && lightning > 0) ctx.dealDamage(ctx.foe.active, 20 * lightning)
  },

  // Mirror Shot: during the opponent's next turn, the Defending Pokémon must flip
  // heads to attack or its attack fails (resolved in the reducer).
  [MAGNEZONE]: (ctx) => {
    if (ctx.foe.active) ctx.foe.active.mustFlipToAttack = true
  },

  // Darkness Claw: reveal the opponent's hand, then discard a Supporter found
  // there. The discard is a separate step the attacker chooses afterwards, so we
  // only reveal here and hand a pending choice back to the reducer (it parks the
  // turn in `awaitingAttackChoice` until the player picks).
  [MEGA_ABSOL_EX]: (ctx) => {
    const hand = ctx.foe.hand
    ctx.log(
      hand.length > 0
        ? `Opponent reveals their hand: ${hand.map((id) => ctx.getCard(id).name).join(', ')}`
        : 'Opponent reveals an empty hand',
    )
    const supporters = [...new Set(hand.filter(isSupporter))]
    if (supporters.length > 0) {
      ctx.state.pendingAttackChoice = {
        kind: 'discardFromOpponentHand',
        chooser: ctx.me,
        cardIds: supporters,
      }
    }
  },
}

function isSupporter(id: string): boolean {
  const c = getCard(id)
  return c.kind === 'trainer' && c.trainerType === 'Supporter'
}

/**
 * Per-card attack move enumeration (target/discard variants). Called by moves.ts
 * only after the attack is confirmed affordable. Cards not listed get a single
 * plain `Attack{attackIndex}`.
 */
export const attackEnumerators: Record<
  string,
  (state: GameState, attacker: InPlayPokemon, owner: PlayerIndex, attackIndex: number) => Move[]
> = {
  [HEATMOR]: (state, _attacker, owner, idx) => {
    const bench = state.players[other(owner)].bench
    if (bench.length === 0) return [{ type: 'Attack', attackIndex: idx }]
    return bench.map((t) => ({ type: 'Attack', attackIndex: idx, targetUid: t.uid }))
  },

  [CHIEN_PAO_EX]: (state, _attacker, owner, idx) => {
    if (idx !== 1) return [{ type: 'Attack', attackIndex: idx }]
    const targets = inPlay(state.players[other(owner)])
    return targets.map((t) => ({ type: 'Attack', attackIndex: idx, targetUid: t.uid }))
  },
}
