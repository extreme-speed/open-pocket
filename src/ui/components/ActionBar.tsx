import { actingPlayer } from '../../engine/moves'
import { inPlay } from '../../engine/rules'
import { currentTargeting, type Selection } from '../selection'
import { useGame } from '../store'

/** A small pill button for the bar (Cancel, End Turn, Undo, …). */
function Pill({
  onClick,
  disabled,
  tone = 'plain',
  children,
}: {
  onClick: () => void
  disabled?: boolean
  tone?: 'plain' | 'primary'
  children: React.ReactNode
}) {
  const styles =
    tone === 'primary'
      ? 'bg-amber-400 text-slate-950 ring-amber-300/50 hover:bg-amber-300'
      : 'bg-slate-800 text-slate-200 ring-white/10 hover:bg-slate-700'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold shadow ring-1 ${styles} disabled:bg-slate-800/50 disabled:text-slate-600 disabled:ring-0 disabled:shadow-none`}
    >
      {children}
    </button>
  )
}

/**
 * The status bar pinned under the board. It is intentionally thin: actions are
 * chosen by tapping cards (which open in the preview with their actions listed).
 * The bar only carries what has no card of its own — End Turn / Done placing and
 * Undo — and, while you're picking a target on the board, a prompt with Cancel.
 */
export default function ActionBar() {
  const state = useGame((s) => s.state!)
  const moves = useGame((s) => s.moves)
  const selection: Selection = useGame((s) => s.selection)
  const dispatch = useGame((s) => s.dispatch)
  const cancel = useGame((s) => s.cancelSelection)
  const undo = useGame((s) => s.undo)
  const canUndo = useGame((s) => s.history.length > 0)

  if (state.phase === 'gameOver') return null
  const acting = actingPlayer(state)
  if (acting === null) return null

  const undoBtn = (
    <Pill onClick={undo} disabled={!canUndo} tone="primary">
      ↶ Undo
    </Pill>
  )

  // Target-picking — the board is hot; the bar just prompts and offers Cancel.
  const targeting = currentTargeting(state, moves, selection)
  if (targeting) {
    const forced = selection.kind !== 'target' // KO replacement / discard choice
    return (
      <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-900/95 px-3 py-2">
        <span className="min-w-0 truncate text-sm font-bold text-amber-300">
          {targeting.label} — tap a highlighted target
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {!forced && <Pill onClick={cancel}>Cancel</Pill>}
          {undoBtn}
        </div>
      </div>
    )
  }

  // Nothing selected — phase buttons (End Turn / Done placing) + a hint.
  const barMoves = moves.filter((m) => m.type === 'EndTurn' || m.type === 'SetupDone')
  const hasCards = inPlay(state.players[acting]).length > 0 || state.players[acting].hand.length > 0
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-slate-900/95 px-3 py-2">
      <span className="min-w-0 truncate text-xs font-semibold text-slate-400">
        {hasCards ? 'Tap a highlighted card to act' : 'Your move'}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {barMoves.map((m) => (
          <Pill key={m.type} onClick={() => dispatch(m)} tone={m.type === 'SetupDone' ? 'primary' : 'plain'}>
            {m.type === 'EndTurn' ? 'End Turn' : 'Done placing'}
          </Pill>
        ))}
        {undoBtn}
      </div>
    </div>
  )
}
