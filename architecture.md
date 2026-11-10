# Architektura – Predykcje MŚ2026

Dokumentacja techniczna aplikacji. Ogólny opis projektu jest w [README.md](README.md).

---

## 1. Przegląd

Aplikacja nie ma własnego backendu ani API routes. Cała logika działa w przeglądarce, która rozmawia bezpośrednio z Supabase:

```
┌──────────────────────┐        ┌───────────────────────────────────────────┐
│ Przeglądarka         │        │ Supabase                                  │
│ (Next.js, "use       │◄──────►│  Auth          – logowanie                │
│  client")            │  REST  │  Postgres      – tabele + RLS + triggery  │
│                      │◄───────│  Realtime      – powiadomienia o zmianach │
└──────────────────────┘        │  Edge Function – sync-results             │
                                │  pg_cron       – wywołanie co 10 sekund   │
                                └──────────────────┬────────────────────────┘
                                                   │ HTTPS (X-Auth-Token)
                                                   ▼
                                         ┌───────────────────┐
                                         │ football-data.org │
                                         └───────────────────┘
```

- Dostęp do danych kontroluje **RLS w Supabase**, a nie kod aplikacji.
- **Punkty liczy baza** (triggery), a nie frontend.
- Jedynym kodem po stronie serwera jest funkcja Edge `sync-results`, która pobiera wyniki meczów.

## 2. Technologie

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Style | Tailwind CSS v4 |
| Wykresy | Recharts (strona `progress`) |
| Baza, logowanie, realtime | Supabase (`@supabase/supabase-js`) |
| Funkcja serwerowa | Supabase Edge Function (Deno) |
| Wyniki meczów | API football-data.org (v4) |

## 3. Struktura katalogów

```
app/
  layout.tsx            – wspólny layout
  page.tsx              – "/" przekierowuje na /login
  login/                – logowanie i zakładanie konta
  dashboard/            – zasady i informacje
  matches/              – obstawianie meczów i typ bonusowy
  leaderboard/          – ranking + macierz typów (LeaderboardGrid)
  progress/             – wykresy punktów w czasie
  leagues/              – dołączanie do lig, wyjście, zakładanie (admin)
  admin/                – panel admina: ręczne wyniki meczów
components/
  Navbar.tsx            – nawigacja i wylogowanie
  LeaderboardGrid.tsx   – tabela użytkownicy × mecze
  LeagueSelect.tsx      – wybór ligi
lib/
  supabase.ts           – wspólny klient Supabase
  auth.ts               – signIn / signUp / signOut (login → e-mail)
  useRequireAuth.ts     – ochrona stron wymagających logowania
  useUser.ts            – aktualny użytkownik
  useIsAdmin.ts         – czy zalogowany jest adminem (link i przekierowanie)
  useLeagues.ts         – ligi gracza, wybrana liga, przełącznik „Obstaw wszędzie to samo”
  copyPredictions.ts    – kopiowanie typów do nowej ligi
supabase/
  functions/sync-results/index.ts      – pobieranie wyników
  schema.sql            – pełny schemat bazy (tabele, funkcje, triggery, RLS, uprawnienia)
  dump_schema.sql       – zapytanie, które generuje schema.sql
  cron.sql              – harmonogram pg_cron
scripts/fetch-fixtures.mjs             – INSERT-y meczów z football-data.org (z external_id)
puchar/                 – modele STL pucharu do druku 3D (tylko lokalnie, w .gitignore)
```

## 4. Logowanie

- Użytkownik loguje się **loginem**, a nie e-mailem. `lib/auth.ts` zamienia login na sztuczny adres `<login>@worldcup.local` (małymi literami) i dopiero wtedy wywołuje Supabase Auth.
- Na stronie logowania można też założyć konto (`signUp`).
- Nick wyświetlany w aplikacji to adres e-mail bez części `@...`.
- Strony chronione wywołują `useRequireAuth()`. Gdy użytkownika nie ma (na przykład konto zostało usunięte), hook czyści starą sesję (`signOut`) i przekierowuje na `/login`.

## 5. Baza danych

