// Offline self-play runner — the overnight job (see PLAN.md §4).
//
// Drives BOTH seats of a fixed matchup with the IS-MCTS searcher, records every
// decision (chosen move + win% + ranked alternatives), and writes each finished
// game to games/<matchup>/<seed>.json in the Replay format. The recorded move
// list, replayed from createGame(deckA, deckB, { seed, firstPlayer }), reproduces
// the game exactly — search runs on a *separate* RNG so it never perturbs the
// real line.
//
// Run with the engine loader:
//   npm run selfplay -- <deckA> <deckB> <games> <iterations> <baseSeed>
// Defaults: Mega Blaziken vs Miraidon, 1 game, 1000 iterations, base seed 1.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { actingPlayer } from '../src/engine/moves.ts'
import { apply } from '../src/engine/reducer.ts'
import { makeRng } from '../src/engine/rng.ts'
import { createGame } from '../src/engine/setup.ts'
import type { GameState, PlayerIndex } from '../src/engine/types.ts'
import { search } from '../src/ai/ismcts.ts'
import type { RecordedDecision, RecordedGame } from '../src/ai/types.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const GAMES_DIR = join(HERE, '..', 'games')

interface Args {
  deckA: string
  deckB: string
  games: number
  iterations: number
  baseSeed: number
}

function parseArgs(argv: string[]): Args {
  const [deckA, deckB, games, iterations, baseSeed] = argv
  return {
    deckA: deckA ?? 'mega-blaziken-ex-b1-greninja-a1',
    deckB: deckB ?? 'miraidon-ex-b3a-magnezone-b1a',
    games: games ? Number(games) : 1,
    iterations: iterations ? Number(iterations) : 1000,
    baseSeed: baseSeed ? Number(baseSeed) : 1,
  }
}

/** Play one full game to completion, recording every decision in play order. */
function playGame(args: Args, seed: number, firstPlayer: PlayerIndex): RecordedGame {
  let state: GameState = createGame(args.deckA, args.deckB, { seed, firstPlayer })
  // One search RNG for the whole game, seeded off the game seed but otherwise
  // independent of the game's own RNG stream.
  const searchRng = makeRng(seed * 7919 + 17)
  const decisions: RecordedDecision[] = []

  let guard = 0
  while (state.phase !== 'gameOver' && guard++ < 20000) {
    const seat = actingPlayer(state)
    if (seat === null) break
    const { best, winProb, ranked } = search(state, seat, { iterations: args.iterations, rng: searchRng })
    decisions.push({ seat, move: best, winProb, ranked })
    state = apply(state, best).state
  }

  return {
    matchup: `${args.deckA}__vs__${args.deckB}`,
    deckA: args.deckA,
    deckB: args.deckB,
    seed,
    firstPlayer,
    winner: state.winner,
    iterations: args.iterations,
    decisions,
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const matchup = `${args.deckA}__vs__${args.deckB}`
  const outDir = join(GAMES_DIR, matchup)
  mkdirSync(outDir, { recursive: true })

  console.log(`Self-play: ${matchup}`)
  console.log(`  games=${args.games} iterations=${args.iterations} baseSeed=${args.baseSeed}`)

  let aWins = 0
  let decided = 0
  const startedAt = Date.now()

  for (let g = 0; g < args.games; g++) {
    const seed = args.baseSeed + g
    // First player is a function of the seed (not the game index), so a game is
    // reproducible whether run in this batch or as a standalone seed, and the set
    // stays balanced. Even seeds: P1 starts; odd seeds: P2 starts.
    const firstPlayer: PlayerIndex = (seed % 2) as PlayerIndex
    const t0 = Date.now()
    const recorded = playGame(args, seed, firstPlayer)

    // Zero-padded so files sort naturally (00.json, 01.json, … 19.json).
    const file = join(outDir, `${String(seed).padStart(2, '0')}.json`)
    writeFileSync(file, JSON.stringify(recorded))

    if (recorded.winner !== null) {
      decided++
      if (recorded.winner === 0) aWins++
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    const result = recorded.winner === null ? 'draw (turn limit)' : `P${recorded.winner + 1} wins`
    console.log(
      `  [${g + 1}/${args.games}] seed ${seed} → ${result}` +
        ` (${recorded.decisions.length} decisions, ${secs}s) → ${file}`,
    )
  }

  const mins = ((Date.now() - startedAt) / 60000).toFixed(1)
  const rate = decided > 0 ? ((aWins / decided) * 100).toFixed(1) : 'n/a'
  console.log(`Done in ${mins}m. Deck A win-rate: ${rate}% (${aWins}/${decided} decided).`)
}

main()
