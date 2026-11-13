"use client"

import { Fragment, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Navbar from "@/components/Navbar"
import { useRequireAuth } from "@/lib/useRequireAuth"
import { useLeagues } from "@/lib/useLeagues"
import LeagueSelect, { NoLeagues } from "@/components/LeagueSelect"
const WORLD_CUP_COUNTRIES = [
  "Algieria",
  "Anglia",
  "Arabia Saudyjska",
  "Argentyna",
  "Australia",
  "Austria",

  "Belgia",
  "Bośnia i Hercegowina",
  "Brazylia",

  "Czechy",
  "Curaçao",
  "Chorwacja",

  "DR Kongo",

  "Egipt",
  "Ekwador",

  "Francja",

  "Ghana",

  "Haiti",
  "Hiszpania",
  "Holandia",

  "Irak",
  "Iran",

  "Japonia",
  "Jordania",

  "Kanada",
  "Katar",
  "Kolumbia",
  "Korea Południowa",

  "Maroko",
  "Meksyk",

  "Niemcy",
  "Nowa Zelandia",
  "Norwegia",

  "Paragwaj",
  "Portugalia",
  "Panama",

  "Republika Zielonego Przylądka",
  "RPA",

  "Senegal",
  "Szkocja",
  "Szwajcaria",
  "Szwecja",

  "Tunezja",
  "Turcja",

  "USA",

  "Uzbekistan",

  "Urugwaj",

  "Wybrzeże Kości Słoniowej"
]

interface Match {
  id: string
  home_team: string
  away_team: string
  match_time: string
  is_it_group_phase: boolean
}

interface Prediction {
  league_id: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  who_wins: "home" | "away" | null
}

interface BonusPrediction {
  league_id: string
  predicted_winner: string
  predicted_top_scorer: string
}

export default function MatchesPage() {
  useRequireAuth()
  const {
    user,
    leagues,
    loading: leaguesLoading,
    selectedLeague,
    selectLeague,
    sameEverywhere,
    setSameEverywhere,
  } = useLeagues()

  const [matches, setMatches] = useState<Match[]>([])
  // Typy użytkownika ze wszystkich jego lig (każdy wiersz ma league_id)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [bonusPredictions, setBonusPredictions] = useState<BonusPrediction[]>([])

  // Aktualny czas odświeżany co 30 s, żeby rozpoczęte mecze znikały bez przeładowania strony
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])
  const isMatchStarted = (matchTime: string) => {
    return now >= new Date(matchTime)
  }

  // Wpisywane wyniki (żeby wykryć remis) i wybór zwycięzcy dogrywki/karnych w fazie pucharowej
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [winnerPicks, setWinnerPicks] = useState<Record<string, "home" | "away">>({})

  // Ligi, do których trafia zapisany typ: wszystkie ("obstaw wszędzie to samo") albo tylko wybrana
  const targetLeagues = sameEverywhere ? leagues : selectedLeague ? [selectedLeague] : []

  const updateScoreInput = (matchId: string, side: "home" | "away", value: string) => {
    setScoreInputs((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] ?? { home: "", away: "" }), [side]: value },
    }))
  }

  const isDrawEntered = (matchId: string) => {
    const input = scoreInputs[matchId]
    return !!input && input.home !== "" && input.away !== "" && Number(input.home) === Number(input.away)
  }

  const isTournamentStarted = () => {
    if (matches.length === 0) return false

    const firstMatch = [...matches].sort(
      (a, b) =>
        new Date(a.match_time).getTime() -
        new Date(b.match_time).getTime()
    )[0]

    return new Date() >= new Date(firstMatch.match_time)
  }

  const fetchPredictions = async (userId: string) => {
    const { data: preds } = await supabase
      .from("predictions")
      .select("league_id, match_id, predicted_home_score, predicted_away_score, who_wins")
      .eq("user_id", userId)

    setPredictions(preds || [])
  }

  const fetchBonusPredictions = async (userId: string) => {
    const { data: bonus } = await supabase
      .from("bonus_predictions")
      .select("league_id, predicted_winner, predicted_top_scorer")
      .eq("user_id", userId)

    setBonusPredictions(bonus || [])
  }

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("match_time", { ascending: true })

      setMatches(matchesData || [])

      await fetchPredictions(user.id)
      await fetchBonusPredictions(user.id)
    }

    fetchData()

    // Na żywo: po zmianie meczów lub typów w bazie pobieramy dane od nowa
    // (unikalna nazwa kanału - patrz komentarz w app/leaderboard/page.tsx)
    let refetchTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer)
      refetchTimer = setTimeout(fetchData, 500)
    }

    const channel = supabase
      .channel(`matches-${Date.now()}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions", filter: `user_id=eq.${user.id}` }, scheduleRefetch)
      .subscribe()

    return () => {
      clearTimeout(refetchTimer)
      supabase.removeChannel(channel)
    }
  }, [user])

  const savePrediction = async (match: Match) => {
    const matchId = match.id
    const home = (document.getElementById(`home-${matchId}`) as HTMLInputElement).value
    const away = (document.getElementById(`away-${matchId}`) as HTMLInputElement).value

    if (home.trim() === "" || away.trim() === "") {
      alert("Proszę uzupełnić oba wyniki przed zapisaniem!")
      return
    }

    // W fazie pucharowej przy remisie trzeba wskazać zwycięzcę dogrywki/karnych
    const isKnockoutDraw = !match.is_it_group_phase && Number(home) === Number(away)
    const whoWins = isKnockoutDraw ? winnerPicks[matchId] ?? null : null

    if (isKnockoutDraw && !whoWins) {
      alert("Wybierz, kto wygra w dogrywce lub karnych!")
      return
    }

    if (!user || targetLeagues.length === 0) return

    const { error } = await supabase
      .from("predictions")
      .upsert(
        targetLeagues.map((league) => ({
          user_id: user.id,
          user_email: user.email,
          league_id: league.id,
          match_id: matchId,
          predicted_home_score: Number(home),
          predicted_away_score: Number(away),
          who_wins: whoWins,
        })),
        { onConflict: "user_id,match_id,league_id" }
      )

    if (error) {
      alert(error.message)
      return
    }

    await fetchPredictions(user.id)
  }

  const saveBonusPrediction = async () => {
    if (isTournamentStarted()) {
      alert("Typowanie bonusowe zamknięte ⛔")
      return
    }
    if (!user || targetLeagues.length === 0) return

    const winner = (document.getElementById("winner") as HTMLInputElement).value
    const scorer = (document.getElementById("scorer") as HTMLInputElement).value

    if (!winner) return alert("Wybierz zwycięzcę MŚ")
    if (!scorer) return alert("Wpisz króla strzelców")

    const { error } = await supabase
      .from("bonus_predictions")
      .upsert(
        targetLeagues.map((league) => ({
          user_id: user.id,
          user_email: user.email,
          league_id: league.id,
          predicted_winner: winner,
          predicted_top_scorer: scorer,
        })),
        { onConflict: "user_id,league_id" }
      )

    if (error) {
      alert(error.message)
      return
    }

    await fetchBonusPredictions(user.id)
  }

  const formatPrediction = (pred: Prediction, match: Match) =>
    `${pred.predicted_home_score} - ${pred.predicted_away_score}` +
    (pred.who_wins
      ? ` (po dogrywce/karnych: ${pred.who_wins === "home" ? match.home_team : match.away_team})`
      : "")

  const formatBonus = (b: BonusPrediction) => `${b.predicted_winner} | ${b.predicted_top_scorer}`

  // Typy bonusowe w ligach, do których teraz zapisujemy
  const targetBonuses = targetLeagues.map((l) => ({
    league: l,
    bonus: bonusPredictions.find((b) => b.league_id === l.id) ?? null,
  }))
  const bonusAllSame =
    targetBonuses.length > 0 &&
    targetBonuses.every(
      (t) => t.bonus && formatBonus(t.bonus) === formatBonus(targetBonuses[0].bonus!)
    )
  // Do wypełnienia formularza: typ z pierwszej ligi, która go ma
  const bonusPrediction = targetBonuses.find((t) => t.bonus)?.bonus ?? null

  // Mecze, które się jeszcze nie rozpoczęły - te już wystartowane są całkowicie usuwane z listy
  const upcomingMatches = matches
    .filter((m) => !isMatchStarted(m.match_time))
    .sort(
      (a, b) =>
        new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
    )

  // Dopóki nie wiemy, w jakich ligach jest gracz, nie pokazujemy pustej strony
  // (inaczej przez chwilę widać pusty podgląd, a dopiero potem "dołącz do ligi")
  if (leaguesLoading || leagues.length === 0) {
    return (
      <div>
        <Navbar />
        <div className="max-w-3xl mx-auto p-10">
          {leaguesLoading ? <div className="text-zinc-400 text-center">Ładowanie...</div> : <NoLeagues />}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Navbar />

      <div className="max-w-3xl mx-auto p-10">

        {/* LIGI - wybór i przełącznik mają sens dopiero przy co najmniej dwóch ligach */}
        {leagues.length > 1 && (
          <div className="card mb-8">
            <LeagueSelect
              leagues={leagues}
              selectedLeague={selectedLeague}
              onSelect={selectLeague}
              allLeagues={sameEverywhere}
            >
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={sameEverywhere}
                  onChange={(e) => setSameEverywhere(e.target.checked)}
                />
                <span>Obstaw wszędzie to samo</span>
              </label>
            </LeagueSelect>
          </div>
        )}

        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Bonusy
          </h2>

          {!isTournamentStarted() && bonusPrediction && (
            <div className="mb-4 text-blue-400 text-center">
              {bonusAllSame ? (
                <>
                  Aktualne typy: <span className="font-semibold">{formatBonus(bonusPrediction)}</span>
                </>
              ) : (
                targetBonuses.map(({ league, bonus }) => (
                  <div key={league.id}>
                    {league.name}:{" "}
                    {bonus ? (
                      <span className="font-semibold">{formatBonus(bonus)}</span>
                    ) : (
                      <span className="text-zinc-500">brak typu</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {isTournamentStarted() ? (
            <div className="text-center text-zinc-300 space-y-3">
              {targetBonuses.map(({ league, bonus }) => (
                <div key={league.id}>
                  {targetBonuses.length > 1 && <p className="text-zinc-400 text-sm">{league.name}</p>}
                  <p>
                    Wytypowany zwycięzca:{" "}
                    <span className="font-bold">{bonus?.predicted_winner || "-"}</span>
                  </p>
                  <p>
                    Wytypowany król strzelców:{" "}
                    <span className="font-bold">{bonus?.predicted_top_scorer || "-"}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            // key: po zmianie ligi albo zapisie formularz wypełnia się aktualnym typem
            <div
              key={`${targetLeagues.map((l) => l.id).join(",")}|${bonusPrediction ? formatBonus(bonusPrediction) : ""}`}
              className="flex flex-col gap-3"
            >
              <select
                id="winner"
                className="field p-3"
                defaultValue={bonusPrediction?.predicted_winner || ""}
              >
                <option value="">Wybierz zwycięzcę</option>
                {WORLD_CUP_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <input
                id="scorer"
                placeholder="Król strzelców"
                className="field p-3"
                defaultValue={bonusPrediction?.predicted_top_scorer || ""}
              />

              <button
                onClick={saveBonusPrediction}
                className="btn bg-yellow-600 hover:bg-yellow-500 p-3 font-bold"
              >
                Zapisz Bonusowe Predykcje
              </button>
            </div>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-6">
          Mecze ⚽
        </h1>

        <div className="space-y-6">
          {upcomingMatches.length === 0 && (
            <div className="text-zinc-400 text-center">
              Brak nadchodzących meczów do obstawienia.
            </div>
          )}

          {upcomingMatches.map((match, index) => {
            // Typ na ten mecz w każdej lidze docelowej
            const preds = targetLeagues.map((l) => ({
              league: l,
              pred: predictions.find((p) => p.match_id === match.id && p.league_id === l.id) ?? null,
            }))
            const anyPred = preds.find((p) => p.pred)?.pred ?? null
            // Ten sam typ we wszystkich ligach -> jedna linijka, inaczej typ z każdej ligi osobno
            const allSame = preds.every(
              (p) => p.pred && formatPrediction(p.pred, match) === formatPrediction(anyPred!, match)
            )

            // Nagłówek nad pierwszym meczem fazy pucharowej
            const isFirstKnockout =
              !match.is_it_group_phase &&
              (index === 0 || upcomingMatches[index - 1].is_it_group_phase)

            return (
              <Fragment key={match.id}>
                {isFirstKnockout && (
                  <div className="flex items-center gap-4 text-yellow-500 font-bold uppercase tracking-wide">
                    <div className="flex-1 border-t border-zinc-700" />
                    Faza pucharowa
                    <div className="flex-1 border-t border-zinc-700" />
                  </div>
                )}
                <div className="card shadow-md text-center">

                  <div className="text-2xl font-bold">
                    {match.home_team} vs {match.away_team}
                  </div>

                  <div className="text-sm text-zinc-400 mt-2">
                    {new Date(match.match_time).toLocaleString()}
                  </div>

                  {/* TWOJE TYPOWANIE */}
                  {anyPred && (
                    allSame ? (
                      <div className="text-blue-500 mt-2">
                        Twój typ: {formatPrediction(anyPred, match)}
                      </div>
                    ) : (
                      <div className="text-blue-500 mt-2 text-sm space-y-0.5">
                        {preds.map(({ league, pred }) => (
                          <div key={league.id}>
                            {league.name}:{" "}
                            {pred ? (
                              formatPrediction(pred, match)
                            ) : (
                              <span className="text-zinc-500">brak typu</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  )}

                  {/* TYPOWANIE - mecz na tej liście zawsze jest jeszcze nierozpoczęty */}
                  <div className="flex gap-2 mt-4 justify-center items-center w-full">
                    <input
                      type="number"
                      placeholder="Obstaw"
                      className="field w-20 text-center"
                      id={`home-${match.id}`}
                      onChange={(e) => updateScoreInput(match.id, "home", e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder="Obstaw"
                      className="field w-20 text-center"
                      id={`away-${match.id}`}
                      onChange={(e) => updateScoreInput(match.id, "away", e.target.value)}
                    />

                    <button
                      className="btn bg-green-600 hover:bg-green-500"
                      onClick={() => savePrediction(match)}
                    >
                      {targetLeagues.length > 1 ? "Zapisz wszędzie" : "Zapisz"}
                    </button>
                  </div>

                  {/* FAZA PUCHAROWA - przy remisie wybór zwycięzcy dogrywki/karnych */}
                  {!match.is_it_group_phase && isDrawEntered(match.id) && (
                    <div className="mt-4">
                      <div className="text-sm text-zinc-300 mb-2">
                        Kto wygra w dogrywce lub karnych? (+1 pkt)
                      </div>
                      <div className="flex gap-2 justify-center">
                        {(["home", "away"] as const).map((side) => (
                          <button
                            key={side}
                            onClick={() => setWinnerPicks((prev) => ({ ...prev, [match.id]: side }))}
                            className={`btn ${
                              winnerPicks[match.id] === side
                                ? "bg-yellow-600"
                                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            }`}
                          >
                            {side === "home" ? match.home_team : match.away_team}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
