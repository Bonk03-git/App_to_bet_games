"use client"

import { Fragment, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/lib/useUser"
import Navbar from "@/components/Navbar"
import { useRequireAuth } from "@/lib/useRequireAuth"
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

export default function MatchesPage() {
    const [matches, setMatches] = useState<Match[]>([])
    const { user } = useUser()
    const [predictions, setPredictions] = useState<any[]>([])
    const [bonusPrediction, setBonusPrediction] = useState<any>(null)
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
    useRequireAuth()


  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // matches
      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("match_time", { ascending: true })

      setMatches(matchesData || [])

      // predictions USERA
      const { data: preds } = await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)

      setPredictions(preds || [])
      // bonus prediction
      const { data: bonus } = await supabase
        .from("bonus_predictions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()

      setBonusPrediction(bonus)
    }

    fetchData()
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

    const userEmail = user?.email

  const { data, error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: user?.id,
        user_email: user?.email,
        match_id: matchId,
        predicted_home_score: Number(home),
        predicted_away_score: Number(away),
        who_wins: whoWins,
      },
      {
        onConflict: "user_id,match_id",
      }
    )

  console.log("DATA:", data)
  console.log("ERROR:", error)

  if (error) {
    alert(error.message)
    return
  }

    const { data: preds } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", user?.id)

    setPredictions(preds || [])
  }

  const saveBonusPrediction = async () => {
    if (isTournamentStarted()) {
      alert("Typowanie bonusowe zamknięte ⛔")
      return
    }
    if (!user?.id) return
    const winner = (
      document.getElementById("winner") as HTMLInputElement
    ).value

    const scorer = (
      document.getElementById("scorer") as HTMLInputElement
    ).value

    if (!winner) return alert("Wybierz zwycięzcę MŚ")
    if (!scorer) return alert("Wpisz króla strzelców")

    const { error } = await supabase
      .from("bonus_predictions")
      .upsert(
        {
          user_id: user.id,
          user_email: user.email,
          predicted_winner: winner,
          predicted_top_scorer: scorer,
        },
        {
          onConflict: "user_id",
        }
      )
      console.log("ERROR BONUS:", error)
      if (!error) {
        const { data: updated } = await supabase
          .from("bonus_predictions")
          .select("*")
          .eq("user_id", user.id)
          .single()

        setBonusPrediction(updated)
      }

  }

    const getPrediction = (matchId: string) => {
    return predictions.find((p) => p.match_id === matchId)
  }

  // Mecze, które się jeszcze nie rozpoczęły - te już wystartowane są całkowicie usuwane z listy
  const upcomingMatches = matches
    .filter((m) => !isMatchStarted(m.match_time))
    .sort(
      (a, b) =>
        new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
    )

return (
  <div>
    <Navbar />
  
  <div className="max-w-3xl mx-auto p-10">

    <div className="bg-zinc-900 rounded-2xl p-6 mb-8 text-white">
      <h2 className="text-2xl font-bold mb-4">
        Bonusy
      </h2>

      {!isTournamentStarted() && bonusPrediction && (
        <div className="mb-4 text-blue-400 text-center">
          Aktualne typy:{" "}
          <span className="font-semibold">
            {bonusPrediction.predicted_winner}
          </span>{" "}
          |{" "}
          <span className="font-semibold">
            {bonusPrediction.predicted_top_scorer}
          </span>
        </div>
      )}

      {isTournamentStarted() ? (
        <div className="text-center text-gray-300 space-y-2">
          <div>
            <p>
              Wytypowany zwycięzca:{" "}
              <span className="font-bold text-white">
                {bonusPrediction?.predicted_winner || "-"}
              </span>
            </p>

            <p>
              Wytypowany król strzelców:{" "}
              <span className="font-bold text-white">
                {bonusPrediction?.predicted_top_scorer || "-"}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          
          <select
            id="winner"
            className="bg-zinc-800 p-3 rounded-lg"
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
            className="bg-zinc-800 p-3 rounded-lg"
            defaultValue={bonusPrediction?.predicted_top_scorer || ""}
          />

          <button
            onClick={saveBonusPrediction}
            className="bg-yellow-600 hover:bg-yellow-500 transition rounded-lg p-3 font-bold"
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
        <div className="text-gray-400 text-center">
          Brak nadchodzących meczów do obstawienia.
        </div>
      )}

      {upcomingMatches.map((match, index) => {
        const pred = predictions.find(
          (p) => p.match_id === match.id
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
          <div className="bg-zinc-900 rounded-2xl p-6 shadow-md text-center">

            <div className="text-2xl font-bold text-white">
              {match.home_team} vs {match.away_team}
            </div>

            <div className="text-sm text-gray-400 mt-2">
              {new Date(match.match_time).toLocaleString()}
            </div>

            {/* TWOJE TYPOWANIE */}
            {pred && (
              <div className="text-blue-500 mt-2">
                Twój typ: {pred.predicted_home_score} - {pred.predicted_away_score}
                {pred.who_wins && (
                  <> (po dogrywce/karnych: {pred.who_wins === "home" ? match.home_team : match.away_team})</>
                )}
              </div>
            )}

            {/* TYPOWANIE - mecz na tej liście zawsze jest jeszcze nierozpoczęty */}
            <div className="flex gap-2 mt-4 justify-center items-center w-full">
              <input
                type="number"
                placeholder="Obstaw"
                className="bg-zinc-800 rounded-lg p-2 w-20 text-white text-center"
                id={`home-${match.id}`}
                onChange={(e) => updateScoreInput(match.id, "home", e.target.value)}
              />

              <input
                type="number"
                placeholder="Obstaw"
                className="bg-zinc-800 rounded-lg p-2 w-20 text-white text-center"
                id={`away-${match.id}`}
                onChange={(e) => updateScoreInput(match.id, "away", e.target.value)}
              />

              <button
                className="bg-green-600 hover:bg-green-500 transition rounded-lg px-4 py-2 text-white font-semibold"
                onClick={() => savePrediction(match)}
              >
                Zapisz
              </button>
            </div>

            {/* FAZA PUCHAROWA - przy remisie wybór zwycięzcy dogrywki/karnych */}
            {!match.is_it_group_phase && isDrawEntered(match.id) && (
              <div className="mt-4">
                <div className="text-sm text-gray-300 mb-2">
                  Kto wygra w dogrywce lub karnych? (+1 pkt)
                </div>
                <div className="flex gap-2 justify-center">
                  {(["home", "away"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setWinnerPicks((prev) => ({ ...prev, [match.id]: side }))}
                      className={`rounded-lg px-4 py-2 font-semibold transition ${
                        winnerPicks[match.id] === side
                          ? "bg-yellow-600 text-white"
                          : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
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
