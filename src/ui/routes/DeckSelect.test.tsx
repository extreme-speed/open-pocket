import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DeckSelect from './DeckSelect'

describe('DeckSelect', () => {
  it('renders the title, deck pickers, and a start button', () => {
    render(
      <MemoryRouter>
        <DeckSelect />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /open pocket/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start battle/i })).toBeInTheDocument()
    // Both seats have a deck picker (3 selects: P1 deck, P2 deck, who-goes-first).
    expect(screen.getAllByRole('combobox')).toHaveLength(3)
  })
})
