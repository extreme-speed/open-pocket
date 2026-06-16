import { useEffect } from 'react'
import { getCard } from '../../engine/data/cards'
import { ENERGY_STYLE, groupEnergy } from '../energy'
import { useGame } from '../store'
import { CardView } from './Card'

/** The contents of a player's discard pile, shown as a readable grid. Click a
 *  card to enlarge it; click the backdrop or press Escape to dismiss. */
export default function DiscardModal() {
  const owner = useGame((s) => s.discardView)
  const setDiscardView = useGame((s) => s.setDiscardView)
  const setPreview = useGame((s) => s.setPreview)
  const discard = useGame((s) => (s.discardView === null ? null : s.state!.players[s.discardView].discard))
  const discardedEnergy = useGame((s) =>
    s.discardView === null ? null : s.state!.players[s.discardView].discardedEnergy,
  )

  useEffect(() => {
    if (owner === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDiscardView(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [owner, setDiscardView])

  if (owner === null || discard === null) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Player ${owner + 1} discard pile`}
      onClick={() => setDiscardView(null)}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-bold text-amber-300">
            Player {owner + 1} — Discard ({discard.length})
          </h2>
          <button
            type="button"
            onClick={() => setDiscardView(null)}
            className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Close ✕
          </button>
        </div>
        {discardedEnergy && discardedEnergy.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Energy</span>
            {groupEnergy(discardedEnergy).map(({ type, count }) => (
              <span
                key={type}
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-1 ring-white/60 ${ENERGY_STYLE[type].bg}`}
                title={`${count} ${type}`}
              >
                {ENERGY_STYLE[type].glyph}
                {count > 1 ? count : ''}
              </span>
            ))}
          </div>
        )}
        {discard.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            {discardedEnergy && discardedEnergy.length > 0
              ? 'No cards discarded yet.'
              : 'The discard pile is empty.'}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 overflow-y-auto p-4 sm:grid-cols-5">
            {discard.map((id, i) => (
              <CardView key={`${id}-${i}`} card={getCard(id)} size="sm" onClick={() => setPreview(id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
