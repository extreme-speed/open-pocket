import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCard } from '../../engine/data/cards'
import type { Move } from '../../engine/types'
import type { RankedMove, RecordedDecision, RecordedGame } from '../../ai/types'
import { useGame } from '../store'
import Board from '../components/Board'

/** Recorded games bundled from the offline runner's output directory. Vite
 *  resolves this glob at build/dev time, so any game written under games/ shows
 *  up here automatically. */
const bundled = import.meta.glob<RecordedGame>('/games/**/*.json', { import: 'default' })

/** A short human label for a recorded move (annotation + ranked list). */
function describeMove(move: Move): string {
  switch (move.type) {
    case 'SetupActive':
    case 'SetupBench':
    case 'PlayBasic':
      return `Play ${getCard(move.cardId).name}`
    case 'SetupDone':
      return 'Finish setup'
    case 'Evolve':
    case 'RareCandyEvolve':
      return `Evolve into ${getCard(move.cardId).name}`
    case 'AttachEnergy':
      return 'Attach Energy'
    case 'AttachTool':
      return `Attach ${getCard(move.cardId).name}`
    case 'PlayItem':
    case 'PlaySupporter':
    case 'PlayStadium':
      return getCard(move.cardId).name
    case 'Retreat':
      return 'Retreat'
    case 'UseAbility':
      return 'Use Ability'
    case 'Attack':
      return `Attack #${move.attackIndex + 1}`
    case 'EndTurn':
      return 'End turn'
    case 'KOReplace':
      return 'Promote new Active'
    case 'AttackChoice':
      return `Discard ${getCard(move.cardId).name}`
  }
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`
}

/** The picker shown before a game is loaded. */
function Loader({ onLoad }: { onLoad: (rg: RecordedGame) => void }) {
  const [error, setError] = useState<string | null>(null)
  const paths = useMemo(() => Object.keys(bundled).sort(), [])

  const openBundled = async (path: string) => {
    setError(null)
    try {
      onLoad(await bundled[path]())
    } catch {
      setError(`Could not load ${path}`)
    }
  }

  const openFile = async (file: File) => {
    setError(null)
    try {
      onLoad(JSON.parse(await file.text()) as RecordedGame)
    } catch {
      setError('That file is not a valid recorded game.')
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Replay a recorded game</h1>
          <p className="text-sm text-slate-400">
            Step through an AI self-play game with the win% and alternatives it considered at each move.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">From games/</h2>
          {paths.length === 0 ? (
            <p className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-400">
              No recorded games found. Run <code className="text-amber-300">npm run selfplay</code> to generate some.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {paths.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => openBundled(p)}
                    className="w-full truncate rounded-lg bg-slate-900 px-3 py-2 text-left text-sm hover:bg-slate-800"
                  >
                    {p.replace('/games/', '')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Or upload a file</h2>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void openFile(f)
            }}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:font-semibold file:text-slate-900"
          />
        </section>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <Link to="/" className="block text-center text-sm text-slate-400 underline hover:text-slate-200">
          ← Back to decks
        </Link>
      </div>
    </div>
  )
}

/** One ranked alternative row. */
function RankRow({ rank, best }: { rank: RankedMove; best: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs ${
        best ? 'bg-amber-500/15 text-amber-200' : 'text-slate-300'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">
        {best && '★ '}
        {describeMove(rank.move)}
      </span>
      <span className="tabular-nums text-slate-400">{rank.visits}v</span>
      <span className="w-9 text-right tabular-nums font-semibold">{pct(rank.winProb)}</span>
    </div>
  )
}

/** The side panel describing the move about to be played. */
function Annotation({ decision, index, total }: { decision: RecordedDecision | null; index: number; total: number }) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-xl">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Decision {Math.min(index + 1, total)} / {total}
        </span>
        {decision && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            Player {decision.seat + 1}
          </span>
        )}
      </div>

      {decision ? (
        <>
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-amber-300">{describeMove(decision.move)}</div>
            <div className="text-xs text-slate-400">
              win probability <span className="font-semibold text-slate-200">{pct(decision.winProb)}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Considered</div>
            {decision.ranked.slice(0, 6).map((r, i) => (
              <RankRow key={i} rank={r} best={i === 0} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-400">End of game.</div>
      )}
    </div>
  )
}

export default function Replay() {
  const start = useGame((s) => s.start)
  const dispatch = useGame((s) => s.dispatch)
  const hasGame = useGame((s) => s.state !== null)

  const [recorded, setRecorded] = useState<RecordedGame | null>(null)
  // `cursor` is the index of the next decision to apply (0 = start of game).
  const [cursor, setCursor] = useState(0)

  const load = useCallback(
    (rg: RecordedGame) => {
      start(rg.deckA, rg.deckB, { seed: rg.seed, firstPlayer: rg.firstPlayer })
      setRecorded(rg)
      setCursor(0)
    },
    [start],
  )

  /** Rebuild the game state to exactly `target` applied decisions. Forward steps
   *  dispatch incrementally (so the last move animates); backward steps restart
   *  and fast-forward (undo history is bounded, this is exact). */
  const seek = useCallback(
    (target: number) => {
      if (!recorded) return
      const t = Math.max(0, Math.min(recorded.decisions.length, target))
      if (t > cursor) {
        for (let i = cursor; i < t; i++) dispatch(recorded.decisions[i].move)
      } else if (t < cursor) {
        start(recorded.deckA, recorded.deckB, { seed: recorded.seed, firstPlayer: recorded.firstPlayer })
        for (let i = 0; i < t; i++) dispatch(recorded.decisions[i].move)
      }
      setCursor(t)
    },
    [recorded, cursor, dispatch, start],
  )

  if (!recorded || !hasGame) return <Loader onLoad={load} />

  const total = recorded.decisions.length
  const upcoming = cursor < total ? recorded.decisions[cursor] : null

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-slate-950">
      {/* The board is display-only here — stepping is driven by the controls
          below, never by tapping the mat. */}
      <div className="pointer-events-none h-full select-none">
        <Board />
      </div>

      {/* Replay control bar + annotation, overlaid on the board. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3">
        <div className="pointer-events-auto w-full max-w-md">
          <Annotation decision={upcoming} index={cursor} total={total} />
        </div>

        <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 shadow-xl">
          <button
            type="button"
            onClick={() => seek(0)}
            disabled={cursor === 0}
            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={() => seek(cursor - 1)}
            disabled={cursor === 0}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <input
            type="range"
            min={0}
            max={total}
            value={cursor}
            onChange={(e) => seek(Number(e.target.value))}
            className="min-w-0 flex-1 accent-amber-400"
          />
          <button
            type="button"
            onClick={() => seek(cursor + 1)}
            disabled={cursor >= total}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-40"
          >
            Next ›
          </button>
          <button
            type="button"
            onClick={() => {
              setRecorded(null)
              setCursor(0)
            }}
            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="pointer-events-none text-[11px] text-slate-400">
          {recorded.matchup.replace('__vs__', '  vs  ')} · seed {recorded.seed} ·{' '}
          {recorded.winner === null ? 'unfinished' : `Player ${recorded.winner + 1} wins`}
        </div>
      </div>
    </div>
  )
}
