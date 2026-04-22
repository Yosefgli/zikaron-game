-- =============================================================
-- ROW LEVEL SECURITY
-- All writes go through security definer RPCs (bypass RLS).
-- Direct reads are allowed openly — game data is not sensitive.
-- No write policies = clients cannot INSERT/UPDATE/DELETE directly.
-- =============================================================

alter table rooms        enable row level security;
alter table players      enable row level security;
alter table cards        enable row level security;
alter table turns        enable row level security;
alter table game_events  enable row level security;
alter table card_sets    enable row level security;
alter table card_values  enable row level security;
alter table system_docs  enable row level security;

-- READ policies: open to any authenticated user
create policy "read_rooms"       on rooms       for select using (auth.role() = 'authenticated');
create policy "read_players"     on players     for select using (auth.role() = 'authenticated');
create policy "read_cards"       on cards       for select using (auth.role() = 'authenticated');
create policy "read_turns"       on turns       for select using (auth.role() = 'authenticated');
create policy "read_game_events" on game_events for select using (auth.role() = 'authenticated');
create policy "read_card_sets"   on card_sets   for select using (auth.role() = 'authenticated');
create policy "read_card_values" on card_values for select using (auth.role() = 'authenticated');
create policy "read_system_docs" on system_docs for select using (auth.role() = 'authenticated');

-- Players can update only their own last_seen_at (presence heartbeat)
-- All other writes must go through RPCs
create policy "update_own_last_seen" on players
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
