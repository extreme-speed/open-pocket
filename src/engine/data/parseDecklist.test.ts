import { describe, expect, it } from 'vitest'
import { deckSize, parseDecklist, validateDeck } from './parseDecklist'

describe('parseDecklist', () => {
  it('parses a card line with a multi-word name', () => {
    const { cards } = parseDecklist('1 Mega Blaziken ex B1 36')
    expect(cards).toEqual([{ count: 1, name: 'Mega Blaziken ex', set: 'B1', number: 36 }])
  })

  it('parses promo set codes and the Energy line', () => {
    const deck = parseDecklist("2 Professor's Research P-A 7\n\nEnergy: Fire")
    expect(deck.cards[0]).toEqual({
      count: 2,
      name: "Professor's Research",
      set: 'P-A',
      number: 7,
    })
    expect(deck.energyTypes).toEqual(['Fire'])
  })

  it('throws on an unparseable line', () => {
    expect(() => parseDecklist('not a card line')).toThrow(/Unparseable/)
  })

  it('flags decks that break the 20-card / 2-copy rules', () => {
    const tooSmall = parseDecklist('3 Torchic B1 33\n\nEnergy: Fire')
    expect(deckSize(tooSmall)).toBe(3)
    expect(validateDeck(tooSmall)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('expected 20 cards'),
        expect.stringContaining('exceeds the 2-copy limit'),
      ]),
    )
  })
})
