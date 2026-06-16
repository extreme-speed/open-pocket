import type { PlayerIndex } from '../../engine/types'
import { useGame } from '../store'
import PointsTracker from './PointsTracker'

function Count({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const className =
    'flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white'
  const inner = (
    <>
      <span className="text-slate-400">{label}</span>
      <span className="tabular-nums">{value}</span>
    </>
  )
  if (!onClick) return <span className={className}>{inner}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={value === 0}
      className={`${className} ring-1 ring-amber-400/40 hover:bg-slate-800 disabled:ring-0 disabled:hover:bg-slate-900/70`}
    >
      {inner}
    </button>
  )
}

/** Per-player status strip: who, win-condition pips, and the zone counts. The
 *  discard count opens that pile's contents in a modal. */
export default function PlayerHud({ owner, you = false }: { owner: PlayerIndex; you?: boolean }) {
  const p = useGame((s) => s.state!.players[owner])
  const setDiscardView = useGame((s) => s.setDiscardView)
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className={`text-xs font-bold ${you ? 'text-amber-300' : 'text-slate-300'}`}>
        Player {owner + 1}
        {you ? ' (you)' : ''}
      </span>
      <PointsTracker owner={owner} />
      <Count label="Hand" value={p.hand.length} />
      <Count label="Deck" value={p.deck.length} />
      <Count label="Discard" value={p.discard.length} onClick={() => setDiscardView(owner)} />
    </div>
  )
}
