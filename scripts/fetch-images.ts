// Downloads card art for every card in the generated card DB into public/cards/.
// Source: flibustier/pokemon-tcg-exchange (images named <set>/<number>.webp).
// Run with:  npm run data:images   (after npm run data:cards)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CardDatabase } from '../src/engine/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const cardsPath = join(root, 'src/engine/data/cards.json')
const outDir = join(root, 'public/cards')
const IMG_BASE =
  'https://raw.githubusercontent.com/flibustier/pokemon-tcg-exchange/main/public/images/cards-by-set'

function imageFolder(set: string): string {
  if (set === 'P-A') return 'PROMO-A'
  if (set === 'P-B') return 'PROMO-B'
  return set
}

async function main() {
  if (!existsSync(cardsPath)) {
    throw new Error('cards.json not found — run `npm run data:cards` first.')
  }
  const cards = JSON.parse(readFileSync(cardsPath, 'utf8')) as CardDatabase
  mkdirSync(outDir, { recursive: true })

  let downloaded = 0
  let skipped = 0
  const failures: string[] = []

  for (const card of Object.values(cards)) {
    const dest = join(outDir, `${card.set}_${card.number}.webp`)
    if (existsSync(dest)) {
      skipped++
      continue
    }
    const url = `${IMG_BASE}/${imageFolder(card.set)}/${card.number}.webp`
    const res = await fetch(url)
    if (!res.ok) {
      failures.push(`${card.id} (${card.name}): HTTP ${res.status} ${url}`)
      continue
    }
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    downloaded++
    process.stdout.write(`  ${card.set}_${card.number}.webp  (${card.name})\n`)
  }

  process.stdout.write(`Done: ${downloaded} downloaded, ${skipped} already present.\n`)
  if (failures.length) {
    process.stderr.write(`\nFailed to fetch ${failures.length} image(s):\n  ${failures.join('\n  ')}\n`)
    process.exit(1)
  }
}

main().catch((err) => {
  process.stderr.write(`fetch-images failed: ${err.message}\n`)
  process.exit(1)
})
