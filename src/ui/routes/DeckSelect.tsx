import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { decks } from '../../engine/data/cards'
import type { PlayerIndex } from '../../engine/types'
import { loadDeckSelection, saveDeckSelection } from '../persistence'
import { useGame } from '../store'

/** A saved deck id is only usable if that deck still exists; otherwise fall back. */
const isDeck = (id: string | undefined): id is string => decks.some((d) => d.id === id)
const saved = loadDeckSelection()

function DeckPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (id: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-left">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg bg-slate-800 px-3 py-2 text-slate-100 ring-1 ring-slate-600"
      >
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title} ({d.energyTypes.join('/')})
          </option>
        ))}
      </select>
    </label>
  )
}

export default function DeckSelect() {
  const navigate = useNavigate()
  const start = useGame((s) => s.start)
  const abandon = useGame((s) => s.abandon)
  const hasGame = useGame((s) => s.state !== null)
  const [deckA, setDeckA] = useState(isDeck(saved?.deckA) ? saved.deckA : decks[1].id) // Fire
  const [deckB, setDeckB] = useState(isDeck(saved?.deckB) ? saved.deckB : decks[2].id) // Water
  const [first, setFirst] = useState<'random' | 0 | 1>(saved?.first ?? 'random')

  // Remember the player's setup choices for next time.
  useEffect(() => {
    saveDeckSelection({ deckA, deckB, first })
  }, [deckA, deckB, first])

  const begin = () => {
    const opts =
      first === 'random'
        ? { seed: Date.now() % 1_000_000 }
        : { seed: Date.now() % 1_000_000, firstPlayer: first as PlayerIndex }
    start(deckA, deckB, opts)
    navigate('/game')
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 px-4 text-slate-100">
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-5xl font-black tracking-tight text-transparent">
          Open Pocket
        </h1>
        <p className="mt-1 text-sm text-slate-400">Pokémon TCG Pocket — hotseat battle</p>
      </div>

      {hasGame && (
        <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-xl bg-slate-800/70 p-4 ring-1 ring-amber-400/40">
          <p className="text-sm text-slate-300">You have a game in progress.</p>
          <button
            type="button"
            onClick={() => navigate('/game')}
            className="rounded-full bg-amber-400 px-8 py-2 text-base font-semibold text-slate-900 hover:bg-amber-300"
          >
            Resume battle
          </button>
          <button
            type="button"
            onClick={abandon}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Discard saved game
          </button>
        </div>
      )}

      <div className="flex w-full max-w-sm flex-col gap-4">
        <DeckPicker label="Player 1 deck" value={deckA} onChange={setDeckA} />
        <DeckPicker label="Player 2 deck" value={deckB} onChange={setDeckB} />

        <label className="flex flex-col gap-1 text-left">
          <span className="text-sm font-semibold text-slate-300">Who goes first?</span>
          <select
            value={String(first)}
            onChange={(e) => setFirst(e.target.value === 'random' ? 'random' : (Number(e.target.value) as 0 | 1))}
            className="rounded-lg bg-slate-800 px-3 py-2 text-slate-100 ring-1 ring-slate-600"
          >
            <option value="random">Random</option>
            <option value="0">Player 1</option>
            <option value="1">Player 2</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={begin}
        className={`rounded-full px-8 py-2.5 text-lg font-semibold ${
          hasGame
            ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
            : 'bg-amber-400 text-slate-900 hover:bg-amber-300'
        }`}
      >
        {hasGame ? 'Start new battle' : 'Start battle'}
      </button>
    </main>
  )
}
