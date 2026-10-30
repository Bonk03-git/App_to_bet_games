### OPIS PROJEKTU
Stronka do obstawiania wyników meczy na mistrzostwach piłki nożnej

(dokładne działanie i sposób z korzystania jest opisany lokalnie)

### WYNIKI NA ŻYWO
Wyniki meczów są pobierane automatycznie z [football-data.org](https://www.football-data.org) i wpisywane do tabeli `matches`. Punkty przeliczają się w bazie, a ranking i tabela typów odświeżają się same (Supabase Realtime). Trwające mecze mają w tabeli oznaczenie „● NA ŻYWO”.

Jak to działa:
- funkcja Supabase `supabase/functions/sync-results` pobiera mecze z API i aktualizuje wynik (po 90 minutach) oraz status meczu,
- zadanie `pg_cron` (`supabase/cron.sql`) wywołuje funkcję co minutę; API jest odpytywane tylko wtedy, gdy trwa jakiś mecz,
- migracja `supabase/migrations/20261007120000_live_results.sql` dodaje kolumny `external_id` i `status` oraz włącza Realtime.

Konfiguracja (wykonana w projekcie Supabase):
1. `npx supabase db push` – migracja,
2. `npx supabase functions deploy sync-results --no-verify-jwt` – wdrożenie funkcji,
3. `npx supabase secrets set FOOTBALL_DATA_TOKEN=... FOOTBALL_DATA_COMPETITION=... CRON_SECRET=...` – sekrety funkcji (`WC` – mundial, `FL1` – Ligue 1),
4. w SQL Editorze: sekrety `project_url` i `cron_secret` w vault oraz `supabase/cron.sql`.

Mecze w tabeli `matches` najlepiej dodawać od razu z `external_id` (id meczu z football-data.org) – bez niego funkcja dopasowuje mecz po godzinie rozpoczęcia i nie rozróżni dwóch meczów o tej samej porze.

Test (30.10.2026): rozgrywki ustawione na Ligue 1 (`FL1`), w bazie są 3 mecze testowe (Le Havre – PSG, Nicea – Rennes, Lille – Lens). Po teście trzeba je usunąć razem z typami.
