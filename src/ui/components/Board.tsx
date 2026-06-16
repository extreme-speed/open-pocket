import { useState } from 'react'
import { Link } from 'react-router-dom'
import { other } from '../../engine/rules'
import type { PlayerIndex } from '../../engine/types'
import { useGame } from '../store'
import ActionBar from './ActionBar'
import ActiveSpot from './ActiveSpot'
import AttackChoiceModal from './AttackChoiceModal'
import Bench from './Bench'
import CardPreview from './CardPreview'
import DecisionModal from './DecisionModal'
import DiscardModal from './DiscardModal'
import EnergyZone from './EnergyZone'
import GameLog from './GameLog'
import Hand from './Hand'
import PlayerHud from './PlayerHud'
import Stadium from './Stadium'
import TurnBanner from './TurnBanner'

/** The Active Pokémon set apart in its own bordered box, beside the Bench. */
function ActiveBox({ owner }: { owner: PlayerIndex }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-amber-400/40 bg-amber-400/5 px-3 py-2 shadow-sm">
      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-300/80">Active</span>
      <ActiveSpot owner={owner} size="md" />
    </div>
  )
}

/** One player's field: Active box and Bench on a single line. */
function PlayerRow({ owner, children }: { owner: PlayerIndex; children?: React.ReactNode }) {
  return (
    <section className="flex flex-wrap items-end justify-center gap-4">
      <Stadium owner={owner} />
      <ActiveBox owner={owner} />
      <Bench owner={owner} />
      {children}
    </section>
  )
}

/** The full battle mat: opponent on top, you on the bottom, hand along the
 *  bottom edge. Flips when the perspective player changes. */
function Mat() {
  const seat = useGame((s) => s.viewPerspective)
  const opp = other(seat)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Everything fits within the mat — it never scrolls — so the whole board
          stays in view at once. */}
      <div
        key={seat}
        className="flip-in flex min-h-0 flex-1 flex-col justify-between gap-3 overflow-hidden px-4 py-3"
      >
        {/* Opponent (top) */}
        <div className="flex flex-col items-center gap-2">
          <PlayerHud owner={opp} />
          <PlayerRow owner={opp} />
        </div>

        <div className="mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

        {/* You (bottom) */}
        <div className="flex flex-col items-center gap-2">
          <PlayerRow owner={seat}>
            <EnergyZone owner={seat} />
          </PlayerRow>
          <PlayerHud owner={seat} you />
        </div>
      </div>

      {/* The hand keeps its own height and never overlaps the HUD above it. */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/60">
        <Hand />
      </div>
    </div>
  )
}

/**
 * The battle screen.
 *
 * There is no separate action panel: the board *is* the controller. Cards and
 * zones that can act glow; tap one and the bottom ActionBar shows what it offers
 * (and lets you read the card). Actions that need a target put the board into a
 * pick-a-target mode. On desktop a collapsible game-log rail sits on the left; on
 * mobile the log opens as a bottom sheet.
 *
 * The whole thing is locked to one dynamic-viewport height (`100dvh`) and never
 * scrolls as a page — only the inner regions scroll. The perspective player is
 * always at the bottom of the mat; the mat flips when the turn hands off.
 */
export default function Board() {
  const logCount = useGame((s) => s.log.length)
  const [logOpen, setLogOpen] = useState(false)
  const [logRailOpen, setLogRailOpen] = useState(true)

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header: status + global controls. */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-slate-900/90 px-2 py-1.5">
        <Link
          to="/"
          className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
        >
          ← Decks
        </Link>
        <div className="min-w-0 flex-1">
          <TurnBanner />
        </div>
        {/* Desktop log toggle. */}
        <button
          type="button"
          onClick={() => setLogRailOpen((v) => !v)}
          className="hidden shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 lg:block"
        >
          {logRailOpen ? 'Hide log' : 'Show log'}
        </button>
        {/* Mobile log button. */}
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 lg:hidden"
        >
          Log · {logCount}
        </button>
      </header>

      {/* ---- Log rail (desktop) · mat · action bar ---------------------- */}
      <div className="flex min-h-0 flex-1">
        {logRailOpen && (
          <aside className="fade-in hidden w-64 shrink-0 flex-col border-r border-white/10 bg-slate-900 lg:flex xl:w-72">
            <div className="border-b border-white/10 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Game log</span>
            </div>
            <GameLog />
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
          <Mat />
          <ActionBar />
        </div>
      </div>

      {/* Mobile log sheet. */}
      {logOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden">
          <button
            type="button"
            aria-label="Close log"
            className="absolute inset-0 bg-slate-950/70"
            onClick={() => setLogOpen(false)}
          />
          <div className="sheet-up relative flex max-h-[75vh] flex-col rounded-t-2xl border-t border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Game log</span>
              <button
                type="button"
                onClick={() => setLogOpen(false)}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300"
              >
                Close ✕
              </button>
            </div>
            <GameLog />
          </div>
        </div>
      )}

      <DecisionModal />
      <DiscardModal />
      <AttackChoiceModal />
      <CardPreview />
    </div>
  )
}
