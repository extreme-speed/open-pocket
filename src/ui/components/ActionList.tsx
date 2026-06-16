import type { EnergyType, Move } from '../../engine/types'
import { ENERGY_STYLE } from '../energy'
import type { ActionGroup } from '../moveHelpers'
import { targetUidOf } from '../selection'

function CostPips({ cost }: { cost: readonly EnergyType[] }) {
  if (cost.length === 0) return null
  return (
    <span className="inline-flex gap-0.5">
      {cost.map((c, i) => (
        <span key={i} className={`h-3 w-3 rounded-full ${ENERGY_STYLE[c].bg} ring-1 ring-white/60`} />
      ))}
    </span>
  )
}

function DamageBadge({ amount }: { amount?: number }) {
  if (amount == null || amount <= 0) return null
  return (
    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs font-bold text-rose-300 ring-1 ring-rose-500/40">
      {amount}
    </span>
  )
}

const ROW =
  'flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2.5 text-left text-sm font-semibold text-slate-100 shadow-sm ring-1 ring-white/10 transition-colors hover:bg-slate-700 active:bg-slate-700'

/** Render one enumerated action group: a single button, a board-target button
 *  (which enters targeting), or — for variants with no plain board target — a
 *  labelled set of sub-buttons. */
function GroupRows({
  group,
  onPlay,
  onTarget,
}: {
  group: ActionGroup
  onPlay: (move: Move) => void
  onTarget: (label: string, moves: Move[]) => void
}) {
  if (group.options.length === 1) {
    const o = group.options[0]
    return (
      <button type="button" onClick={() => onPlay(o.move)} className={ROW}>
        <CostPips cost={group.cost ?? []} />
        <DamageBadge amount={o.damage} />
        <span className="flex-1">
          {group.label}
          {o.target && <span className="font-normal text-slate-400"> → {o.target}</span>}
          {group.sub && <span className="ml-1 font-normal text-slate-500">· {group.sub}</span>}
        </span>
      </button>
    )
  }

  const boardTargetable = group.options.every((o) => targetUidOf(o.move) !== null)
  if (boardTargetable) {
    return (
      <button
        type="button"
        onClick={() => onTarget(group.label, group.options.map((o) => o.move))}
        className={ROW}
      >
        <CostPips cost={group.cost ?? []} />
        <span className="flex-1">{group.label}</span>
        <span className="text-xs font-normal text-amber-300/80">tap a target →</span>
      </button>
    )
  }

  return (
    <div className="rounded-lg bg-slate-800/40 p-1.5 ring-1 ring-white/5">
      <div className="flex items-center gap-2 px-1.5 py-0.5 text-sm font-bold text-slate-200">
        <CostPips cost={group.cost ?? []} />
        <span>{group.label}</span>
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {group.options.map((o, i) => (
          <button key={i} type="button" onClick={() => onPlay(o.move)} className={`${ROW} py-1.5`}>
            <DamageBadge amount={o.damage} />
            <span className="flex-1 font-medium text-slate-200">{o.target ?? 'Choose'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The list of actions for a tapped source — shown under its card in the preview.
 *  `onPlay` dispatches a ready move; `onTarget` hands off to board target-picking. */
export default function ActionList({
  groups,
  onPlay,
  onTarget,
}: {
  groups: ActionGroup[]
  onPlay: (move: Move) => void
  onTarget: (label: string, moves: Move[]) => void
}) {
  if (groups.length === 0) {
    return <p className="py-1 text-center text-sm text-slate-400">No actions for this card right now.</p>
  }
  return (
    <div className="flex flex-col gap-1.5">
      {groups.map((g) => (
        <GroupRows key={g.key} group={g} onPlay={onPlay} onTarget={onTarget} />
      ))}
    </div>
  )
}
