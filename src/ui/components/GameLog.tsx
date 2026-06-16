import { useEffect, useRef } from 'react'
import { useGame } from '../store'

/**
 * The scrolling list of game events — every turn, KO, status, draw, coin flip,
 * and hit so far, newest at the bottom and auto-scrolled into view. The latest
 * line is emphasized. Doubles as an ARIA live region so screen-reader users hear
 * events as they happen. Containers (the desktop rail, the mobile log sheet)
 * supply their own heading and chrome.
 */
export default function GameLog() {
  const log = useGame((s) => s.log)
  const bottom = useRef<HTMLDivElement>(null)

  // Keep the newest line in view as events stream in.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [log.length])

  return (
    <div
      aria-live="polite"
      aria-label="Game log"
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2 text-[11px] leading-snug text-slate-400"
    >
      {log.length === 0 ? (
        <span className="text-slate-600">No events yet.</span>
      ) : (
        log.map((line, i) => (
          <span
            key={i}
            className={`border-b border-white/5 py-1 last:border-0 ${
              i === log.length - 1 ? 'font-semibold text-amber-200' : ''
            }`}
          >
            {line}
          </span>
        ))
      )}
      <div ref={bottom} />
    </div>
  )
}
