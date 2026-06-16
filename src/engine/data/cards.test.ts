import { describe, expect, it } from 'vitest'
import { cards, decks, getCard } from './cards'

describe('generated card database', () => {
  it('contains all 38 unique cards (21 Pokémon, 17 trainers)', () => {
    const all = Object.values(cards)
    expect(all).toHaveLength(38)
    expect(all.filter((c) => c.kind === 'pokemon')).toHaveLength(21)
    expect(all.filter((c) => c.kind === 'trainer')).toHaveLength(17)
  })

  it('exposes four legal 20-card decks referencing known cards', () => {
    expect(decks).toHaveLength(4)
    for (const deck of decks) {
      expect(deck.energyTypes.length).toBeGreaterThan(0)
      const total = deck.cards.reduce((n, c) => n + c.count, 0)
      expect(total, deck.id).toBe(20)
      for (const ref of deck.cards) expect(cards[ref.id], `${deck.id} -> ${ref.id}`).toBeDefined()
    }
  })

  it('every card has required fields and a well-formed image path', () => {
    for (const card of Object.values(cards)) {
      expect(card.name).toBeTruthy()
      expect(card.image).toBe(`/cards/${card.set}_${card.number}.webp`)
      if (card.kind === 'pokemon') {
        expect(card.hp).toBeGreaterThan(0)
        expect(card.retreatCost).toBeGreaterThanOrEqual(0)
        expect(card.attacks.length).toBeGreaterThan(0)
      } else {
        expect(['Supporter', 'Item', 'Tool', 'Stadium']).toContain(card.trainerType)
      }
    }
  })

  it('derives ex / mega flags from card names', () => {
    const blaziken = getCard('B1 036')
    const suicune = getCard('A4a 020')
    expect(blaziken.kind === 'pokemon' && blaziken.isEx && blaziken.isMega).toBe(true)
    expect(suicune.kind === 'pokemon' && suicune.isEx && !suicune.isMega).toBe(true)
  })
})
