// Generuje INSERT-y do tabeli matches z terminarza football-data.org - od razu z external_id,
// więc funkcja sync-results nie musi niczego dopasowywać po godzinie.
//
// Użycie (token w .env.local jako FOOTBALL_DATA_TOKEN, plik jest w .gitignore):
//   node --env-file=.env.local scripts/fetch-fixtures.mjs <kod rozgrywek> [dni do przodu]
//   np. node --env-file=.env.local scripts/fetch-fixtures.mjs PL 7 > premier.sql
//
// Kody: PL (Premier League), FL1 (Ligue 1), BL1, SA, PD, CL, WC, EC ...
// Wynik wkleja się w SQL Editorze w Supabase. Nazwy drużyn są po angielsku z API - przed wgraniem
// turnieju dla graczy można je przetłumaczyć w pliku (external_id zostaje bez zmian).

const [code, daysArg = "7"] = process.argv.slice(2)
const token = process.env.FOOTBALL_DATA_TOKEN

if (!code) {
  console.error("Podaj kod rozgrywek, np. PL")
  process.exit(1)
}
if (!token) {
  console.error("Brak FOOTBALL_DATA_TOKEN (dodaj go do .env.local)")
  process.exit(1)
}

const days = Number(daysArg)
const isoDate = (d) => d.toISOString().slice(0, 10)
const from = new Date()
const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

const url =
  `https://api.football-data.org/v4/competitions/${code}/matches` +
  `?status=SCHEDULED,TIMED&dateFrom=${isoDate(from)}&dateTo=${isoDate(to)}`

const res = await fetch(url, { headers: { "X-Auth-Token": token } })
if (!res.ok) {
  console.error(`football-data.org: ${res.status} ${await res.text()}`)
  process.exit(1)
}
const { matches } = await res.json()

// match_time w bazie to czas polski bez strefy (tak samo liczy go sync-results)
const warsaw = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

// Faza "grupowa" = mecze, w których remis jest wynikiem końcowym (liga, grupy, faza ligowa)
const GROUP_STAGES = ["REGULAR_SEASON", "GROUP_STAGE", "LEAGUE_STAGE"]

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`

const rows = matches
  .filter((m) => m.homeTeam?.name && m.awayTeam?.name)
  .map((m) => {
    const home = m.homeTeam.shortName || m.homeTeam.name
    const away = m.awayTeam.shortName || m.awayTeam.name
    const time = warsaw.format(new Date(m.utcDate))
    const group = GROUP_STAGES.includes(m.stage)
    return `  (${sql(home)}, ${sql(away)}, ${sql(time)}, ${group}, ${m.id})`
  })

if (rows.length === 0) {
  console.error("Brak zaplanowanych meczów w tym okresie")
  process.exit(1)
}

console.log(`-- ${code}: ${rows.length} meczów, ${isoDate(from)} - ${isoDate(to)}`)
console.log("insert into public.matches (home_team, away_team, match_time, is_it_group_phase, external_id) values")
console.log(rows.join(",\n"))
console.log("on conflict (external_id) do nothing;")
