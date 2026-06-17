// Replays each recorded game and emits, before every decision, a compact JSON
// snapshot of the full board state plus the chosen move and ranked alternatives.
// Output: one JSON object per line (JSONL) to stdout.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { apply } from '../src/engine/reducer.ts'
import { createGame } from '../src/engine/setup.ts'
import { getCard } from '../src/engine/data/cards.ts'
import type { GameState, InPlayPokemon, PlayerState } from '../src/engine/types.ts'

const dir = process.argv[2]
const nm = (id: string) => getCard(id).name

function pk(p: InPlayPokemon | null) {
  if (!p) return null
  return {
    uid: p.uid,
    name: nm(p.cardId),
    hp: getCard(p.cardId).hp - p.damage,
    maxHp: getCard(p.cardId).hp,
    dmg: p.damage,
    e: p.attachedEnergy,
    tool: p.tool ? nm(p.tool) : null,
    status: p.status,
    stack: p.stack.map(nm),
  }
}
function side(s: PlayerState) {
  return {
    active: pk(s.active),
    bench: s.bench.map(pk),
    hand: s.hand.map(nm),
    handN: s.hand.length,
    deckN: s.deck.length,
    points: s.points,
    curE: s.currentEnergy,
    eAttached: s.energyAttachedThisTurn,
    suppPlayed: s.supporterPlayedThisTurn,
    discardE: s.discardedEnergy,
  }
}

for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const g = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  let st: GameState = createGame(g.deckA, g.deckB, { seed: g.seed, firstPlayer: g.firstPlayer })
  g.decisions.forEach((d: any, idx: number) => {
    const rec = {
      game: f,
      idx,
      turn: st.turn,
      seat: d.seat,
      phase: st.phase,
      A: side(st.players[0]),
      B: side(st.players[1]),
      move: d.move,
      winProb: d.winProb,
      ranked: d.ranked.slice(0, 5).map((r: any) => ({ m: r.move, wp: r.winProb, v: r.visits })),
    }
    process.stdout.write(JSON.stringify(rec) + '\n')
    st = apply(st, d.move).state
  })
}
