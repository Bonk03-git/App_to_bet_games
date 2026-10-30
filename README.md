### OPIS PROJEKTU
Stronka do obstawiania wyników meczy na mistrzostwach piłki nożnej

(dokładne działanie i sposób z korzystania jest opisany lokalnie)

### WYNIKI NA ŻYWO
Wyniki meczów są pobierane automatycznie z publicznego API ESPN (`site.api.espn.com`, darmowe, bez klucza) i wpisywane do tabeli `matches`. Punkty przeliczają się w bazie, a ranking i tabela typów odświeżają się same (Supabase Realtime). Trwające mecze mają w tabeli oznaczenie „● NA ŻYWO”.

Jak to działa:
- funkcja Supabase `supabase/functions/sync-results` pobiera mecze z ESPN (wczoraj, dziś i jutro) i aktualizuje wynik (po 90 minutach), status meczu i zwycięzcę dogrywki/karnych,
- zadanie `pg_cron` (`supabase/cron.sql`) wywołuje funkcję co minutę; API jest odpytywane tylko wtedy, gdy trwa jakiś mecz,
- migracja `supabase/migrations/20261007120000_live_results.sql` dodaje kolumny `external_id` i `status` oraz włącza Realtime.

Konfiguracja (wykonana w projekcie Supabase):
1. `npx supabase db push` – migracja,
2. `npx supabase functions deploy sync-results --no-verify-jwt` – wdrożenie funkcji,
3. `npx supabase secrets set ESPN_LEAGUE=... CRON_SECRET=...` – sekrety funkcji (`fifa.world` – mundial, domyślnie; `eng.1` – Premier League, `fra.1` – Ligue 1),
4. w SQL Editorze: sekrety `project_url` i `cron_secret` w vault oraz `supabase/cron.sql`.

Mecze w tabeli `matches` najlepiej dodawać od razu z `external_id` (id meczu z ESPN, pole `id` w odpowiedzi `scoreboard`) – bez niego funkcja dopasowuje mecz po godzinie rozpoczęcia i nie rozróżni dwóch meczów o tej samej porze.

API ESPN jest nieoficjalne (bez dokumentacji) – może się kiedyś zmienić. Statusy ESPN funkcja zamienia na nazwy w stylu football-data.org (`IN_PLAY`, `PAUSED`, `FINISHED` …), bo takie są zapisane w bazie i sprawdzane we froncie.

Test (31.10.2026): liga ustawiona na Premier League (`eng.1`), w bazie jest 8 meczów testowych z 31.10. Zostały też 3 mecze Ligue 1 z 30.10 (testowane jeszcze z football-data.org). Po teście trzeba je usunąć razem z typami i ustawić `ESPN_LEAGUE` z powrotem na `fifa.world`.
