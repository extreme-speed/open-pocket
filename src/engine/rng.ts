// Seedable PRNG (mulberry32) for reproducible shuffles and coin flips.
//
// The state is a single 32-bit integer carried on GameState, so the whole game
// is deterministic given the initial seed. RNG helpers MUTATE the passed-in
// state object — the reducer clones GameState before applying a move, so this
// stays pure at the apply() boundary.

export interface RngState {
  /** Current 32-bit internal state; advances on every draw. */
  seed: number
}

export function makeRng(seed: number): RngState {
  // Mix the seed a little so small seeds (0, 1, 2…) don't produce similar streams.
  return { seed: (seed ^ 0x9e3779b9) >>> 0 }
}

/** Next float in [0, 1); advances the state. */
export function nextFloat(rng: RngState): number {
  rng.seed = (rng.seed + 0x6d2b79f5) | 0
  let t = rng.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Integer in [0, n); advances the state. */
export function nextInt(rng: RngState, n: number): number {
  return Math.floor(nextFloat(rng) * n)
}

/** Coin flip; heads === true. */
export function flipCoin(rng: RngState): boolean {
  return nextFloat(rng) < 0.5
}

/** Fisher–Yates shuffle returning a new array; advances the state. */
export function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Pick a uniformly random element; throws on an empty array. */
export function pickRandom<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickRandom: empty array')
  return items[nextInt(rng, items.length)]
}