| Tabela | Zawartość |
|---|---|
| `matches` | `home_team`, `away_team`, `match_time` (czas polski **bez strefy**), `home_score`, `away_score`, `is_it_group_phase`, `knockout_winner` (`home`/`away`), `external_id` (id meczu w football-data.org), `status` (status z football-data.org) |
| `predictions` | typy na mecze; unikalne `(user_id, match_id)`, zapisywane przez upsert; kolumna `points` |
| `bonus_predictions` | typ bonusowy (zwycięzca turnieju, król strzelców); jeden wiersz na użytkownika |
| `bonus_results` | jeden wiersz: `winner`, `top_scorer` |
| `players` | `total_points`, `exact_hits` – sumy ze wszystkich lig; aplikacja już z niej nie korzysta |
| `leagues` | ligi: `name`, `password_hash` (bcrypt, niedostępny z aplikacji); zakłada je tylko admin (`create_league`) |
| `league_members` | członkowie lig (`league_id`, `user_id`, `user_email`); dołączanie hasłem (`join_league`), wyjście (`leave_league`) |
| `league_standings` (widok) | ranking ligi: suma punktów typów i bonusu oraz dokładne trafienia per (liga, gracz) |

`predictions` i `bonus_predictions` mają kolumnę `league_id` – w każdej lidze gracz ma osobne typy. Przełącznik „Obstaw wszędzie to samo” na stronie Mecze zapisuje typ we wszystkich ligach gracza naraz.

### Punktacja (w bazie)

Punkty za każdy typ (`predictions.points`) i sumy w `players` liczą triggery w Postgresie:

| Trafienie | Punkty |
|---|---|
| Dokładny wynik | 3 |
| Tylko rozstrzygnięcie (wygrana / remis / porażka) | 1 |
| Zwycięzca turnieju (bonus) | 5 |
| Król strzelców (bonus) | 5 |

Liczy się wynik **po 90 minutach**. Trigger `trg_matches_points` przelicza punkty po zmianie `home_score`, `away_score` lub `knockout_winner`. Wynik można też wpisać albo poprawić ręcznie w bazie, a punkty przeliczą się same.

Funkcje i triggery punktów są opisane w `supabase/schema.sql`. Mają `security definer`, bo admin wpisuje wynik z aplikacji (rola `authenticated`), a RLS pozwala zwykłym użytkownikom zmieniać tylko własne typy.

## 6. Blokady czasowe (frontend)

Blokady liczy przeglądarka na podstawie `match_time`:

- mecz znika z listy do obstawiania (`matches`) po swoim rozpoczęciu,
- typy innych graczy są widoczne w `LeaderboardGrid` dopiero po rozpoczęciu meczu,
- typ bonusowy zamyka się z początkiem pierwszego meczu turnieju (`isTournamentStarted`).

Ta logika jest powielona w kilku plikach, więc przy zmianie trzeba poprawić ją wszędzie tak samo.

## 7. Strony

| Strona | Opis |
|---|---|
| `/login` | logowanie i zakładanie konta |
| `/dashboard` | zasady gry i informacje |
| `/matches` | obstawianie nadchodzących meczów i typ bonusowy |
| `/leaderboard` | ranking (z `players`) i macierz typów `LeaderboardGrid` |
| `/progress` | wykresy punktów w czasie; pomija mecze, które trwają |

Ranking sortuje po punktach, a przy remisie po liczbie dokładnych trafień. Gracze z równymi punktami i równą liczbą dokładnych trafień dzielą miejsce.

## 8. Wyniki na żywo

### Przepływ

```
pg_cron (co 10 sekund)
   │  net.http_post + nagłówek x-cron-secret
   ▼
sync-results (Edge Function)
   │  czy trwa jakiś mecz? nie → koniec
   │  tak → GET football-data.org
   ▼
UPDATE matches (wynik, status, knockout_winner)
   │
   ▼
triggery przeliczają predictions.points i players
   │
   ▼
Realtime → strony pobierają dane od nowa
```

### Funkcja `sync-results`

Plik: `supabase/functions/sync-results/index.ts`.

1. **Autoryzacja.** Zapytanie bez poprawnego nagłówka `x-cron-secret` dostaje 401. Funkcja jest wdrożona z `--no-verify-jwt`.
2. **Oszczędzanie limitu API.** Jedno wywołanie to jedno zapytanie o wszystkie mecze rozgrywek, czyli 6 zapytań na minutę przy limicie 10 na minutę w darmowym planie. API jest odpytywane tylko wtedy, gdy istnieje niezakończony mecz, który zaczął się w ciągu ostatnich 4 godzin albo zaczyna się w ciągu 5 minut.
3. **Dopasowanie meczów** z API do wierszy w bazie:
   - po `external_id`,
   - jeśli go brak, po godzinie rozpoczęcia (z dokładnością do minuty),
   - pozostałe po drużynach poznanych z już dopasowanych meczów.

   Dwa mecze o tej samej godzinie bez `external_id` zostaną niedopasowane, dlatego najlepiej wpisywać `external_id` od razu przy dodawaniu meczów.
