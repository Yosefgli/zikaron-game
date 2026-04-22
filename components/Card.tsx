'use client'

import type { Card as CardType } from '@/types/game'

interface Props {
  card: CardType
  canFlip: boolean
  onClick: (id: string) => void
}

export default function Card({ card, canFlip, onClick }: Props) {
  if (card.is_removed) return <div className="aspect-square" />

  const isVisible = card.is_face_up || card.is_matched

  return (
    <button
      onClick={() => canFlip && !isVisible && onClick(card.id)}
      disabled={!canFlip || isVisible}
      className={[
        'aspect-square rounded-xl border-2 font-bold text-lg transition-all duration-200 select-none',
        isVisible
          ? card.is_matched
            ? 'bg-green-100 border-green-400 text-green-800 cursor-default scale-95'
            : 'bg-blue-100 border-blue-400 text-blue-800 cursor-default'
          : canFlip
            ? 'bg-slate-700 border-slate-500 text-transparent hover:bg-slate-600 hover:scale-105 cursor-pointer'
            : 'bg-slate-800 border-slate-700 text-transparent cursor-not-allowed opacity-60',
      ].join(' ')}
    >
      {isVisible ? (
        <span className="px-1 break-words leading-tight">
          {card.display_text}
        </span>
      ) : (
        <span>?</span>
      )}
    </button>
  )
}
