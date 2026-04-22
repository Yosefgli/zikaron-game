-- =============================================================
-- pg_cron SCHEDULES
-- These are the safety-net background jobs.
-- Miss resolution also gets a client-side soft trigger for fast UX.
--
-- IMPORTANT: pg_cron requires the extension to be enabled.
-- In Supabase: Dashboard > Database > Extensions > pg_cron
-- Minimum cron interval is 1 minute.
-- =============================================================

-- Process missed card pairs (safety net — client also triggers this)
select cron.schedule(
  'process-pending-misses',
  '* * * * *',
  'select rpc_process_pending_misses()'
);

-- Detect and remove timed-out players (30s timeout defined in function)
select cron.schedule(
  'cleanup-inactive-players',
  '* * * * *',
  'select rpc_cleanup_inactive_players()'
);

-- Advance expired turns when turn timer is enabled
select cron.schedule(
  'force-advance-expired-turns',
  '* * * * *',
  'select rpc_force_advance_expired_turns()'
);

-- Refresh system documentation snapshot (once per hour)
select cron.schedule(
  'refresh-system-docs',
  '0 * * * *',
  'select refresh_system_docs()'
);
