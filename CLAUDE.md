# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A web app for predicting match scores in the 2026 FIFA World Cup (in Polish: "Predykcje MŚ2026"). Users bet on each match's score and make one bonus pick (tournament winner and top scorer). A leaderboard ranks the users. The UI text and code comments are in Polish, so keep new user-facing strings in Polish.

## Commands

- `npm run dev`: dev server (Next.js)
- `npm run build`: production build (also type-checks)
- `npm run lint`: ESLint (flat config in `eslint.config.mjs`)

There is no test suite.

The app needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env*`. These files are gitignored.

## Architecture

- **Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Recharts (charts on the progress page), and Supabase (Postgres plus auth). There is no custom backend or API routes. The only server-side code is the Supabase Edge Function `sync-results` (see "Live results").
- **Everything runs on the client.** Pages are `"use client"` components that query Supabase directly through the shared client in `lib/supabase.ts`. Access control comes from Supabase RLS, not from app code.
- **Auth:** users sign in with a login name, not an email. `lib/auth.ts` turns a login into a fake email `<login>@worldcup.local` before calling Supabase auth. To display a nickname, the code strips the `@...` part. Protected pages call `useRequireAuth()` (`lib/useRequireAuth.ts`). It signs out stale sessions and redirects to `/login`. `/` always redirects to `/login`.
- **Supabase tables used:** `matches` (`home_team`, `away_team`, `match_time` as Polish local time without time zone, `home_score`, `away_score`, `is_it_group_phase`, `knockout_winner`, `external_id` = ESPN event id, `status` = match status in football-data.org naming, mapped from ESPN by `sync-results`), `predictions` (unique on `user_id,match_id`, upserted; includes a `points` column), `bonus_predictions` (unique on `user_id`), `bonus_results` (one row: `winner`, `top_scorer`), and `players` (`total_points`, `exact_hits`, which the leaderboard reads).
- **Scoring happens in the database.** Since commit "counting points in database", per-prediction `points` and the totals in `players` are computed in Supabase, not in the frontend. The rules are: exact score = 3 points, correct outcome (win/draw/loss) = 1 point, correct bonus winner = 5 points, correct bonus top scorer = 5 points. `lib/scoring.ts` (`calculatePoints`) is an older client-side copy of these rules and is no longer imported anywhere. Results come from the `sync-results` function; admins can still enter or correct them directly in the database.
- **Time-based locking is done on the client, using `match_time`:**
  - A match disappears from the betting list (`app/matches`) once it has started.
  - Other users' predictions appear in `LeaderboardGrid` only after the match starts.
  - Bonus picks close when the first match kicks off (`isTournamentStarted`).
  - Several pages and components duplicate this logic, so keep them consistent when you change it.
- **Pages:** `login`, `dashboard` (rules/info), `matches` (place bets), `leaderboard` (ranking table plus the `LeaderboardGrid` matrix of users × matches), and `progress` (points-over-time charts). Ties in the ranking share a place when users have equal points and equal exact hits.
- **Live results:** `supabase/functions/sync-results/index.ts` (Deno) fetches matches from the public, unofficial ESPN API (`site.api.espn.com/apis/site/v2/sports/soccer/<league>/scoreboard?dates=YYYYMMDD`, no key; it requests yesterday, today and tomorrow in UTC) and writes score, `status` and `knockout_winner` to `matches`; DB triggers then recompute points. It only calls the API when a non-finished match started within the last 4 hours or starts within 5 minutes. API matches are linked to DB rows by `external_id`; if it is empty, by kickoff time (to the minute), then by teams already known from linked matches. Two matches with the same kickoff and no `external_id` stay unlinked, so set `external_id` manually when inserting. Only the 90-minute score counts: during extra time the score is not updated, and after extra time or penalties the function counts goals up to minute 90 from ESPN `details` (for an own goal, `team` is the team credited with the goal). ESPN statuses are mapped to football-data.org names (`IN_PLAY`, `PAUSED`, `EXTRA_TIME`, `PENALTY_SHOOTOUT`, `FINISHED`), which the frontend checks.
  - Function secrets: `ESPN_LEAGUE` (default `fifa.world` for the World Cup; e.g. `eng.1` for the Premier League, `fra.1` for Ligue 1) and `CRON_SECRET`. The old `FOOTBALL_DATA_*` secrets are still set in Supabase but no longer used. Requests without a matching `x-cron-secret` header get 401. Deployed with `--no-verify-jwt`.
  - `pg_cron` job `sync-results` (from `supabase/cron.sql`) calls the function every minute via `pg_net`, reading `project_url` and `cron_secret` from Supabase Vault. The local copy of the cron secret is in `cron.txt` (gitignored).
  - Migration `supabase/migrations/20261007120000_live_results.sql` adds `external_id`/`status`, enables Realtime on `matches`, `predictions` and `players`, and makes the points trigger also fire on `knockout_winner`.
  - Frontend: `leaderboard`, `LeaderboardGrid`, `matches` and `progress` subscribe to Realtime and refetch (each mount uses a unique channel name, because `supabase.channel()` returns an existing channel with the same name while the previous one is still being removed); the grid shows "● NA ŻYWO" for live statuses; `progress` skips live matches in the charts. `LIVE_STATUSES` is duplicated in these files and the function.
  - Current state (2026-10-30): everything above is deployed to the Supabase project `Games-predictor`. For a test, `ESPN_LEAGUE` is set to `eng.1` and eight Premier League matches from 2026-10-31 (with ESPN `external_id`) were inserted into `matches`. Three Ligue 1 matches from 2026-10-30 (`external_id` 559644, 559646, 559639, which are football-data.org ids from an earlier test) are also still there. Remove all of them and their predictions after the test, and set `ESPN_LEAGUE` back to `fifa.world` before the next tournament.

## Data seeding

`games.py` is a one-off script. It reads `worldcup.json` (fixtures in English, with local UTC offsets), translates team names to Polish with `deep_translator`, and converts kickoff times to Polish time (UTC+2). It writes `INSERT INTO matches ...` statements to `wynik.sql`. Machine translation produced some wrong names in `wynik.sql`, for example Turkey → "Indyk" (the bird). Check names before you re-seed.

`puchar/` holds STL models of a trophy and is not part of the app.
