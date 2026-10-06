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

- **Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Recharts (charts on the progress page), and Supabase (Postgres plus auth). There is no custom backend or API routes.
- **Everything runs on the client.** Pages are `"use client"` components that query Supabase directly through the shared client in `lib/supabase.ts`. Access control comes from Supabase RLS, not from app code.
- **Auth:** users sign in with a login name, not an email. `lib/auth.ts` turns a login into a fake email `<login>@worldcup.local` before calling Supabase auth. To display a nickname, the code strips the `@...` part. Protected pages call `useRequireAuth()` (`lib/useRequireAuth.ts`). It signs out stale sessions and redirects to `/login`. `/` always redirects to `/login`.
- **Supabase tables used:** `matches` (`home_team`, `away_team`, `match_time`, `home_score`, `away_score`), `predictions` (unique on `user_id,match_id`, upserted; includes a `points` column), `bonus_predictions` (unique on `user_id`), `bonus_results` (one row: `winner`, `top_scorer`), and `players` (`total_points`, `exact_hits`, which the leaderboard reads).
- **Scoring happens in the database.** Since commit "counting points in database", per-prediction `points` and the totals in `players` are computed in Supabase, not in the frontend. The rules are: exact score = 3 points, correct outcome (win/draw/loss) = 1 point, correct bonus winner = 5 points, correct bonus top scorer = 5 points. `lib/scoring.ts` (`calculatePoints`) is an older client-side copy of these rules and is no longer imported anywhere. Admins enter real results directly in the database.
- **Time-based locking is done on the client, using `match_time`:**
  - A match disappears from the betting list (`app/matches`) once it has started.
  - Other users' predictions appear in `LeaderboardGrid` only after the match starts.
  - Bonus picks close when the first match kicks off (`isTournamentStarted`).
  - Several pages and components duplicate this logic, so keep them consistent when you change it.
- **Pages:** `login`, `dashboard` (rules/info), `matches` (place bets), `leaderboard` (ranking table plus the `LeaderboardGrid` matrix of users × matches), and `progress` (points-over-time charts). Ties in the ranking share a place when users have equal points and equal exact hits.

## Data seeding

`games.py` is a one-off script. It reads `worldcup.json` (fixtures in English, with local UTC offsets), translates team names to Polish with `deep_translator`, and converts kickoff times to Polish time (UTC+2). It writes `INSERT INTO matches ...` statements to `wynik.sql`. Machine translation produced some wrong names in `wynik.sql`, for example Turkey → "Indyk" (the bird). Check names before you re-seed.

`puchar/` holds STL models of a trophy and is not part of the app.
