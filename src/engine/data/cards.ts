import type { Card, CardDatabase, Deck } from '../types'
import cardsJson from './cards.json'
import decksJson from './decks.json'

// JSON is inferred with widened (string) literal types, so cast through unknown.
export const cards = cardsJson as unknown as CardDatabase
export const decks = decksJson as unknown as Deck[]

export function getCard(id: string): Card {
  const card = cards[id]
  if (!card) throw new Error(`Unknown card id: ${id}`)
  return card
}

export function getDeck(id: string): Deck {
  const deck = decks.find((d) => d.id === id)
  if (!deck) throw new Error(`Unknown deck id: ${id}`)
  return deck
}
