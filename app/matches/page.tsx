"use client"

import { useEffect, useState } from "react"
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
}

export default function MatchesPage() {
    const [matches, setMatches] = useState<Match[]>([])
    const { user } = useUser()
    const [predictions, setPredictions] = useState<any[]>([])
    const [bonusPrediction, setBonusPrediction] = useState<any>(null)
    const isMatchStarted = (matchTime: string) => {
    return new Date() > new Date(matchTime)
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

  const savePrediction = async (matchId: string) => {
    const home = (document.getElementById(`home-${matchId}`) as HTMLInputElement).value
    const away = (document.getElementById(`away-${matchId}`) as HTMLInputElement).value

    if (home.trim() === "" || away.trim() === "") {
    alert("Proszę uzupełnić oba wyniki przed zapisaniem!")
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

      {upcomingMatches.map((match) => {
        const pred = predictions.find(
          (p) => p.match_id === match.id
        )

        return (
          <div key={match.id} className="bg-zinc-900 rounded-2xl p-6 shadow-md text-center">

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
              </div>
            )}

            {/* TYPOWANIE - mecz na tej liście zawsze jest jeszcze nierozpoczęty */}
            <div className="flex gap-2 mt-4 justify-center items-center w-full">
              <input
                type="number"
                placeholder="Obstaw"
                className="bg-zinc-800 rounded-lg p-2 w-20 text-white text-center"
                id={`home-${match.id}`}
              />

              <input
                type="number"
                placeholder="Obstaw"
                className="bg-zinc-800 rounded-lg p-2 w-20 text-white text-center"
                id={`away-${match.id}`}
              />

              <button
                className="bg-green-600 hover:bg-green-500 transition rounded-lg px-4 py-2 text-white font-semibold"
                onClick={() => savePrediction(match.id)}
              >
                Zapisz
              </button>
            </div>

          </div>
        )
      })}
    </div>
  </div>
  </div>
)
}
