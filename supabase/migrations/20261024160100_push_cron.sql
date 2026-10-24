-- Job Web Push ogni minuto (stesse vault secrets del job 'fantalive-live', che resta invariato).
-- L'endpoint esce subito se non ci sono iscritti o partite attive.
SELECT cron.schedule(
  'fantalive-push',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fantalive_app_url') || '/api/cron/push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fantalive_cron_secret')
    ),
    timeout_milliseconds := 25000
  );
  $$
);

-- Pulizia notturna della deduplica (03:30 UTC): oltre 21 giorni non serve più.
SELECT cron.schedule(
  'fantalive-push-cleanup',
  '30 3 * * *',
  $$ DELETE FROM public.sent_notifications WHERE sent_at < now() - interval '21 days' $$
);
