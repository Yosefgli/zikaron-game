-- =============================================================
-- INTERNAL HELPER: advance to next active player
-- Called by resolve_miss, skip_turn, mark_player_inactive, force_advance
-- =============================================================
create or replace function _advance_to_next_player(
  p_room_id          uuid,
  p_current_player_id uuid
) returns void language plpgsql security definer as $$
declare
  v_current_order  integer;
  v_next_player_id uuid;
begin
  select turn_order into v_current_order
  from players where id = p_current_player_id;

  -- Try player with next higher turn_order
  select id into v_next_player_id
  from players
  where room_id = p_room_id
    and is_active = true
    and turn_order > v_current_order
  order by turn_order
  limit 1;

  -- Wrap around to lowest turn_order
  if v_next_player_id is null then
    select id into v_next_player_id
    from players
    where room_id = p_room_id
      and is_active = true
    order by turn_order
    limit 1;
  end if;

  -- No active players left → finish game
  if v_next_player_id is null then
    update rooms set status = 'finished', updated_at = now()
    where id = p_room_id;
    insert into game_events (room_id, event_type, payload)
    values (p_room_id, 'game_finished', '{"reason":"no_active_players"}'::jsonb);
    return;
  end if;

  insert into turns (room_id, player_id, started_at)
  values (p_room_id, v_next_player_id, now());

  update rooms set
    current_turn_player_id = v_next_player_id,
    board_locked            = false,
    turn_started_at         = now(),
    updated_at              = now()
  where id = p_room_id;

  insert into game_events (room_id, event_type, payload)
  values (p_room_id, 'turn_started',
    jsonb_build_object('player_id', v_next_player_id));
end;
$$;


-- =============================================================
-- rpc_create_room
-- =============================================================
create or replace function rpc_create_room(
  p_display_name text,
  p_card_set_id  uuid    default null,
  p_language     text    default 'he'
) returns jsonb language plpgsql security definer as $$
declare
  v_host_user_id uuid := auth.uid();
  v_room_code    text;
  v_room_id      uuid;
  v_player_id    uuid;
begin
  if v_host_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate unique 6-char room code
  loop
    v_room_code := upper(substring(md5(random()::text) from 1 for 6));
    exit when not exists (select 1 from rooms where room_code = v_room_code);
  end loop;

  insert into rooms (room_code, host_user_id, language, card_set_id)
  values (v_room_code, v_host_user_id, p_language, p_card_set_id)
  returning id into v_room_id;

  insert into players (room_id, user_id, display_name, turn_order)
  values (v_room_id, v_host_user_id, p_display_name, 1)
  returning id into v_player_id;

  insert into game_events (room_id, event_type, payload)
  values (v_room_id, 'room_created',
    jsonb_build_object('host', p_display_name, 'room_code', v_room_code));

  return jsonb_build_object(
    'room_id',   v_room_id,
    'room_code', v_room_code,
    'player_id', v_player_id
  );
end;
$$;


