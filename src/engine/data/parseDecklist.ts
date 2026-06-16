// Parser for the plain-text decklist format under /decklists.
//
// Each card line looks like:  "2 Mega Blaziken ex B1 36"
//   <count> <name (may contain spaces)> <set> <number>
// A trailing line "Energy: Fire" (optionally comma-separated) gives the deck's
// registered energy type(s). Blank lines separate sections and are ignored.

export interface DeckEntry {
  count: number
  name: string
  set: string
  number: number
}

export interface ParsedDeck {
  energyTypes: string[]
  cards: DeckEntry[]
}

// set token is either a promo ("P-A"/"P-B") or a letter + digits + optional letter ("B2a").
const CARD_RE = /^(\d+)\s+(.+?)\s+(P-[AB]|[A-Z]\d+[a-z]?)\s+(\d+)$/

export function parseDecklist(text: string): ParsedDeck {
  const cards: DeckEntry[] = []
  let energyTypes: string[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue

    if (/^Energy:/i.test(line)) {
      energyTypes = line
        .replace(/^Energy:/i, '')
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      continue
    }

    const m = CARD_RE.exec(line)
    if (!m) throw new Error(`Unparseable decklist line: "${line}"`)
    cards.push({
      count: Number(m[1]),
      name: m[2].trim(),
      set: m[3],
      number: Number(m[4]),
    })
  }

  return { energyTypes, cards }
}

/** Total number of physical cards in the deck (sum of counts). */
export function deckSize(deck: ParsedDeck): number {
  return deck.cards.reduce((n, c) => n + c.count, 0)
}

/**
 * Validate Pocket deck-building rules: exactly 20 cards and at most 2 of any
 * card name. Returns a list of human-readable problems (empty = valid).
 */
export function validateDeck(deck: ParsedDeck): string[] {
  const problems: string[] = []
  const size = deckSize(deck)
  if (size !== 20) problems.push(`expected 20 cards, found ${size}`)
  if (deck.energyTypes.length === 0) problems.push('no Energy type registered')
  for (const c of deck.cards) {
    if (c.count > 2) problems.push(`${c.count}x ${c.name} exceeds the 2-copy limit`)
  }
  return problems
}
