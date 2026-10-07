// Pobiera wyniki (na żywo i końcowe) z football-data.org i wpisuje je do tabeli matches.
// Punkty liczą się dalej triggerami w bazie. Wywoływana co minutę przez pg_cron (supabase/cron.sql).
//
// Sekrety funkcji: FOOTBALL_DATA_TOKEN, FOOTBALL_DATA_COMPETITION (np. "WC", "EC"),
// opcjonalnie FOOTBALL_DATA_SEASON (np. "2028"), CRON_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2"

type ApiScore = { home: number | null; away: number | null }

type ApiMatch = {
  id: number
  utcDate: string
  status: string
  homeTeam: { id: number | null }
  awayTeam: { id: number | null }
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT"
    fullTime: ApiScore
    regularTime?: ApiScore
  }
}

type DbMatch = {
  id: string
  home_team: string
  away_team: string
  match_time: string
  home_score: number | null
  away_score: number | null
  is_it_group_phase: boolean
  knockout_winner: "home" | "away" | null
  external_id: number | null
  status: string | null
}

const LIVE_STATUSES = ["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"]

const warsawFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

// match_time w bazie to czas polski bez strefy, np. "2026-06-11T21:00:00"
const warsawTime = (date: Date) => warsawFormat.format(date).replace(" ", "T")

// Godziny między dwoma czasami polskimi bez strefy (oba traktowane tak samo, więc strefa się znosi)
const hoursBetween = (a: string, b: string) =>
  Math.abs(new Date(a.replace(" ", "T") + "Z").getTime() - new Date(b.replace(" ", "T") + "Z").getTime()) / 3600000

const minuteKey = (time: string) => time.replace(" ", "T").slice(0, 16)

// Wynik po 90 minutach (zgodnie z regulaminem - bez dogrywki i karnych)
const regularScore = (m: ApiMatch): ApiScore | null => {
  if (m.score.duration === "REGULAR") {
    // w trakcie dogrywki fullTime zawiera już gole z dogrywki - wtedy nie ruszamy wyniku
    if (m.status === "EXTRA_TIME" || m.status === "PENALTY_SHOOTOUT") return null
    return m.score.fullTime
  }
  return m.score.regularTime ?? null
}

// Dopasowanie meczów z API do meczów w bazie: najpierw po godzinie rozpoczęcia,
// a pozostałe (ta sama godzina albo godzina zmieniona po wgraniu terminarza)
// po drużynach poznanych z już dopasowanych meczów
const linkMatches = (dbMatches: DbMatch[], apiMatches: ApiMatch[]) => {
  const usedIds = new Set(dbMatches.map((m) => m.external_id).filter((id) => id !== null))
  const links: { id: string; external_id: number }[] = []
  const apiTimes = new Map(apiMatches.map((a) => [a.id, warsawTime(new Date(a.utcDate))]))

  const candidatesFor = (m: DbMatch) =>
    apiMatches.filter((a) => !usedIds.has(a.id) && minuteKey(apiTimes.get(a.id)!) === minuteKey(m.match_time))

  const link = (m: DbMatch, a: ApiMatch) => {
    m.external_id = a.id
    usedIds.add(a.id)
    links.push({ id: m.id, external_id: a.id })
  }

  for (const m of dbMatches) {
    if (m.external_id !== null) continue
    const candidates = candidatesFor(m)
    if (candidates.length === 1) link(m, candidates[0])
  }

  const teamNames = new Map<number, string>()
  for (const m of dbMatches) {
    const a = apiMatches.find((x) => x.id === m.external_id)
    if (!a) continue
    if (a.homeTeam.id !== null) teamNames.set(a.homeTeam.id, m.home_team)
    if (a.awayTeam.id !== null) teamNames.set(a.awayTeam.id, m.away_team)
  }

  for (const m of dbMatches) {
    if (m.external_id !== null) continue
    const candidates = apiMatches.filter(
      (a) =>
        !usedIds.has(a.id) &&
        hoursBetween(apiTimes.get(a.id)!, m.match_time) <= 3 &&
        a.homeTeam.id !== null &&
        a.awayTeam.id !== null &&
        teamNames.get(a.homeTeam.id) === m.home_team &&
        teamNames.get(a.awayTeam.id) === m.away_team
    )
    if (candidates.length === 1) link(m, candidates[0])
  }

  const unlinked = dbMatches.filter((m) => m.external_id === null)
  return { links, unlinked }
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET")
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Czy trwa (albo zaraz zaczyna się) jakiś niezakończony mecz? Jeśli nie - nie odpytujemy API
  const now = Date.now()
  const { data: active, error: activeError } = await supabase
    .from("matches")
    .select("id")
    .gte("match_time", warsawTime(new Date(now - 4 * 60 * 60 * 1000)))
    .lte("match_time", warsawTime(new Date(now + 5 * 60 * 1000)))
    .or("status.is.null,status.neq.FINISHED")
    .limit(1)

  if (activeError) return Response.json({ error: activeError.message }, { status: 500 })
  if (!active?.length) return Response.json({ skipped: "brak trwających meczów" })

  const competition = Deno.env.get("FOOTBALL_DATA_COMPETITION") ?? "WC"
  const season = Deno.env.get("FOOTBALL_DATA_SEASON")
  const url = `https://api.football-data.org/v4/competitions/${competition}/matches${season ? `?season=${season}` : ""}`

  const res = await fetch(url, {
    headers: { "X-Auth-Token": Deno.env.get("FOOTBALL_DATA_TOKEN")! },
  })
  if (!res.ok) {
    return Response.json({ error: `football-data.org: ${res.status} ${await res.text()}` }, { status: 502 })
  }
  const apiMatches: ApiMatch[] = (await res.json()).matches

  const { data: dbMatches, error: dbError } = await supabase
    .from("matches")
    .select("id, home_team, away_team, match_time, home_score, away_score, is_it_group_phase, knockout_winner, external_id, status")
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 })

  const { links, unlinked } = linkMatches(dbMatches as DbMatch[], apiMatches)
  for (const l of links) {
    await supabase.from("matches").update({ external_id: l.external_id }).eq("id", l.id)
  }

  const updated: string[] = []

  for (const m of dbMatches as DbMatch[]) {
    const a = apiMatches.find((x) => x.id === m.external_id)
    if (!a) continue

    const isLive = LIVE_STATUSES.includes(a.status)
    const isFinished = a.status === "FINISHED"
    if (!isLive && !isFinished) continue

    const patch: Partial<DbMatch> = {}
    if (a.status !== m.status) patch.status = a.status

    const score = regularScore(a)
    if (score && score.home !== null && score.away !== null) {
      if (score.home !== m.home_score) patch.home_score = score.home
      if (score.away !== m.away_score) patch.away_score = score.away

      // Zwycięzca dogrywki/karnych - tylko w fazie pucharowej przy remisie po 90 minutach
      if (!m.is_it_group_phase && isFinished) {
        const winner =
          score.home === score.away
            ? a.score.winner === "HOME_TEAM" ? "home" : a.score.winner === "AWAY_TEAM" ? "away" : null
            : null
        if (winner !== m.knockout_winner) patch.knockout_winner = winner
      }
    }

    if (Object.keys(patch).length === 0) continue

    const { error } = await supabase.from("matches").update(patch).eq("id", m.id)
    if (error) return Response.json({ error: error.message, match: m.id }, { status: 500 })
    updated.push(`${m.home_team} - ${m.away_team}`)
  }

  return Response.json({
    updated,
    linked: links.length,
    unlinked: unlinked.map((m) => `${m.home_team} - ${m.away_team} (${m.match_time})`),
  })
})
