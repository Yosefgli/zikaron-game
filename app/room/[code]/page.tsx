'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useGameRoom } from '@/hooks/useGameRoom'
import { getT, isRtl } from '@/lib/i18n'
import GameBoard      from '@/components/GameBoard'
import PlayerList     from '@/components/PlayerList'
import TurnIndicator  from '@/components/TurnIndicator'
import RoomLobby      from '@/components/RoomLobby'

export default function RoomPage() {
  const { code } = useParams<{ code: string }>()
  const {
    room, players, cards, myPlayer, cardSets,
    isMyTurn, isHost, isLoading, error,
    flipCard, startGame, skipTurn, updateSettings, markInactive,
  } = useGameRoom(code)

  // Mark player inactive on tab close / navigate away
  useEffect(() => {
    if (!room) return
    const handler = () => markInactive()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [room, markInactive])

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 animate-pulse text-lg">טוען...</p>
      </main>
    )
  }

  if (error || !room) {
    return (
      <main className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">
            {error === 'room_not_found' ? 'חדר לא נמצא' : 'אירעה שגיאה'}
          </p>
          <a href="/" className="text-blue-400 hover:underline">חזור לדף הבית</a>
        </div>
      </main>
    )
  }

  const t   = getT(room.language)
  const dir = isRtl(room.language) ? 'rtl' : 'ltr'

  // ── WAITING (Lobby) ───────────────────────────────────────────────
  if (room.status === 'waiting') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" dir={dir}>
        <RoomLobby
          room={room}
          players={players}
          myPlayerId={myPlayer?.id ?? null}
          isHost={isHost}
          cardSets={cardSets}
          onStartGame={startGame}
          onUpdateSettings={updateSettings}
        />
      </main>
    )
  }

  // ── FINISHED ──────────────────────────────────────────────────────
  if (room.status === 'finished') {
    const sorted = [...players].sort((a, b) => b.score - a.score)
    const winner = sorted[0]

    return (
      <main className="min-h-screen flex items-center justify-center p-4" dir={dir}>
        <div className="text-center max-w-sm w-full flex flex-col gap-6">
          <h1 className="text-4xl font-black">{t.game_over}</h1>
          {winner && (
            <p className="text-2xl text-yellow-400 font-bold">
              {t.winner(winner.display_name)}
            </p>
          )}
          <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-2">
            <h3 className="text-slate-400 text-sm uppercase font-semibold">{t.final_scores}</h3>
            {sorted.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-700">
                <span className="text-white">
                  {i === 0 && '🏆 '}{p.display_name}
                  {p.id === myPlayer?.id && <span className="text-slate-400 text-xs ms-1">{t.you}</span>}
                </span>
                <span className="font-mono font-bold text-lg">{p.score}</span>
              </div>
            ))}
          </div>
          <a href="/" className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">
            {t.play_again}
          </a>
        </div>
      </main>
    )
  }

  // ── PLAYING ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col p-4 gap-4" dir={dir}>
      <div className="flex flex-col lg:flex-row gap-4 w-full max-w-5xl mx-auto">

        {/* Sidebar */}
        <div className="flex flex-col gap-4 lg:w-48 shrink-0">
          <PlayerList
            players={players}
            room={room}
            myPlayerId={myPlayer?.id ?? null}
          />
        </div>

        {/* Board area */}
        <div className="flex-1 flex flex-col gap-4">
          <TurnIndicator
            room={room}
            players={players}
            myPlayerId={myPlayer?.id ?? null}
            isHost={isHost}
            onSkipTurn={skipTurn}
          />
          <GameBoard
            cards={cards}
            room={room}
            isMyTurn={isMyTurn}
            onFlip={flipCard}
          />
        </div>
      </div>
    </main>
  )
}
