'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Room, Player, Card, Turn, CardSet } from '@/types/game'

interface GameRoomState {
  room: Room | null
  players: Player[]
  cards: Card[]
  currentTurn: Turn | null
  myPlayer: Player | null
  cardSets: CardSet[]
  isLoading: boolean
  error: string | null
}

export function useGameRoom(roomCode: string) {
  const [state, setState] = useState<GameRoomState>({
    room: null,
    players: [],
    cards: [],
    currentTurn: null,
    myPlayer: null,
    cardSets: [],
    isLoading: true,
    error: null,
  })

  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Initial data load ──────────────────────────────────────────────
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      // Ensure the user is authenticated
      let { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const { data } = await supabase.auth.signInAnonymously()
        user = data.user
      }
      if (!user) {
        setState(prev => ({ ...prev, error: 'auth_failed', isLoading: false }))
        return
      }

      // Load room
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .single()

      if (roomErr || !room) {
        setState(prev => ({ ...prev, error: 'room_not_found', isLoading: false }))
        return
      }

      // Parallel load
      const [playersRes, cardsRes, turnsRes, setsRes] = await Promise.all([
        supabase.from('players').select('*').eq('room_id', room.id).order('turn_order'),
        supabase.from('cards').select('*').eq('room_id', room.id).order('position_index'),
        supabase
          .from('turns')
          .select('*')
          .eq('room_id', room.id)
          .eq('result', 'pending')
          .order('started_at', { ascending: false })
          .limit(1),
        supabase.from('card_sets').select('*').order('name'),
      ])

      const myPlayer = playersRes.data?.find(p => p.user_id === user!.id) ?? null

      setState({
        room:        room as Room,
        players:     (playersRes.data ?? []) as Player[],
        cards:       (cardsRes.data ?? []) as Card[],
        currentTurn: (turnsRes.data?.[0] ?? null) as Turn | null,
        myPlayer:    myPlayer as Player | null,
        cardSets:    (setsRes.data ?? []) as CardSet[],
        isLoading:   false,
        error:       null,
      })

      // ── Realtime subscriptions ──────────────────────────────────────
      channel = supabase
        .channel(`game:${room.id}`)

        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
          ({ new: updated }) => {
            setState(prev => ({ ...prev, room: updated as Room }))
          }
        )

        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
          ({ eventType, new: updated }) => {
            setState(prev => {
              const p = updated as Player
              if (eventType === 'INSERT') {
                return {
                  ...prev,
                  players: [...prev.players, p].sort((a, b) => a.turn_order - b.turn_order),
                }
              }
              return {
                ...prev,
                players: prev.players.map(x => x.id === p.id ? p : x),
                myPlayer: prev.myPlayer?.id === p.id ? p : prev.myPlayer,
              }
            })
          }
        )

        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'cards', filter: `room_id=eq.${room.id}` },
          ({ new: updated }) => {
            const c = updated as Card
            setState(prev => ({
              ...prev,
              cards: prev.cards.map(x => x.id === c.id ? c : x),
            }))
          }
        )

        // New cards batch (game start replaces all cards)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'cards', filter: `room_id=eq.${room.id}` },
          async () => {
            // Reload full card list when cards are inserted (game restart)
            const { data } = await supabase
              .from('cards')
              .select('*')
              .eq('room_id', room.id)
              .order('position_index')
            if (data) setState(prev => ({ ...prev, cards: data as Card[] }))
          }
        )

        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'turns', filter: `room_id=eq.${room.id}` },
          ({ new: updated }) => {
            const t = updated as Turn
            if (t.result === 'pending') {
              setState(prev => ({ ...prev, currentTurn: t }))
            }
          }
        )

        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'turns', filter: `room_id=eq.${room.id}` },
          ({ new: updated }) => {
            const t = updated as Turn
            setState(prev => {
              if (prev.currentTurn?.id !== t.id) return prev
              // Schedule miss processing when miss_resolve_at is set
              if (t.result === 'miss' && t.miss_resolve_at) {
                const delay = new Date(t.miss_resolve_at).getTime() - Date.now() + 200
                if (missTimerRef.current) clearTimeout(missTimerRef.current)
                missTimerRef.current = setTimeout(() => {
                  supabase.rpc('rpc_process_pending_misses').then()
                }, Math.max(delay, 0))
              }
              return { ...prev, currentTurn: t }
            })
          }
        )

        .subscribe()

      // ── Presence heartbeat: update last_seen_at every 10s ──────────
      presenceIntervalRef.current = setInterval(async () => {
        await supabase
          .from('players')
          .update({ last_seen_at: new Date().toISOString() })
          // Direct update allowed here only because this is a non-game-logic field.
          // Alternatively this could be an RPC, but it's not security-sensitive.
          .eq('room_id', room.id)
          .eq('user_id', user!.id)
      }, 10_000)
    }

    init()

    return () => {
      if (channel)               supabase.removeChannel(channel)
      if (missTimerRef.current)  clearTimeout(missTimerRef.current)
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current)
    }
  }, [roomCode])

  // ── Actions ────────────────────────────────────────────────────────

  const flipCard = useCallback(async (cardId: string) => {
    if (!state.room) return
    const { error } = await supabase.rpc('rpc_flip_card', {
      p_room_id: state.room.id,
      p_card_id: cardId,
    })
    if (error) console.error('[flipCard]', error.message)
  }, [state.room])

  const startGame = useCallback(async () => {
    if (!state.room) return
    const { error } = await supabase.rpc('rpc_start_game', {
      p_room_id: state.room.id,
    })
    if (error) console.error('[startGame]', error.message)
  }, [state.room])

  const skipTurn = useCallback(async () => {
    if (!state.room) return
    const { error } = await supabase.rpc('rpc_skip_turn', {
      p_room_id: state.room.id,
    })
    if (error) console.error('[skipTurn]', error.message)
  }, [state.room])

  const updateSettings = useCallback(async (settings: {
    pair_found_behavior?:     string
    turn_timer_enabled?:      boolean
    turn_time_limit_seconds?: number
    miss_reveal_ms?:          number
    language?:                string
    card_set_id?:             string
    num_pairs?:               number
  }) => {
    if (!state.room) return
    const params: Record<string, unknown> = { p_room_id: state.room.id }
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined) params[`p_${k}`] = v
    }
    const { error } = await supabase.rpc('rpc_update_room_settings', params)
    if (error) console.error('[updateSettings]', error.message)
  }, [state.room])

  const markInactive = useCallback(async () => {
    if (!state.room) return
    await supabase.rpc('rpc_mark_player_inactive', { p_room_id: state.room.id })
  }, [state.room])

  const isMyTurn  = state.room?.current_turn_player_id === state.myPlayer?.id
  const isHost    = state.room?.host_user_id === state.myPlayer?.user_id

  return {
    ...state,
    isMyTurn,
    isHost,
    flipCard,
    startGame,
    skipTurn,
    updateSettings,
    markInactive,
  }
}
