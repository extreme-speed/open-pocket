import { describe, expect, it } from 'vitest'
import { apply } from '../../src/engine/reducer'
import { flipCoin, makeRng } from '../../src/engine/rng'
import {
  FROAKIE,
  MAGNEMITE,
  MAGNEZONE,
  MEGA_BLAZIKEN_EX,
  SABRINA,
  TORCHIC,
  ZERAORA,
} from '../../src/engine/data/ids'
import { game, mon, player } from '../helpers'

/** Smallest seed whose first coin flip lands the requested way (heads === true). */
function seedFlipping(heads: boolean): number {
  for (let s = 0; s < 5000; s++) if (flipCoin(makeRng(s)) === heads) return s
  throw new Error('no seed found')
}

describe('Mirror Shot disruption', () => {
  it('flags the opponent for their next turn, then clears at the end of it', () => {
    const magnezone = mon(MAGNEZONE, { attachedEnergy: ['Lightning', 'Colorless', 'Colorless'] })
    const defender = mon(MEGA_BLAZIKEN_EX) // 170 HP, survives Mirror Shot's 90
    const s = game(
      player({ active: magnezone }),
      player({ active: defender, bench: [mon(MAGNEMITE)] }),
      { current: 0, turn: 3 },
    )
    const afterAtk = apply(s, { type: 'Attack', attackIndex: 0 }).state
    expect(afterAtk.current).toBe(1)
    expect(afterAtk.players[1].active!.mustFlipToAttack).toBe(true)

    // Opponent ends their turn without attacking — the flag must not linger.
    const afterEnd = apply(afterAtk, { type: 'EndTurn' }).state
    expect(afterEnd.players[1].active!.mustFlipToAttack).toBe(false)
  })

  it('on tails the disrupted attack fails but the turn still ends', () => {
    const attacker = mon(ZERAORA, { attachedEnergy: ['Lightning', 'Lightning'], mustFlipToAttack: true })
    const s = game(
      player({ active: mon(MEGA_BLAZIKEN_EX) }),
      player({ active: attacker, bench: [mon(MAGNEMITE)] }),
      { current: 1, turn: 4, rng: makeRng(seedFlipping(false)) },
    )
    const after = apply(s, { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[0].active!.damage).toBe(0) // Lightning Claw never landed
    expect(after.current).toBe(0)
  })

  it('on heads the disrupted attack lands and the flag is consumed', () => {
    const attacker = mon(ZERAORA, { attachedEnergy: ['Lightning', 'Lightning'], mustFlipToAttack: true })
    const s = game(
      player({ active: mon(MEGA_BLAZIKEN_EX) }),
      player({ active: attacker, bench: [mon(MAGNEMITE)] }),
      { current: 1, turn: 4, rng: makeRng(seedFlipping(true)) },
    )
    const after = apply(s, { type: 'Attack', attackIndex: 0 }).state
    expect(after.players[0].active!.damage).toBe(50) // Lightning Claw, no Weakness
    expect(after.players[1].active!.mustFlipToAttack).toBe(false)
  })
})

describe('Sabrina', () => {
  it('forces the opponent to promote a new Active, then the turn continues', () => {
    const foeBench = mon(TORCHIC)
    const s = game(
      player({ active: mon(TORCHIC), hand: [SABRINA] }),
      player({ active: mon(FROAKIE), bench: [foeBench] }),
      { current: 0, turn: 3 },
    )
    const afterPlay = apply(s, { type: 'PlaySupporter', cardId: SABRINA }).state
    expect(afterPlay.phase).toBe('awaitingKOReplacement')
    expect(afterPlay.koReplacements).toEqual([1])

    const afterPromote = apply(afterPlay, { type: 'KOReplace', benchUid: foeBench.uid }).state
    expect(afterPromote.phase).toBe('main')
    expect(afterPromote.current).toBe(0) // still the caster's turn
    expect(afterPromote.players[1].active!.uid).toBe(foeBench.uid)
  })
})
