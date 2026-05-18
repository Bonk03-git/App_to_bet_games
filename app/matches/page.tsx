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

    await supabase.from("predictions").insert({
      user_id: user?.id,
      match_id: matchId,
      predicted_home_score: Number(home),
      predicted_away_score: Number(away),
    })

    alert("Typ zapisany!")

    const { data: preds } = await supabase
      .from("predictions")
      .select("*")
      .eq("user_id", user?.id)

    setPredictions(preds || [])
  }

    const getPrediction = (matchId: string) => {
    return predictions.find((p) => p.match_id === matchId)
  }

return (
  <div>
    <Navbar />
  
  <div className="p-10">
    <h1 className="text-3xl font-bold mb-6">
      Upcoming Matches ⚽
    </h1>

    <div className="space-y-4">
      {matches.map((match) => {
        const pred = predictions.find(
          (p) => p.match_id === match.id
        )

        return (
          <div key={match.id} className="border rounded p-4">

            <div className="text-xl font-semibold">
              {match.home_team} vs {match.away_team}
            </div>

            <div className="text-sm text-gray-500 mt-1">
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
              <div className="flex gap-2 mt-4">
                <input
                  type="number"
                  placeholder="Home"
                  className="border p-2 w-20"
                  id={`home-${match.id}`}
                />

                <input
                  type="number"
                  placeholder="Away"
                  className="border p-2 w-20"
                  id={`away-${match.id}`}
                />

                <button
                  className="bg-green-500 text-white px-4"
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