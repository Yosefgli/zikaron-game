-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- pg_cron is pre-installed in Supabase Pro/Team plans
-- Run: select * from pg_extension where extname = 'pg_cron'; to verify
-- If not available, background jobs must be triggered by client or Edge Functions
