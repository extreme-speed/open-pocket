import type { EnergyType } from '../engine/types'

/** Tailwind colour + short glyph for each energy type, for the small pips. */
export const ENERGY_STYLE: Record<EnergyType, { bg: string; glyph: string }> = {
  Grass: { bg: 'bg-green-500', glyph: 'G' },
  Fire: { bg: 'bg-red-500', glyph: 'R' },
  Water: { bg: 'bg-sky-500', glyph: 'W' },
  Lightning: { bg: 'bg-yellow-400', glyph: 'L' },
  Psychic: { bg: 'bg-fuchsia-500', glyph: 'P' },
  Fighting: { bg: 'bg-orange-700', glyph: 'F' },
  Darkness: { bg: 'bg-slate-800', glyph: 'D' },
  Metal: { bg: 'bg-zinc-400', glyph: 'M' },
  Dragon: { bg: 'bg-amber-600', glyph: 'N' },
  Colorless: { bg: 'bg-gray-300', glyph: 'C' },
}

/** Collapse an energy list into ordered (type, count) groups for display. */
export function groupEnergy(energy: readonly EnergyType[]): Array<{ type: EnergyType; count: number }> {
  const order: EnergyType[] = []
  const counts = new Map<EnergyType, number>()
  for (const e of energy) {
    if (!counts.has(e)) order.push(e)
    counts.set(e, (counts.get(e) ?? 0) + 1)
  }
  return order.map((type) => ({ type, count: counts.get(type)! }))
}
