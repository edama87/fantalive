-- Enable pg_cron and pg_net extensions for scheduled HTTP calls
-- Requires Supabase project with these extensions enabled

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role (required for cron jobs)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule the live ingestion job to run every minute
-- Reads app URL and cron secret from Supabase Vault secrets:
--   - fantalive_app_url: e.g. https://fantalive.vercel.app
--   - fantalive_cron_secret: the CRON_SECRET value
--
-- The job calls GET /api/cron/live with Authorization: Bearer <secret>
-- The endpoint performs a cheap early-exit check if no match is within -15/+150 min of kickoff

SELECT cron.schedule(
  'fantalive-live',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fantalive_app_url') || '/api/cron/live',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fantalive_cron_secret'),
      'Content-Type', 'application/json'
    )
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - schedules fantalive-live every minute';
COMMENT ON EXTENSION pg_net IS 'HTTP client for PostgreSQL - calls the live ingestion endpoint';
