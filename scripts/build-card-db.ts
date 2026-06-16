// Generates src/engine/data/cards.json and decks.json from the decklists.
//
// Source of card text/stats: deckgym-core's database.json (cached under scripts/.cache).
// Run with:  npm run data:cards
//
// The normalized schema is intentionally small and Pocket-specific (see src/engine/types.ts).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDecklist, validateDeck, type DeckEntry } from '../src/engine/data/parseDecklist.ts'
import type {
  Card,
  CardDatabase,
  Deck,
  EnergyType,
  PokemonCard,
  TrainerCard,
  TrainerType,
} from '../src/engine/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const decklistsDir = join(root, 'decklists')
const outDir = join(root, 'src/engine/data')
const cacheDir = join(here, '.cache')
const cachePath = join(cacheDir, 'deckgym-database.json')
const DECKGYM_DB_URL = 'https://raw.githubusercontent.com/bcollazo/deckgym-core/main/database.json'

// Pretty titles for the three known decks (slug -> title); falls back to the slug.
const DECK_TITLES: Record<string, string> = {
  'mega-blaziken-ex-b1-greninja-a1': 'Mega Blaziken ex / Greninja',
  'suicune-ex-a4a-baxcalibur-b2a': 'Suicune ex / Baxcalibur',
  'hydreigon-mega-absol-ex-b1': 'Hydreigon / Mega Absol ex',
  'miraidon-ex-b3a-magnezone-b1a': 'Miraidon ex / Magnezone',
}

interface RawAttack {
  energy_required: string[]
  title: string
  fixed_damage: number
  effect: string | null
}
interface RawPokemon {
  id: string
  name: string
  stage: number
  evolves_from: string | null
  hp: number
  energy_type: string
  ability: { title: string; effect: string } | null
  attacks: RawAttack[]
  weakness: string | null
  retreat_cost: string[]
  rarity: string
}
interface RawTrainer {
  id: string
  name: string
  trainer_card_type: string
  effect: string
  rarity: string
}
type RawEntry = { Pokemon: RawPokemon } | { Trainer: RawTrainer }

async function loadDeckgymDb(): Promise<Map<string, RawPokemon | RawTrainer>> {
  if (!existsSync(cachePath)) {
    mkdirSync(cacheDir, { recursive: true })
    process.stdout.write(`Downloading deckgym database -> ${cachePath}\n`)
    const res = await fetch(DECKGYM_DB_URL)
    if (!res.ok) throw new Error(`Failed to fetch deckgym db: HTTP ${res.status}`)
    writeFileSync(cachePath, await res.text())
  }
  const raw = JSON.parse(readFileSync(cachePath, 'utf8')) as RawEntry[]
  const map = new Map<string, RawPokemon | RawTrainer>()
  for (const entry of raw) {
    const card = 'Pokemon' in entry ? entry.Pokemon : entry.Trainer
    map.set(card.id, card)
  }
  return map
}

/**
 * Build a name -> evolves_from index across the *entire* deckgym DB so we can
 * trace any Pokémon back to the root Basic of its line. Intermediate stages
 * (e.g. Frogadier, Combusken) aren't in our normalized set but are needed to
 * resolve Rare Candy targets (Basic -> Stage 2).
 */
function buildEvolvesFromIndex(): Promise<Map<string, string | null>> {
  return loadDeckgymDb().then((map) => {
    const index = new Map<string, string | null>()
    for (const card of map.values()) {
      if ('stage' in card) index.set(card.name.trim(), card.evolves_from)
    }
    return index
  })
}

function rootBasicName(name: string, evolvesFrom: Map<string, string | null>): string {
  let current = name
  const seen = new Set<string>()
  for (;;) {
    if (seen.has(current)) throw new Error(`Evolution cycle detected at "${current}"`)
    seen.add(current)
    const prev = evolvesFrom.get(current)
    if (!prev) return current
    current = prev
  }
}

