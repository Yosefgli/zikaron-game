'use client'

import type { Player, Room } from '@/types/game'
import { getT } from '@/lib/i18n'

interface Props {
  players: Player[]
  room: Room
  myPlayerId: string | null
}

export default function PlayerList({ players, room, myPlayerId }: Props) {
  const t = getT(room.language)

  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">
        {t.players_in_room}
      </h3>
      {players.filter(p => p.is_active).map(player => {
        const isCurrent = room.current_turn_player_id === player.id
        const isMe      = player.id === myPlayerId
        const isHost    = player.user_id === room.host_user_id

        return (
          <div
            key={player.id}
            className={[
              'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all',
              isCurrent
                ? 'bg-blue-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-200',
            ].join(' ')}
          >
            <span className="flex items-center gap-1">
              {isCurrent && <span>▶</span>}
              {player.display_name}
              {isMe && (
                <span className="text-xs opacity-70 ms-1">{t.you}</span>
              )}
              {isHost && (
                <span className="text-xs opacity-70 ms-1">👑</span>
              )}
            </span>
            <span className="font-mono font-bold">{player.score}</span>
          </div>
        )
      })}
    </div>
  )
}
