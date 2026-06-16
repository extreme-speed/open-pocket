import { useEffect } from 'react'
import { getCard } from '../../engine/data/cards'
import type { Move } from '../../engine/types'
import { groupActions } from '../moveHelpers'
import { movesForSource } from '../selection'
import { useGame } from '../store'
import ActionList from './ActionList'

/** A ‹ / › browse button, overlaid on the card's left/right edge so the card
 *  stays centred and both arrows are always on-screen, even on a narrow phone. */
function Arrow({ dir, disabled, onStep }: { dir: -1 | 1; disabled: boolean; onStep: (d: -1 | 1) => void }) {
  const side = dir === -1 ? 'left-1' : 'right-1'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onStep(dir)
      }}
      disabled={disabled}
      aria-label={dir === -1 ? 'Previous card' : 'Next card'}
      className={`absolute top-1/2 ${side} z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/80 text-xl font-bold text-slate-100 shadow ring-1 ring-white/20 hover:bg-slate-700 disabled:opacity-20`}
    >
      {dir === -1 ? '‹' : '›'}
    </button>
  )
}

/**
 * The enlarged single-card view. Tapping any card opens it here; if the card can
 * act (it was tapped as a source) its actions are listed underneath, so reading a
 * card and playing it are the same gesture. A Pokémon with an evolution stack or
 * an attached tool can be browsed card-by-card with the ‹ › arrows (or ← →);
 * actions show on its current top card. Choosing an action plays it (closing the
 * view) or, when it needs a choice, hands off to board target-picking. Tap the
 * backdrop or press Escape to dismiss.
 */
export default function CardPreview() {
  const preview = useGame((s) => s.preview)
  const state = useGame((s) => s.state)
  const moves = useGame((s) => s.moves)
  const dispatch = useGame((s) => s.dispatch)
  const enterTargeting = useGame((s) => s.enterTargeting)
  const setPreview = useGame((s) => s.setPreview)
  const previewStep = useGame((s) => s.previewStep)

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null)
      else if (e.key === 'ArrowLeft') previewStep(-1)
      else if (e.key === 'ArrowRight') previewStep(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, setPreview, previewStep])

  if (!preview) return null
  const card = getCard(preview.cards[preview.index])
  const multi = preview.cards.length > 1
  const onMain = preview.index === preview.mainIndex

  // Actions belong to the Pokémon as a whole, so only show them on its top card.
  const groups =
    preview.source && onMain && state
      ? groupActions(state, movesForSource(state, moves, preview.source))
      : []

  const onPlay = (move: Move) => dispatch(move) // dispatch clears the preview
  const onTarget = (label: string, ms: Move[]) => {
    enterTargeting(label, ms)
    setPreview(null)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      onClick={() => setPreview(null)}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950/80 p-6"
    >
      <div className="relative flex max-w-full items-center justify-center">
        <img
          src={card.image}
          alt={card.name}
          className="max-h-[58vh] w-auto max-w-full rounded-2xl shadow-2xl"
        />
        {multi && <Arrow dir={-1} disabled={preview.index === 0} onStep={previewStep} />}
        {multi && <Arrow dir={1} disabled={preview.index === preview.cards.length - 1} onStep={previewStep} />}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span>{card.name}</span>
        {multi && (
          <span className="tabular-nums text-xs text-slate-400">
            {preview.index + 1} / {preview.cards.length}
          </span>
        )}
      </div>
      {groups.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm overflow-y-auto"
          style={{ maxHeight: '26vh' }}
        >
          <ActionList groups={groups} onPlay={onPlay} onTarget={onTarget} />
        </div>
      )}
    </div>
  )
}
