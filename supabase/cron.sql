-- Harmonogram wywołań funkcji sync-results (co minutę).
-- Uruchomić raz w SQL Editorze w Supabase, po wdrożeniu funkcji.
-- Funkcja sama sprawdza, czy trwa jakiś mecz - poza meczami nie odpytuje API.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Sekrety (raz, z prawdziwymi wartościami - NIE commitować ich do repo):
-- select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
-- select vault.create_secret('<ten sam CRON_SECRET co w sekretach funkcji>', 'cron_secret');

select cron.schedule(
  'sync-results',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Wyłączenie po turnieju:
-- select cron.unschedule('sync-results');
