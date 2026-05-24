"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/lib/useUser"
import Navbar from "@/components/Navbar"
import { useRequireAuth } from "@/lib/useRequireAuth"

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

    const isMatchStarted = (matchTime: string) => {
    return new Date() > new Date(matchTime)
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
    }

    fetchData()
  }, [user])

  const savePrediction = async (matchId: string) => {
    const home = (document.getElementById(`home-${matchId}`) as HTMLInputElement).value
    const away = (document.getElementById(`away-${matchId}`) as HTMLInputElement).value
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

    const getPrediction = (matchId: string) => {
    return predictions.find((p) => p.match_id === matchId)
  }

const sortedMatches = [...matches].sort((a, b) => {
  const aStarted = new Date() >= new Date(a.match_time)
  const bStarted = new Date() >= new Date(b.match_time)

  // NIE rozpoczęte idą wyżej
  return Number(aStarted) - Number(bStarted)
})

return (
  <div>
    <Navbar />
  
  <div className="max-w-3xl mx-auto p-10">
    <h1 className="text-3xl font-bold mb-6">
      Upcoming Matches ⚽
    </h1>

    <div className="space-y-6">
      {sortedMatches.map((match) => {
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

            {/* TYPOWANIE / BLOKADA */}
            {isMatchStarted(match.match_time) ? (
              <div className="text-red-500 mt-3 font-bold">
                Typowanie zamknięte ⛔
              </div>
            ) : (
              <div className="flex gap-2 mt-4 justify-center items-center w-full">
                <input
                  type="number"
                  placeholder="Home"
                  className="bg-zinc-800 rounded-lg p-2 w-20 text-white text-center"
                  id={`home-${match.id}`}
                />

                <input
                  type="number"
                  placeholder="Away"
                  className="bg-zinc-800 rounded-lg p-2 w-20 text-white text-center"
                  id={`away-${match.id}`}
                />

                <button
                  className="bg-green-600 hover:bg-green-500 transition rounded-lg px-4 py-2 text-white font-semibold"
                  onClick={() => savePrediction(match.id)}
                >
                  Save
                </button>
              </div>
            )}

          </div>
        )
      })}
    </div>
  </div>
  </div>
)
}