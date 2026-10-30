// Pobiera wyniki (na żywo i końcowe) z publicznego API ESPN i wpisuje je do tabeli matches.
// Punkty liczą się dalej triggerami w bazie. Wywoływana co minutę przez pg_cron (supabase/cron.sql).
// API ESPN jest nieoficjalne (bez klucza i dokumentacji) - może się kiedyś zmienić.
//
// Sekrety funkcji: ESPN_LEAGUE (np. "fifa.world" - mundial, "eng.1" - Premier League), CRON_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2"

type ApiScore = { home: number | null; away: number | null }

// Mecz z ESPN sprowadzony do postaci używanej dalej (statusy jak w football-data.org,
// bo takie są zapisywane w bazie i sprawdzane we froncie)
type ApiMatch = {
  id: number
  utcDate: string
  status: string
  homeTeam: { id: number | null }
  awayTeam: { id: number | null }
  regular: ApiScore | null
  winner: "home" | "away" | null
}

type EspnCompetitor = {
  homeAway: "home" | "away"
  team: { id: string }
  score?: string
  winner?: boolean
}

type EspnEvent = {
  id: string
  date: string
  competitions: {
    status: { period: number; type: { name: string; state: "pre" | "in" | "post"; completed: boolean } }
    competitors: EspnCompetitor[]
    details?: {
      scoringPlay?: boolean
      shootout?: boolean
      clock?: { displayValue?: string }
      team?: { id: string }
    }[]
  }[]
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

// Status ESPN -> status w stylu football-data.org
const mapStatus = (period: number, type: { name: string; state: string; completed: boolean }) => {
  if (type.state === "pre") return "SCHEDULED"
  if (type.state === "post") return type.completed ? "FINISHED" : "CANCELLED"
  if (type.name.includes("SHOOTOUT") || period >= 5) return "PENALTY_SHOOTOUT"
  if (period >= 3) return "EXTRA_TIME"
  if (type.name.includes("HALFTIME") || type.name.includes("END_OF")) return "PAUSED"
  return "IN_PLAY"
}

// Wynik po 90 minutach (zgodnie z regulaminem - bez dogrywki i karnych)
const regularScore = (
  c: EspnEvent["competitions"][number],
  home: EspnCompetitor,
  away: EspnCompetitor
): ApiScore | null => {
  if (c.status.type.state === "pre") return null
  // w regulaminowym czasie (także zaraz po nim) wynik ESPN to wynik po 90 minutach
  if (c.status.period <= 2) return { home: Number(home.score ?? 0), away: Number(away.score ?? 0) }
  // w trakcie dogrywki/karnych nie ruszamy wyniku
  if (!c.status.type.completed) return null
  // po dogrywce/karnych liczymy gole do 90. minuty (z doliczonym czasem, np. "90'+3'");
  // przy samobóju team to drużyna, której gola zaliczono
  const goals = (c.details ?? []).filter(
    (d) => d.scoringPlay && !d.shootout && parseInt(d.clock?.displayValue ?? "999") <= 90
  )
  return {
    home: goals.filter((d) => d.team?.id === home.team.id).length,
    away: goals.filter((d) => d.team?.id === away.team.id).length,
  }
}

const toApiMatch = (e: EspnEvent): ApiMatch | null => {
  const c = e.competitions[0]
  const home = c?.competitors.find((t) => t.homeAway === "home")
  const away = c?.competitors.find((t) => t.homeAway === "away")
  if (!c || !home || !away) return null
  return {
    id: Number(e.id),
    utcDate: e.date,
    status: mapStatus(c.status.period, c.status.type),
    homeTeam: { id: Number(home.team.id) },
    awayTeam: { id: Number(away.team.id) },
    regular: regularScore(c, home, away),
    winner: home.winner ? "home" : away.winner ? "away" : null,
  }
}

// Data w formacie ESPN (RRRRMMDD, UTC)
const espnDate = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "")

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

  // ESPN zwraca mecze z jednego dnia - bierzemy wczoraj, dziś i jutro (UTC),
  // żeby nie zgubić meczów koło północy (ESPN nie dzieli dni dokładnie po UTC)
  const league = Deno.env.get("ESPN_LEAGUE") ?? "fifa.world"
  const day = 24 * 60 * 60 * 1000
  const apiMatches: ApiMatch[] = []
  for (const offset of [-day, 0, day]) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${espnDate(new Date(now + offset))}`
    const res = await fetch(url)
    if (!res.ok) {
      return Response.json({ error: `ESPN: ${res.status} ${await res.text()}` }, { status: 502 })
    }
    for (const e of ((await res.json()).events ?? []) as EspnEvent[]) {
      const a = toApiMatch(e)
      if (a && !apiMatches.some((x) => x.id === a.id)) apiMatches.push(a)
    }
  }

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

    const score = a.regular
    if (score && score.home !== null && score.away !== null) {
      if (score.home !== m.home_score) patch.home_score = score.home
      if (score.away !== m.away_score) patch.away_score = score.away

      // Zwycięzca dogrywki/karnych - tylko w fazie pucharowej przy remisie po 90 minutach
      if (!m.is_it_group_phase && isFinished) {
        const winner = score.home === score.away ? a.winner : null
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
