import type { PlayerIndex } from '../../engine/types'
import { useGame } from '../store'
import { usePokemonTap } from '../useBoardTap'
import { EmptySlot } from './Card'
import { InPlayCard } from './InPlayCard'

/** The Active Spot for one player. Tap to act on it (or read it); the bottom
 *  ActionBar shows what the tap offers. */
export default function ActiveSpot({
  owner,
  size = 'lg',
}: {
  owner: PlayerIndex
  size?: 'md' | 'lg' | 'xl'
}) {
  const pokemon = useGame((s) => s.state!.players[owner].active)
  const tap = usePokemonTap(pokemon?.uid ?? '', pokemon?.cardId ?? '')

  if (!pokemon) return <EmptySlot size={size} label="No Active" />
  return <InPlayCard pokemon={pokemon} size={size} onClick={tap.onClick} selectable={tap.highlighted} />
}
