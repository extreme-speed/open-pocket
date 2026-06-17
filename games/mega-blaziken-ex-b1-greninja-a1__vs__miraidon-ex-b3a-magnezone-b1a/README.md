# Mega Blaziken ex / Greninja  vs  Miraidon ex / Magnezone — Strategy Notes

Derived from the 20 recorded IS-MCTS self-play games in this folder (2000 iterations per
decision). Every claim below was checked by replaying the recorded move lists through the
engine and reading the actual board state and the searcher's ranked alternatives
(see `scripts/dump-states.ts`), or by reading the rules code directly.

## Result

| | Games |
|---|---|
| Deck A (Mega Blaziken ex / Greninja) wins | **11** |
| Deck B (Miraidon ex / Magnezone) wins | **8** |
| Draw (30-turn cap) | 1 |
| First player won | 9 / 20 |

Roughly **55/45 to A**, with **no meaningful first-player advantage**. The two aces don't
share a weakness axis (Blaziken is Water-weak, Miraidon is Fighting-weak — neither is in the
other deck), so the matchup is decided by **setup tempo and resource disruption**, not type.

## The core dynamic

- **A is a glass-cannon combo deck.** Its win rate is gated almost entirely on assembling
  **Mega Blaziken ex**: reached it → **11 W / 3 L / 1 D (73%)**; failed to reach a Stage 2 →
  **0 W / 4 L**, and those losses are fast (20–45 plies). A's defense is **speed**.
- **B is a tempo/disruption deck.** Its plan is to **gust A's baby evolution pieces and KO
  them before they evolve**, race with cheap Lightning attackers, and hold Miraidon as a
  mid-game energy-pull reset. B intentionally **under-evolves**: Magneton appeared in 19/20
  games but Magnezone in only 9 — Magneton's energy-accel ability is the real engine; the
  Stage 2 is a luxury.

---

## Setup / what to bench

### Deck A: lead with the disposable line, bench (protect) the primary line
When A holds both Froakie and Torchic, **put Froakie active and bench Torchic** (engine did
this 3/3: game 00 0.437 vs 0.390, game 16 0.36 vs 0.276). It is not that Froakie is a good
lead — it's that **Torchic → Combusken → Mega Blaziken ex is the win condition and must be
kept safe on the bench**. Froakie → Greninja is optional tech, so Froakie is the throwaway
that eats a turn while the real engine builds. (Froakie is Lightning-weak and *will* die —
that's the plan; it's 1 prize.)

> Caveat: this protection is imperfect because **B's Sabrina/Cyrus can gust Torchic out of
> the bench anyway** (see Disruption). A's only real answer is Rare Candy speed.

### Deck B: lead the Miraidon wall, or hold Miraidon in hand — never bench it at setup
- **Benching Miraidon at setup is a trap.** `SetupBench` creates the Pokémon with
  `enteredBenchThisTurn = false`, and Miraidon's switch-and-pull ability *requires* that flag
  (it only fires when Miraidon is played from hand **during the main phase**). A
  setup-benched Miraidon is a 140-HP body stuck behind your active with **retreat cost 2 and
  its signature ability gone forever**.
- **Hold Miraidon in hand when you have another basic to lead with** (Magnemite/Zeraora) —
  deploy it mid-game once Magneton has built an energy pile, so the drop-and-switch dumps a
  whole stack onto a fresh 140-HP body for a big scaling Hadron Ray. The engine does exactly
  this in games 13 (Magnemite active, Miraidon held → win) and 08 (second Miraidon held as a
  reset).
