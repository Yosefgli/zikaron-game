export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type PairFoundBehavior = 'stay_open' | 'remove_from_board'
export type TurnResult = 'pending' | 'match' | 'miss'

export interface Room {
  id: string
  room_code: string
  host_user_id: string
  status: RoomStatus
  current_turn_player_id: string | null
  board_locked: boolean
  turn_started_at: string | null
  pair_found_behavior: PairFoundBehavior
  turn_timer_enabled: boolean
  turn_time_limit_seconds: number | null
  miss_reveal_ms: number
  language: string
  card_set_id: string | null
  num_pairs: number
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  room_id: string
  user_id: string
  display_name: string
  turn_order: number
  score: number
  is_active: boolean
  last_seen_at: string
  created_at: string
}

export interface Card {
  id: string
  room_id: string
  value_key: string
  display_text: string
  image_url: string | null
  position_index: number
  is_face_up: boolean
  is_matched: boolean
  is_removed: boolean
  created_at: string
}

export interface Turn {
  id: string
  room_id: string
  player_id: string
  first_card_id: string | null
  second_card_id: string | null
  result: TurnResult
  started_at: string
  miss_resolve_at: string | null
  resolved_at: string | null
}

export interface GameEvent {
  id: string
  room_id: string
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

export interface CardSet {
  id: string
  name: string
  description: string | null
  language: string
}
