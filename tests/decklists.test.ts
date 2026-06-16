// Node-context test: reads the real decklist files from disk, so it lives under
// tests/ (typed with node) rather than src/ (browser/app types).
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { deckSize, parseDecklist, validateDeck } from '../src/engine/data/parseDecklist.ts'

const decklistsDir = join(dirname(fileURLToPath(import.meta.url)), '../decklists')

describe('real decklists', () => {
  it('every .txt decklist parses to a legal 20-card deck', () => {
    const files = readdirSync(decklistsDir).filter((f) => f.endsWith('.txt'))
    expect(files.length).toBe(4)
    for (const file of files) {
      const deck = parseDecklist(readFileSync(join(decklistsDir, file), 'utf8'))
      expect(deckSize(deck), `${file} size`).toBe(20)
      expect(validateDeck(deck), `${file} problems`).toEqual([])
    }
  })
})
