-- =============================================================
-- rpc_process_pending_misses
-- Finds all miss turns whose miss_resolve_at has passed and resolves them.
-- Called by: pg_cron (every minute) + client timer (after miss_reveal_ms)
-- The client trigger gives fast UX; pg_cron is the safety net.
-- =============================================================
create or replace function rpc_process_pending_misses()
returns void language plpgsql security definer as $$
declare
  v_turn turns%rowtype;
begin
  for v_turn in
    select * from turns
    where result = 'miss'
      and resolved_at is null
      and miss_resolve_at <= now()
    for update skip locked
  loop
    perform rpc_resolve_miss(v_turn.id);
  end loop;
end;
$$;


-- =============================================================
-- rpc_cleanup_inactive_players
-- Marks players inactive if they haven't been seen for >30 seconds.
-- If it was their turn, advances the game.
-- =============================================================
create or replace function rpc_cleanup_inactive_players()
returns void language plpgsql security definer as $$
declare
  v_player players%rowtype;
  v_room   rooms%rowtype;
begin
  for v_player in
    select * from players
    where is_active = true
      and last_seen_at < now() - interval '30 seconds'
    for update skip locked
  loop
    update players set is_active = false where id = v_player.id;

    insert into game_events (room_id, event_type, payload)
    values (v_player.room_id, 'player_inactive',
      jsonb_build_object('player_id', v_player.id,
                         'reason', 'timeout'));

    select * into v_room
    from rooms
    where id = v_player.room_id
    for update;

    if v_room.status = 'playing'
       and v_room.current_turn_player_id = v_player.id then

      update cards set is_face_up = false
      where room_id = v_player.room_id
        and is_face_up = true
        and is_matched = false;

      update turns set resolved_at = now()
      where room_id = v_player.room_id
        and result = 'miss'
        and resolved_at is null;

      perform _advance_to_next_player(v_player.room_id, v_player.id);
    end if;
  end loop;
end;
$$;


-- =============================================================
-- rpc_force_advance_expired_turns
-- Advances turn when turn_time_limit_seconds has been exceeded.
-- =============================================================
create or replace function rpc_force_advance_expired_turns()
returns void language plpgsql security definer as $$
declare
  v_room rooms%rowtype;
begin
  for v_room in
    select * from rooms
    where status = 'playing'
      and turn_timer_enabled = true
      and turn_time_limit_seconds is not null
      and board_locked = false
      and turn_started_at < now() - (turn_time_limit_seconds || ' seconds')::interval
    for update skip locked
  loop
    update cards set is_face_up = false
    where room_id = v_room.id
      and is_face_up = true
      and is_matched = false;

    update turns set resolved_at = now()
    where room_id = v_room.id
      and result = 'miss'
      and resolved_at is null;

    insert into game_events (room_id, event_type, payload)
    values (v_room.id, 'turn_expired',
      jsonb_build_object('player_id', v_room.current_turn_player_id));

    perform _advance_to_next_player(v_room.id, v_room.current_turn_player_id);
  end loop;
end;
$$;


-- =============================================================
-- refresh_system_docs
-- Snapshots schema information into system_docs for documentation.
-- =============================================================
create or replace function refresh_system_docs()
returns void language plpgsql security definer as $$
begin
  insert into system_docs (doc_type, content, refreshed_at)
  values (
    'schema',
    (
      select jsonb_agg(
        jsonb_build_object(
          'table',   t.table_name,
          'columns', (
            select jsonb_agg(
              jsonb_build_object(
                'name',     c.column_name,
                'type',     c.data_type,
                'nullable', c.is_nullable
              ) order by c.ordinal_position
            )
            from information_schema.columns c
            where c.table_schema = 'public'
              and c.table_name = t.table_name
          )
        )
      )
      from information_schema.tables t
      where t.table_schema = 'public'
        and t.table_type   = 'BASE TABLE'
    ),
    now()
  )
  on conflict (doc_type) do update
    set content      = excluded.content,
        refreshed_at = excluded.refreshed_at;

  insert into system_docs (doc_type, content, refreshed_at)
  values (
    'rpc_functions',
    (
      select jsonb_agg(
        jsonb_build_object(
          'name',      p.proname,
          'language',  l.lanname,
          'args',      pg_get_function_arguments(p.oid)
        )
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language  l on l.oid = p.prolang
      where n.nspname = 'public'
        and p.prokind = 'f'
    ),
    now()
  )
  on conflict (doc_type) do update
    set content      = excluded.content,
        refreshed_at = excluded.refreshed_at;
end;
$$;
