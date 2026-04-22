'use client'

import type { Room, Player } from '@/types/game'
import { getT } from '@/lib/i18n'

interface Props {
  room: Room
  players: Player[]
  myPlayerId: string | null
  isHost: boolean
  onSkipTurn: () => void
}

export default function TurnIndicator({ room, players, myPlayerId, isHost, onSkipTurn }: Props) {
  const t = getT(room.language)
  const currentPlayer = players.find(p => p.id === room.current_turn_player_id)
  const isMyTurn = room.current_turn_player_id === myPlayerId

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700">
      <div className="flex items-center gap-2">
        {room.board_locked ? (
          <span className="text-yellow-400 font-medium">{t.board_locked}</span>
        ) : isMyTurn ? (
          <span className="text-green-400 font-bold text-lg animate-pulse">
            {t.your_turn}
          </span>
        ) : (
          <span className="text-slate-300">
            {currentPlayer ? t.waiting_turn(currentPlayer.display_name) : '...'}
          </span>
        )}
      </div>

      {isHost && room.status === 'playing' && (
        <button
          onClick={onSkipTurn}
          className="text-xs px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
        >
          {t.skip_turn}
        </button>
      )}
    </div>
  )
}