-- =============================================================
-- rpc_join_room
-- =============================================================
create or replace function rpc_join_room(
  p_room_code    text,
  p_display_name text
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id    uuid := auth.uid();
  v_room       rooms%rowtype;
  v_player     players%rowtype;
  v_player_id  uuid;
  v_turn_order integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room
  from rooms
  where room_code = upper(p_room_code)
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.status != 'waiting' then
    raise exception 'Game already started';
  end if;

  -- Handle reconnection: player already exists (was active or inactive)
  select * into v_player
  from players
  where room_id = v_room.id and user_id = v_user_id;

  if found then
    -- Re-activate if they had disconnected
    update players set is_active = true, last_seen_at = now()
    where id = v_player.id;

    return jsonb_build_object(
      'room_id',   v_room.id,
      'player_id', v_player.id,
      'rejoined',  true
    );
  end if;

  -- New player
  select coalesce(max(turn_order), 0) + 1 into v_turn_order
  from players where room_id = v_room.id;

  insert into players (room_id, user_id, display_name, turn_order)
  values (v_room.id, v_user_id, p_display_name, v_turn_order)
  returning id into v_player_id;

  insert into game_events (room_id, event_type, payload)
  values (v_room.id, 'player_joined',
    jsonb_build_object('display_name', p_display_name));

  return jsonb_build_object(
    'room_id',   v_room.id,
    'player_id', v_player_id,
    'rejoined',  false
  );
end;
$$;


-- =============================================================
-- rpc_update_room_settings  (host only, waiting state only)
-- =============================================================
create or replace function rpc_update_room_settings(
  p_room_id                  uuid,
  p_pair_found_behavior      text    default null,
  p_turn_timer_enabled       boolean default null,
  p_turn_time_limit_seconds  integer default null,
  p_miss_reveal_ms           integer default null,
  p_language                 text    default null,
  p_card_set_id              uuid    default null,
  p_num_pairs                integer default null
) returns void language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_room    rooms%rowtype;
begin
  select * into v_room from rooms where id = p_room_id for update;

  if not found then raise exception 'Room not found'; end if;
  if v_room.host_user_id != v_user_id then raise exception 'Only host can update settings'; end if;
  if v_room.status != 'waiting' then raise exception 'Cannot change settings after game started'; end if;

  update rooms set
    pair_found_behavior     = coalesce(p_pair_found_behavior,     pair_found_behavior),
    turn_timer_enabled      = coalesce(p_turn_timer_enabled,      turn_timer_enabled),
    turn_time_limit_seconds = coalesce(p_turn_time_limit_seconds, turn_time_limit_seconds),
    miss_reveal_ms          = coalesce(p_miss_reveal_ms,          miss_reveal_ms),
    language                = coalesce(p_language,                language),
    card_set_id             = coalesce(p_card_set_id,             card_set_id),
    num_pairs               = coalesce(p_num_pairs,               num_pairs),
    updated_at              = now()
  where id = p_room_id;

  insert into game_events (room_id, event_type, payload)
  values (p_room_id, 'settings_updated',
    jsonb_build_object('updated_by', v_user_id));
end;
$$;


-- =============================================================
-- rpc_start_game  (host only)
-- Shuffles and inserts cards, resets scores, sets first player
-- =============================================================
create or replace function rpc_start_game(
  p_room_id uuid
) returns void language plpgsql security definer as $$
declare
  v_user_id         uuid := auth.uid();
  v_room            rooms%rowtype;
  v_first_player_id uuid;
  v_values          text[];
  v_texts           text[];
  v_images          text[];
  v_shuffled_keys   text[];
  v_shuffled_texts  text[];
  v_shuffled_images text[];
  v_tmp_key         text;
  v_tmp_text        text;
  v_tmp_image       text;
  v_card_count      integer;
  v_idx             integer;
  v_rand_idx        integer;
begin
  select * into v_room from rooms where id = p_room_id for update;

  if not found then raise exception 'Room not found'; end if;
  if v_room.host_user_id != v_user_id then raise exception 'Only host can start game'; end if;
  if v_room.status != 'waiting' then raise exception 'Game already started'; end if;
  if v_room.card_set_id is null then raise exception 'No card set selected'; end if;

  -- Pick random card values from the selected set
  select
    array_agg(value_key  order by random()),
    array_agg(display_text order by random()),
    array_agg(image_url    order by random())
  into v_values, v_texts, v_images
  from (
    select value_key, display_text, image_url
    from card_values
    where set_id = v_room.card_set_id
    order by random()
    limit v_room.num_pairs
  ) sub;

  if v_values is null or array_length(v_values, 1) < v_room.num_pairs then
    raise exception 'Not enough card values in set (need % pairs)', v_room.num_pairs;
  end if;

  -- Duplicate into pairs
  v_shuffled_keys   := array_cat(v_values, v_values);
  v_shuffled_texts  := array_cat(v_texts,  v_texts);
  v_shuffled_images := array_cat(v_images, v_images);
  v_card_count      := array_length(v_shuffled_keys, 1);

  -- Fisher-Yates shuffle (applied identically to all three arrays)
  for v_idx in reverse v_card_count..2 loop
    v_rand_idx := floor(random() * v_idx + 1)::integer;

    v_tmp_key                   := v_shuffled_keys[v_idx];
    v_shuffled_keys[v_idx]      := v_shuffled_keys[v_rand_idx];
    v_shuffled_keys[v_rand_idx] := v_tmp_key;

    v_tmp_text                   := v_shuffled_texts[v_idx];
    v_shuffled_texts[v_idx]      := v_shuffled_texts[v_rand_idx];
    v_shuffled_texts[v_rand_idx] := v_tmp_text;

    v_tmp_image                   := v_shuffled_images[v_idx];
    v_shuffled_images[v_idx]      := v_shuffled_images[v_rand_idx];
    v_shuffled_images[v_rand_idx] := v_tmp_image;
  end loop;

  -- Clear old cards
  delete from cards where room_id = p_room_id;

  -- Insert shuffled cards
  for v_idx in 1..v_card_count loop
    insert into cards (room_id, value_key, display_text, image_url, position_index)
    values (
      p_room_id,
      v_shuffled_keys[v_idx],
      v_shuffled_texts[v_idx],
      v_shuffled_images[v_idx],
      v_idx - 1
    );
  end loop;

  -- Reset all scores
  update players set score = 0 where room_id = p_room_id;

  -- First player by turn_order
  select id into v_first_player_id
  from players
  where room_id = p_room_id and is_active = true
  order by turn_order
  limit 1;

  -- Start game
  update rooms set
    status                 = 'playing',
    current_turn_player_id = v_first_player_id,
    board_locked           = false,
    turn_started_at        = now(),
    updated_at             = now()
  where id = p_room_id;

  -- Create first turn record
  insert into turns (room_id, player_id, started_at)
  values (p_room_id, v_first_player_id, now());

  insert into game_events (room_id, event_type, payload)
  values (p_room_id, 'game_started',
    jsonb_build_object('first_player_id', v_first_player_id, 'num_cards', v_card_count));
end;
$$;


-- =============================================================
-- rpc_flip_card
-- Core turn logic: validates, flips, checks match/miss
-- =============================================================
create or replace function rpc_flip_card(
  p_room_id uuid,
  p_card_id uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id     uuid := auth.uid();
  v_room        rooms%rowtype;
  v_player      players%rowtype;
  v_card        cards%rowtype;
  v_first_card  cards%rowtype;
  v_turn        turns%rowtype;
  v_is_match    boolean;
  v_cards_left  integer;
begin
  -- Lock room to prevent concurrent flips
  select * into v_room from rooms where id = p_room_id for update;

  if not found          then raise exception 'Room not found'; end if;
  if v_room.status != 'playing' then raise exception 'Game is not active'; end if;
  if v_room.board_locked        then raise exception 'Board is locked'; end if;

  -- Validate caller is the current turn player
  select * into v_player
  from players
  where room_id = p_room_id and user_id = v_user_id and is_active = true;

  if not found then raise exception 'Player not in room'; end if;
  if v_room.current_turn_player_id != v_player.id then raise exception 'Not your turn'; end if;

  -- Validate card
  select * into v_card from cards where id = p_card_id and room_id = p_room_id for update;

  if not found        then raise exception 'Card not found'; end if;
  if v_card.is_face_up  then raise exception 'Card already face-up'; end if;
  if v_card.is_matched  then raise exception 'Card already matched'; end if;
  if v_card.is_removed  then raise exception 'Card removed from board'; end if;

  -- Get current pending turn (most recent)
  select * into v_turn
  from turns
  where room_id = p_room_id and result = 'pending'
  order by started_at desc
  limit 1;

  -- Flip the card face-up
  update cards set is_face_up = true where id = p_card_id;

  -- ── FIRST FLIP ────────────────────────────────────────────
  if v_turn.first_card_id is null then
    update turns set first_card_id = p_card_id where id = v_turn.id;
    return jsonb_build_object('flip', 'first', 'card_id', p_card_id);
  end if;

  -- ── SECOND FLIP ───────────────────────────────────────────
  update turns set second_card_id = p_card_id where id = v_turn.id;

  select * into v_first_card from cards where id = v_turn.first_card_id;

  v_is_match := (v_first_card.value_key = v_card.value_key);

  -- ── MATCH ─────────────────────────────────────────────────
  if v_is_match then
    update cards set
      is_matched = true,
      is_removed = (v_room.pair_found_behavior = 'remove_from_board')
    where id in (v_turn.first_card_id, p_card_id);

    update players set score = score + 1 where id = v_player.id;

    update turns set result = 'match', resolved_at = now() where id = v_turn.id;

    -- Check game over: any unmatched cards remaining?
    select count(*) into v_cards_left
    from cards
    where room_id = p_room_id and is_matched = false;

    if v_cards_left = 0 then
      update rooms set status = 'finished', updated_at = now() where id = p_room_id;
      insert into game_events (room_id, event_type, payload)
      values (p_room_id, 'game_finished',
        jsonb_build_object('last_player_id', v_player.id));
      return jsonb_build_object('flip', 'second', 'result', 'match', 'game_over', true);
    end if;

    -- Same player keeps the turn
    insert into turns (room_id, player_id, started_at)
    values (p_room_id, v_player.id, now());

    update rooms set turn_started_at = now(), updated_at = now() where id = p_room_id;

    insert into game_events (room_id, event_type, payload)
    values (p_room_id, 'match_found',
      jsonb_build_object('player_id', v_player.id, 'value_key', v_card.value_key));

    return jsonb_build_object('flip', 'second', 'result', 'match');
  end if;

  -- ── MISS ──────────────────────────────────────────────────
  update turns set
    result          = 'miss',
    miss_resolve_at = now() + (v_room.miss_reveal_ms || ' milliseconds')::interval
  where id = v_turn.id;

  update rooms set board_locked = true, updated_at = now() where id = p_room_id;

  insert into game_events (room_id, event_type, payload)
  values (p_room_id, 'miss',
    jsonb_build_object('player_id', v_player.id,
                       'miss_resolve_at', now() + (v_room.miss_reveal_ms || ' milliseconds')::interval));

  return jsonb_build_object('flip', 'second', 'result', 'miss');
end;
$$;


-- =============================================================
-- rpc_resolve_miss  (internal — called by background processor)
-- Closes cards and advances turn after miss delay
-- =============================================================
create or replace function rpc_resolve_miss(
  p_turn_id uuid
) returns void language plpgsql security definer as $$
declare
  v_turn turns%rowtype;
begin
  select * into v_turn from turns where id = p_turn_id for update;

  if not found                     then return; end if;
  if v_turn.result != 'miss'       then return; end if;
  if v_turn.resolved_at is not null then return; end if;

  -- Close both cards
  update cards set is_face_up = false
  where id in (v_turn.first_card_id, v_turn.second_card_id);

  -- Mark turn resolved
  update turns set resolved_at = now() where id = p_turn_id;

  -- Advance to next player
  perform _advance_to_next_player(v_turn.room_id, v_turn.player_id);
end;
$$;


-- =============================================================
-- rpc_skip_turn  (host only — force-advance regardless of state)
-- =============================================================
create or replace function rpc_skip_turn(
  p_room_id uuid
) returns void language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_room    rooms%rowtype;
begin
  select * into v_room from rooms where id = p_room_id for update;

  if not found                    then raise exception 'Room not found'; end if;
  if v_room.host_user_id != v_user_id then raise exception 'Only host can skip turn'; end if;
  if v_room.status != 'playing'   then raise exception 'Game not active'; end if;

  -- Close any face-up unmatched cards
  update cards set is_face_up = false
  where room_id = p_room_id and is_face_up = true and is_matched = false;

  -- Resolve any pending miss record
  update turns set resolved_at = now()
  where room_id = p_room_id and result = 'miss' and resolved_at is null;

  insert into game_events (room_id, event_type, payload)
  values (p_room_id, 'turn_skipped',
    jsonb_build_object('by_host', v_user_id,
                       'skipped_player_id', v_room.current_turn_player_id));

  perform _advance_to_next_player(p_room_id, v_room.current_turn_player_id);
end;
$$;


-- =============================================================
-- rpc_mark_player_inactive
-- Called on client disconnect / presence leave
-- =============================================================
create or replace function rpc_mark_player_inactive(
  p_room_id uuid
) returns void language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_player  players%rowtype;
  v_room    rooms%rowtype;
begin
  select * into v_player
  from players
  where room_id = p_room_id and user_id = v_user_id
  for update;

  if not found then return; end if;

  update players set is_active = false, last_seen_at = now()
  where id = v_player.id;

  insert into game_events (room_id, event_type, payload)
  values (p_room_id, 'player_inactive',
    jsonb_build_object('player_id', v_player.id,
                       'display_name', v_player.display_name));

  select * into v_room from rooms where id = p_room_id for update;

  -- If it was their turn → skip it
  if v_room.status = 'playing'
     and v_room.current_turn_player_id = v_player.id then

    -- Close any open cards
    update cards set is_face_up = false
    where room_id = p_room_id and is_face_up = true and is_matched = false;

    -- Resolve pending miss
    update turns set resolved_at = now()
    where room_id = p_room_id and result = 'miss' and resolved_at is null;

    perform _advance_to_next_player(p_room_id, v_player.id);
  end if;
end;
$$;
