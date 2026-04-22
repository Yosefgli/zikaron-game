'use client'

import type { Room, Player, CardSet } from '@/types/game'
import { getT } from '@/lib/i18n'
import RoomSettings from './RoomSettings'

interface Props {
  room: Room
  players: Player[]
  myPlayerId: string | null
  isHost: boolean
  cardSets: CardSet[]
  onStartGame: () => void
  onUpdateSettings: (s: Parameters<React.ComponentProps<typeof RoomSettings>['onSave']>[0]) => void
}

export default function RoomLobby({
  room, players, myPlayerId, isHost, cardSets, onStartGame, onUpdateSettings,
}: Props) {
  const t = getT(room.language)
  const canStart = isHost && players.filter(p => p.is_active).length >= 1 && !!room.card_set_id

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto w-full">
      {/* Room code */}
      <div className="text-center p-6 bg-slate-800 rounded-2xl border border-slate-700">
        <p className="text-slate-400 text-sm mb-2">{t.share_code}</p>
        <p className="text-5xl font-mono font-black tracking-widest text-white">
          {room.room_code}
        </p>
      </div>

      {/* Players */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          {t.players_in_room}
        </h3>
        <div className="flex flex-col gap-2">
          {players.filter(p => p.is_active).map(player => (
            <div key={player.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700">
              <span className="text-white text-sm">
                {player.display_name}
                {player.id === myPlayerId && (
                  <span className="text-slate-400 text-xs ms-2">{t.you}</span>
                )}
                {player.user_id === room.host_user_id && (
                  <span className="text-yellow-400 text-xs ms-1"> 👑</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Host-only settings + start */}
      {isHost && (
        <>
          <RoomSettings room={room} cardSets={cardSets} onSave={onUpdateSettings} />
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg transition-colors"
          >
            {t.start_game}
          </button>
          {!room.card_set_id && (
            <p className="text-center text-yellow-400 text-sm -mt-4">
              {t.select_set}
            </p>
          )}
        </>
      )}

      {!isHost && (
        <p className="text-center text-slate-400 animate-pulse">{t.waiting_for_players}</p>
      )}
    </div>
  )
}