/** deckgym id, zero-padded: { set: 'B1', number: 36 } -> 'B1 036'. */
function deckgymId(set: string, number: number): string {
  return `${set} ${String(number).padStart(3, '0')}`
}

/** Image folder in the pokemon-tcg-exchange repo (promos live under PROMO-A/B). */
export function imageFolder(set: string): string {
  if (set === 'P-A') return 'PROMO-A'
  if (set === 'P-B') return 'PROMO-B'
  return set
}

function imagePath(set: string, number: number): string {
  return `/cards/${set}_${number}.webp`
}

function normalize(
  entry: DeckEntry,
  raw: RawPokemon | RawTrainer,
  evolvesFrom: Map<string, string | null>,
): Card {
  const { set, number } = entry
  const image = imagePath(set, number)

  if ('trainer_card_type' in raw) {
    const trainer: TrainerCard = {
      kind: 'trainer',
      id: raw.id,
      set,
      number,
      name: raw.name,
      trainerType: raw.trainer_card_type as TrainerType,
      effect: raw.effect,
      rarity: raw.rarity,
      image,
    }
    return trainer
  }

  const name = raw.name.trim()
  const pokemon: PokemonCard = {
    kind: 'pokemon',
    id: raw.id,
    set,
    number,
    name,
    stage: raw.stage,
    evolvesFrom: raw.evolves_from,
    basicName: rootBasicName(name, evolvesFrom),
    hp: raw.hp,
    energyType: raw.energy_type as EnergyType,
    ability: raw.ability,
    attacks: raw.attacks.map((a) => ({
      title: a.title,
      cost: a.energy_required as EnergyType[],
      damage: a.fixed_damage,
      effect: a.effect,
    })),
    weakness: (raw.weakness as EnergyType | null) ?? null,
    retreatCost: raw.retreat_cost.length,
    isEx: /\bex$/i.test(name),
    isMega: /^mega\b/i.test(name),
    rarity: raw.rarity,
    image,
  }
  return pokemon
}

async function main() {
  const db = await loadDeckgymDb()
  const evolvesFrom = await buildEvolvesFromIndex()
  const files = readdirSync(decklistsDir)
    .filter((f) => f.endsWith('.txt'))
    .sort()

  const cards: CardDatabase = {}
  const decks: Deck[] = []
  const missing: string[] = []

  for (const file of files) {
    const slug = file.replace(/\.txt$/, '')
    const parsed = parseDecklist(readFileSync(join(decklistsDir, file), 'utf8'))
    const problems = validateDeck(parsed)
    if (problems.length) throw new Error(`${file}: ${problems.join('; ')}`)

    const deckCards: Deck['cards'] = []
    for (const entry of parsed.cards) {
      const id = deckgymId(entry.set, entry.number)
      const raw = db.get(id)
      if (!raw) {
        missing.push(`${id} (${entry.name}) in ${file}`)
        continue
      }
      if (!cards[id]) cards[id] = normalize(entry, raw, evolvesFrom)
      deckCards.push({ id, count: entry.count })
    }

    decks.push({
      id: slug,
      title: DECK_TITLES[slug] ?? slug,
      energyTypes: parsed.energyTypes as EnergyType[],
      cards: deckCards,
    })
  }

  if (missing.length) {
    throw new Error(`Cards missing from deckgym database:\n  ${missing.join('\n  ')}`)
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'cards.json'), JSON.stringify(cards, null, 2) + '\n')
  writeFileSync(join(outDir, 'decks.json'), JSON.stringify(decks, null, 2) + '\n')

  const pokemonCount = Object.values(cards).filter((c) => c.kind === 'pokemon').length
  process.stdout.write(
    `Wrote ${Object.keys(cards).length} unique cards ` +
      `(${pokemonCount} Pokémon, ${Object.keys(cards).length - pokemonCount} trainers) ` +
      `across ${decks.length} decks.\n`,
  )
}

main().catch((err) => {
  process.stderr.write(`build-card-db failed: ${err.message}\n`)
  process.exit(1)
})