- **Lead Miraidon active when the alternative is a lone basic** (e.g. game 00, where the only
  other basic was Zeraora, so holding Miraidon = a benchless opening = catastrophic if KO'd).
  "3 energy to attack" is not a real tempo cost here: it's 3 *Colorless*, A can't break 140
  early (openers hit for 10–30 + a 20 snipe), Magneton + the zone fill it meanwhile, and
  **benched Zeraora still banks its turn-1 free energy** (the ability attaches "wherever it
  is"). Lead the wall, keep the fast attacker (Zeraora, retreat 1) fresh in reserve.

---

## When to retreat — four distinct triggers (seen in the data)

1. **Pivot off the disposable opener.** Froakie / Castform / Heatmor lead, eat a turn, retreat
   into the real attacker.
2. **Greninja goes straight to the bench.** Every time A Rare-Candies Froakie → Greninja while
   active, it retreats Greninja next chance (games 00, 01, 10, 11, 12, 15). Greninja's value
   is the **free 20 snipe from the bench** — it is never your active.
3. **Retreat clears Burn — B's main answer to Blaziken.** Leaving the active spot wipes status.
   B retreats a burned Zeraora at 40 HP (01) and a burned Magnezone at **10 HP** (03) — both
   would otherwise die at the checkup. If you pilot B, a burned active that can't survive the
   next checkup should retreat, not attack.
4. **Preserve the energy battery.** B retreats damaged Magneton/Magnezone (04 at 20 HP, 09, 12)
   to keep the engine alive — but the whole Magnemite line and Miraidon have **retreat cost 2**,
   so pay it only to save the engine or dodge a KO.

---

## The Copycat war — hand size is a weapon

Both decks run 2× Copycat, and **Copycat draws equal to the *opponent's* hand size** (it
shuffles your hand away first). Game **16** shows both edges in three turns:

- B let its hand balloon to **11** (flooded, couldn't deploy). A snapped Copycat → **drew 11**,
  refueled, and built its whole board (Rare Candy Greninja + Combusken + attack) in one turn.
- A then deliberately played down to **2 cards**. B's answering Copycat **drew only 2**,
  pitching 11 cards back into the deck for nothing.

Principles:
- **Never hoard against a Copycat deck** — a fat hand is a free refuel you hand the opponent.
  Loss-correlated hands are the 9–13 card spikes; the engine's healthy end-of-turn hand is ~5.
- **Empty your hand when ahead / when they hold Copycat** to cap their Copycat near zero.
- **Snap your own Copycat when *they're* flooded** (the draw-6/8/11 spots in 02 and 16), not
  as a generic draw-2.

---

## Disruption: same tools, opposite targets

- **B gusts A's *setup*.** Sabrina/Cyrus drag A's **Torchic/Froakie** out of the bench to KO
  the babies before they evolve (Sabrina on Torchic in 03, 09, 15, 16, 19; on Froakie in 19).
  This directly attacks A's only path to a Stage 2.
- **A gusts B's *resources*.** A's Cyrus drags up **Magnemite/Magneton** (04, 11, 16) to KO the
  energy battery, or pulls Miraidon/Magnezone aside so Greninja's snipe + Blaziken can clear a
  benched threat.

---

## Two non-obvious engine synergies

- **Flame Patch makes Blaziken a *repeating* attacker.** Mega Burning discards a Fire each use;
  A plays Flame Patch to recover a Fire from discard (used in 11/20 games, always around a Mega
  Burning). Without it Blaziken fires every *other* turn (it must re-attach 2 Fire from a
  1-per-turn zone). With it, it keeps swinging 120 + Burn. That single Item is A's real tempo
  engine — protect and sequence it.
- **Burn is a double tax that B sidesteps by retreating.** Mega Burning's Burn adds 20 at
  checkup *and* Blaziken discards its own Fire — but B simply retreats the burned active to
  clear it, so A leans on Greninja/Heatmor chip and gusts to actually close.

---

## One-sentence model

**A is a combo deck whose defense is speed (Rare Candy before the gust); B is a tempo deck that
gusts the babies, races with cheap Lightning, and holds Miraidon as an energy-pull reset — with
the Copycat/hand-size subgame running underneath, punishing whoever floods first.**

---

*Methodology: `node --experimental-strip-types --import ./scripts/register.mjs
scripts/dump-states.ts <this-folder>` replays each game deterministically and emits a
per-decision JSONL snapshot (hands, bench, energy, HP, points) alongside the chosen move and
the searcher's top-5 ranked alternatives.*