4. **Zapis.** Funkcja zapisuje wynik po 90 minutach, `status` i `knockout_winner`. W trakcie dogrywki i karnych wyniku nie zmienia. `knockout_winner` jest ustawiany tylko w fazie pucharowej, gdy po 90 minutach jest remis.
5. **Odpowiedź.** Funkcja zwraca listę zaktualizowanych meczów (`updated`), liczbę nowych dopasowań (`linked`) i mecze niedopasowane (`unlinked`).

### Sekrety funkcji

| Sekret | Opis |
|---|---|
| `FOOTBALL_DATA_TOKEN` | klucz API football-data.org |
| `FOOTBALL_DATA_COMPETITION` | kod rozgrywek, np. `WC` (mundial), `PL` (Premier League), `FL1` (Ligue 1) |
| `FOOTBALL_DATA_SEASON` | opcjonalnie sezon, np. `2026` |
| `CRON_SECRET` | wspólny sekret z zadaniem pg_cron |

### Cron

`supabase/cron.sql` tworzy zadanie `sync-results` w `pg_cron`. Zadanie co 10 sekund wywołuje funkcję przez `pg_net`, a adres projektu i sekret odczytuje z Supabase Vault (`project_url`, `cron_secret`). Lokalna kopia sekretu crona jest w `cron.txt` (plik w `.gitignore`).

### Baza

Kolumny `external_id` (unikalna) i `status` w `matches`, Realtime dla `matches`, `predictions`, `players`, `league_members` i `bet_markers` oraz trigger punktów na zmianę `knockout_winner` są w `supabase/schema.sql`.

### Frontend

- `leaderboard`, `LeaderboardGrid`, `matches` i `progress` subskrybują Realtime i po zmianie pobierają dane od nowa.
- Każde zamontowanie komponentu używa unikalnej nazwy kanału, bo `supabase.channel()` zwraca istniejący kanał o tej samej nazwie, dopóki poprzedni jest jeszcze usuwany.
- Statusy na żywo to `IN_PLAY`, `PAUSED`, `EXTRA_TIME` i `PENALTY_SHOOTOUT`. Tabela pokazuje przy nich „● NA ŻYWO”. Stała `LIVE_STATUSES` jest powielona we frontendzie i w funkcji.

### Wdrożenie

Na nowym projekcie Supabase najpierw uruchom w SQL Editorze `supabase/schema.sql` (cały schemat), a potem:

```bash
npx supabase functions deploy sync-results --no-verify-jwt
npx supabase secrets set FOOTBALL_DATA_TOKEN=... FOOTBALL_DATA_COMPETITION=... CRON_SECRET=...
```

Następnie w SQL Editorze trzeba dodać sekrety `project_url` i `cron_secret` do Vault i uruchomić `supabase/cron.sql`.

## 9. Wgrywanie terminarza

Mecze wgrywa się skryptem `scripts/fetch-fixtures.mjs` (token `FOOTBALL_DATA_TOKEN` w `.env.local`):

```bash
node --env-file=.env.local scripts/fetch-fixtures.mjs WC 60 > mecze.sql
```

Skrypt pobiera terminarz z football-data.org i tworzy `INSERT INTO matches ...` z `external_id`, godziną w czasie polskim i `is_it_group_phase`. Wynik wkleja się w SQL Editorze. Sekret funkcji `FOOTBALL_DATA_COMPETITION` musi mieć ten sam kod rozgrywek. Nazwy drużyn są po angielsku – przed wgraniem turnieju dla graczy można je przetłumaczyć w pliku (`external_id` się nie zmienia).

## Puchar

Folder `puchar/` z modelami STL pucharu i podstawki (do druku 3D, ok. 76 MB) jest tylko lokalnie i jest w `.gitignore`. Nie jest częścią aplikacji. Podstawkę z nową datą trzeba przygotować przed każdym turniejem.

## 10. Uruchomienie lokalne

```bash
npm install
npm run dev      # serwer deweloperski
npm run build    # build produkcyjny (sprawdza też typy)
npm run lint     # ESLint
```

W pliku `.env*` muszą być ustawione `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Projekt nie ma testów automatycznych.

## 11. Obecny stan (31.10.2026)

Wszystko jest wdrożone w projekcie Supabase `Games-predictor`. Do testu ustawione są rozgrywki `PL` (Premier League). W `matches` jest 8 meczów Premier League z 31.10 i 3 mecze Ligue 1 z 30.10. Po teście trzeba je usunąć razem z typami i przed turniejem ustawić `FOOTBALL_DATA_COMPETITION=WC`.
