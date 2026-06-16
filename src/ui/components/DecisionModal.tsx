import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGame } from '../store'

function Overlay({ labelledBy, children }: { labelledBy: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Move focus into the dialog when it opens so keyboard users land on it.
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 p-4">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="max-w-md rounded-xl bg-slate-800 p-5 text-center text-white shadow-2xl outline-none"
      >
        {children}
      </div>
    </div>
  )
}

/**
 * The game-over banner. Forced mid-game choices (choosing a new Active after a
 * KO or a self-bounce) are *not* handled here — they appear as ordinary rows in
 * the Action Panel, so the Undo button beside them stays reachable. A blocking
 * overlay here would cover the sidebar and trap the player into the choice.
 */
export default function DecisionModal() {
  const state = useGame((s) => s.state!)

  if (state.phase === 'gameOver' && state.winner !== null) {
    return (
      <Overlay labelledBy="dialog-gameover">
        <h2 id="dialog-gameover" className="text-2xl font-bold">
          Player {state.winner + 1} wins! 🏆
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          {state.players[state.winner].points} points scored.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-full bg-amber-400 px-5 py-2 font-semibold text-slate-900 hover:bg-amber-300"
        >
          New game
        </Link>
      </Overlay>
    )
  }

  return null
}
