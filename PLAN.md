# PLAN — Offline optimal-play analyzer + replay

## Goal

Learn to play a deck well in a fixed matchup (e.g. Blaziken vs Miraidon). **Offline
only**: run many self-play games for the matchup (can take hours), save them, then
**replay any game in the UI** ("Next" steps a move forward, "Prev" rewinds) with the
AI's reasoning shown for each move. No online/in-game suggestion mode for now.

## Approach

**Single-Observer IS-MCTS with determinization**, value-cutoff rollouts using a value
function ported from deckgym-core. Not AlphaZero / not true GTO (imperfect-info +
stochastic game — see end). The determinization is what makes the advice honest: the AI
only "knows" what its seat legitimately sees, never the opponent's hand.

The engine already gives us everything: `legalMoves(state)`, pure `apply(state, move)`,
`actingPlayer(state)`, terminal via `state.winner`. Randomness lives on the state
(`rng` seed) + deck order, so games are fully reproducible from a seed.

### Algorithm (SO-ISMCTS, Cowling et al. 2012)
One shared tree; **re-sample a hidden world each iteration** (avoids PIMC strategy
fusion). Per iteration: determinize → UCB-select over moves legal in *that* world →
expand → roll out with a heuristic policy, cut off after N plies and score with the
value function → backprop, reading `actingPlayer` at each node (tree spans setup / main
/ KO-replacement / attack-choice phases uniformly, since `legalMoves` handles them all).

### World sampler (the crux, the part deckgym lacks)
`observe(state, seat)` → one seat's knowledge; `sampleWorld(obs, rng)` → a consistent
full state. Tight because both decklists are known:
- Opp hand = random draw (known size) from their unseen pool (decklist − cards seen).
- Opp deck = the rest, shuffled. Our own deck = our decklist − hand − in-play − discard,
  shuffled (our draw order is hidden from us too).
- All public state (boards, energy, discards, points, stadium) copied verbatim.

## Measured cost (Blaziken vs Miraidon, single thread, Node)
~79 full random playouts/sec, ~153 moves/game, ~12k `apply()`/sec. `apply`'s
`structuredClone` is essentially the whole cost. Offline runs absorb this; value-cutoff
rollouts (short + low-noise) are what make iterations count.

---

## What to build

### 1. Harvest from deckgym-core (`src/ai/eval.ts`, `src/ai/policies.ts`)
- Port the parametric **value function** (`players/value_functions.rs`) — linear combo
  of: points (dominant), pokémon value, hand/deck size, active retreat cost, active
  "online" score (can it attack), active safety, has-tool, is-winner,
  turns-until-opponent-wins, online-pokémon count, energy-distance-to-online, opp
  discard. Start with their baseline weights; re-tune later.
- Port 2–3 **simple players** (AttachAttack, EndTurn, EvolutionRusher) as the rollout
  policy *and* as benchmark opponents.
- **Cross-check**: simulate the matchup with these simple players and confirm our
  engine's win-rate is sane / matches deckgym's order of magnitude.

### 2. Observation + world sampler (`src/ai/observation.ts`)
`observe(state, seat)` and `sampleWorld(obs, rng)` as above. Unit-tested: a sampled
world is always legal, reproduces all public state, and never reveals hidden cards.

### 3. IS-MCTS search (`src/ai/ismcts.ts`)
Proper UCB1 selection (availability-aware), heuristic rollout + value cutoff. Returns
`{ best: Move, winProb: number, ranked: {move, visits, winProb}[] }`. Validate on
hand-picked positions: takes lethal, doesn't retreat pointlessly, attaches to the
attacker.

### 4. Self-play runner (`scripts/selfplay.ts`, run via vitest-style harness)
Drives both seats with the searcher for one matchup, N games, writes recorded games to
`games/<matchup>/<seed>.json`. CLI args: deckA, deckB, games, iterations, base seed.
Print progress + final win-rate. This is the **overnight job**.

### 5. Replay mode in the UI (`src/ui/routes/Replay.tsx` + store hook)
Load a recorded game JSON. Reuse the existing store: `start(deckA, deckB, {seed,
firstPlayer})` then **"Next" = `dispatch(recorded.moves[cursor])`**, **"Prev" =
`undo()`**. The engine reconstructs every state/chance outcome deterministically from
the seed — we only replay the move list. A side panel shows the current decision's
annotation (chosen move, its win%, and the ranked alternatives the AI considered).
Near-free: it rides the existing dispatch→frames→log→animation pipeline.

### Recorded-game format (contract between #4 and #5)
```jsonc
{
  "matchup": "mega-blaziken-ex-b1-greninja-a1__vs__miraidon-ex-b3a-magnezone-b1a",
  "deckA": "mega-blaziken-ex-b1-greninja-a1",
  "deckB": "miraidon-ex-b3a-magnezone-b1a",
  "seed": 12345,
  "firstPlayer": 0,
  "winner": 0,
  "iterations": 2000,
  "decisions": [
    { "seat": 0,
      "move": { "type": "Attack", "attackIndex": 1 },
      "winProb": 0.62,
      "ranked": [ { "move": {/*…*/}, "winProb": 0.62, "visits": 1400 },
                  { "move": {/*…*/}, "winProb": 0.48, "visits": 300 } ] }
    // … one per decision, in play order
  ]
}
```
`decisions[i].move` applied in order from `createGame(deckA, deckB, {seed, firstPlayer})`
exactly reproduces the game (search uses a *separate* RNG, so it never perturbs the real
line).

## Validation / definition of done
- World sampler never leaks hidden info (test).
- Searcher passes the hand-picked tactical positions.
- One overnight run produces replayable games; opening a replay and clicking through
  shows sane play + per-move win% and alternatives.

## Decisions (settled)
Eval bias accepted (port deckgym, re-tune later) · single-observer opponent model ·
"optimal" = highest win% vs an also-maximizing opponent over hidden cards/luck, not a
fixed script · perf: ignore `structuredClone`/Workers until the offline run is too slow
to be useful, then revisit.

## Prior art: deckgym-core (`bcollazo/deckgym-core`, reviewed)
- **No player handles hidden info** — both search players read the full `State` (cheat);
  expectiminimax even has a `TODO` admitting it. Our determinization is the real gain.
- **`MctsPlayer` is naive** (random child selection, no UCT; reward-not-visits) — don't copy.
- **`ExpectiMiniMaxPlayer`** is the strong one: depth-limited expectiminimax with explicit
  chance branching + value fn at leaves. We borrow its value fn, not its search.
- **`value_functions.rs`** — tuned (grid-searched) linear eval → our `eval.ts` starting point.
- **Simple players** → our rollout policies + benchmark opponents + win-rate cross-check.
