-- =============================================================
-- CARD SETS: groups of card values (e.g. "Hebrew Animals")
-- =============================================================
create table card_sets (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  language    text not null default 'he',
  created_at  timestamptz default now()
);

-- =============================================================
-- CARD VALUES: each unique card face within a set
-- =============================================================
create table card_values (
  id           uuid primary key default uuid_generate_v4(),
  set_id       uuid references card_sets(id) on delete cascade not null,
  value_key    text not null,
  display_text text not null,
  image_url    text,
  created_at   timestamptz default now(),
  unique (set_id, value_key)
);

-- =============================================================
-- ROOMS
-- =============================================================
create table rooms (
  id                       uuid primary key default uuid_generate_v4(),
  room_code                text unique not null,
  host_user_id             uuid not null,
  status                   text not null default 'waiting'
                             check (status in ('waiting', 'playing', 'finished')),

  -- Turn state
  current_turn_player_id   uuid,
  board_locked             boolean not null default false,
  turn_started_at          timestamptz,

  -- Settings
  pair_found_behavior      text not null default 'stay_open'
                             check (pair_found_behavior in ('stay_open', 'remove_from_board')),
  turn_timer_enabled       boolean not null default false,
  turn_time_limit_seconds  integer,
  miss_reveal_ms           integer not null default 1500,
  language                 text not null default 'he',
  card_set_id              uuid references card_sets(id),
  num_pairs                integer not null default 8,

  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- =============================================================
-- PLAYERS
-- =============================================================
create table players (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid references rooms(id) on delete cascade not null,
  user_id      uuid not null,
  display_name text not null,
  turn_order   integer,
  score        integer not null default 0,
  is_active    boolean not null default true,
  last_seen_at timestamptz default now(),
  created_at   timestamptz default now()
);

-- =============================================================
-- CARDS: one row per card on the board (pairs = 2 rows per value_key)
-- display_text is denormalized from card_values for fast realtime reads
-- =============================================================
create table cards (
  id             uuid primary key default uuid_generate_v4(),
  room_id        uuid references rooms(id) on delete cascade not null,
  value_key      text not null,
  display_text   text not null,
  image_url      text,
  position_index integer not null,
  is_face_up     boolean not null default false,
  is_matched     boolean not null default false,
  is_removed     boolean not null default false,
  created_at     timestamptz default now()
);

-- =============================================================
-- TURNS: one row per turn attempt
-- =============================================================
create table turns (
  id              uuid primary key default uuid_generate_v4(),
  room_id         uuid references rooms(id) on delete cascade not null,
  player_id       uuid references players(id),
  first_card_id   uuid references cards(id),
  second_card_id  uuid references cards(id),
  result          text not null default 'pending'
                    check (result in ('pending', 'match', 'miss')),
  started_at      timestamptz default now(),
  miss_resolve_at timestamptz,   -- when cards should be closed
  resolved_at     timestamptz    -- when this turn was finalized
);

-- =============================================================
-- GAME EVENTS: audit log + realtime trigger for clients
-- =============================================================
create table game_events (
  id         uuid primary key default uuid_generate_v4(),
  room_id    uuid references rooms(id) on delete cascade not null,
  event_type text not null,
  payload    jsonb,
  created_at timestamptz default now()
);

-- =============================================================
-- SYSTEM DOCS: auto-generated documentation snapshot
-- =============================================================
create table system_docs (
  id           uuid primary key default uuid_generate_v4(),
  doc_type     text not null unique,
  content      jsonb not null,
  refreshed_at timestamptz default now()
);

-- =============================================================
-- INDEXES for common query patterns
-- =============================================================
create index idx_players_room_user    on players (room_id, user_id);
create index idx_cards_room           on cards (room_id, position_index);
create index idx_turns_room_pending   on turns (room_id, result) where result = 'pending';
create index idx_turns_miss_unresolved on turns (miss_resolve_at) where result = 'miss' and resolved_at is null;
create index idx_game_events_room     on game_events (room_id, created_at desc);

-- =============================================================
-- REALTIME: subscribe to all game tables
-- =============================================================
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table cards;
alter publication supabase_realtime add table turns;
alter publication supabase_realtime add table game_events;
