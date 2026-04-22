'use client'

import type { Card as CardType, Room } from '@/types/game'
import CardComponent from './Card'

interface Props {
  cards: CardType[]
  room: Room
  isMyTurn: boolean
  onFlip: (cardId: string) => void
}

export default function GameBoard({ cards, room, isMyTurn, onFlip }: Props) {
  const canFlip = isMyTurn && !room.board_locked

  // Derive grid columns based on number of cards
  const total = cards.filter(c => !c.is_removed).length || cards.length
  const cols = total <= 12 ? 4 : total <= 20 ? 5 : 6

  const gridClass: Record<number, string> = {
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }

  return (
    <div className={`grid ${gridClass[cols] ?? 'grid-cols-4'} gap-3 w-full max-w-2xl mx-auto`}>
      {cards.map(card => (
        <CardComponent
          key={card.id}
          card={card}
          canFlip={canFlip}
          onClick={onFlip}
        />
      ))}
    </div>
  )
}
