import { MAX_BENCH } from '../../engine/setup'
import type { InPlayPokemon, PlayerIndex } from '../../engine/types'
import { useGame } from '../store'
import { usePokemonTap } from '../useBoardTap'
import { EmptySlot } from './Card'
import { InPlayCard } from './InPlayCard'

/** One benched Pokémon — split out so it can own its tap hook. */
function BenchPokemon({ pokemon }: { pokemon: InPlayPokemon }) {
  const tap = usePokemonTap(pokemon.uid, pokemon.cardId)
  return <InPlayCard pokemon={pokemon} size="sm" onClick={tap.onClick} selectable={tap.highlighted} />
}

/** A player's Bench (up to 3), with empty slots filled in. Tap a Pokémon to act
 *  on it (or read it). */
export default function Bench({ owner }: { owner: PlayerIndex }) {
  const bench = useGame((s) => s.state!.players[owner].bench)
  const empties = Math.max(0, MAX_BENCH - bench.length)

  return (
    <div className="flex items-center gap-2">
      {bench.map((p) => (
        <BenchPokemon key={p.uid} pokemon={p} />
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <EmptySlot key={`empty-${i}`} size="sm" />
      ))}
    </div>
  )
}
