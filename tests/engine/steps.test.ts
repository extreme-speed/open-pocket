import { describe, expect, it } from 'vitest'
import { apply, applySteps } from '../../src/engine/reducer'
import { FROAKIE } from '../../src/engine/data/ids'
import { game, mon, player } from '../helpers'

// applySteps is the stepped variant the UI plays back: same pure transition as
// apply(), plus a state snapshot at each event so the board can show the hit
// before the faint, the flip before the damage, etc.
describe('applySteps', () => {
  const burnedTurn = () =>
    game(
      player({ active: mon(FROAKIE, { status: ['burned'] }), bench: [mon(FROAKIE)], deck: [FROAKIE] }),
      player({ active: mon(FROAKIE), deck: [FROAKIE] }),
      { current: 0 },
    )

  it('returns the same final state and events as apply()', () => {
    const s = burnedTurn()
    const plain = apply(s, { type: 'EndTurn' })
    const stepped = applySteps(s, { type: 'EndTurn' })
    expect(stepped.state).toEqual(plain.state)
    expect(stepped.events).toEqual(plain.events)
  })

  it('captures one snapshot per event, in order', () => {
    const stepped = applySteps(burnedTurn(), { type: 'EndTurn' })
    expect(stepped.frames.length).toBe(stepped.events.length)
    expect(stepped.frames.map((f) => f.event)).toEqual(stepped.events)
  })

  it('frame snapshots are independent of the final state', () => {
    const stepped = applySteps(burnedTurn(), { type: 'EndTurn' })
    const before = stepped.frames[0].state.players[0].active!.damage
    stepped.state.players[0].active!.damage += 999
    expect(stepped.frames[0].state.players[0].active!.damage).toBe(before)
  })

  it('shows the hit while the Pokémon is still in play; removal lands on the final state', () => {
    const s = game(
      player({ active: mon(FROAKIE, { status: ['burned'], damage: 1000, uid: 'victim' }), bench: [mon(FROAKIE)] }),
      player({ active: mon(FROAKIE), deck: [FROAKIE] }),
      { current: 0 },
    )
    const { state, frames } = applySteps(s, { type: 'EndTurn' })

    const damageBeat = frames.find((f) => f.event.type === 'damage' && f.event.uid === 'victim')!
    expect(damageBeat.state.players[0].active?.uid).toBe('victim')
    expect(frames.some((f) => f.event.type === 'ko' && f.event.uid === 'victim')).toBe(true)
    // By the time the resolution settles, the KO'd Active is gone.
    expect(state.players[0].active).toBeNull()
  })
})
