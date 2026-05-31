"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/useRequireAuth"
import Navbar from "@/components/Navbar"
import LeaderboardGrid from "@/components/LeaderboardGrid"

interface Row {
  user_id: string
  email: string
  points: number
}

export default function LeaderboardPage() {
  const { loading } = useRequireAuth()
  const [board, setBoard] = useState<Row[]>([])
  const nickname = (email: string) => {
  return email?.split("@")[0]
  }
  
  const calculatePoints = (
    predHome: number,
    predAway: number,
    actualHome: number,
    actualAway: number
    ) => {
    if (actualHome == null || actualAway == null) return 0

    // exact score
    if (predHome === actualHome && predAway === actualAway) {
      return 3
    }

    // correct outcome
    const predResult =
      predHome > predAway ? "H"
      : predHome < predAway ? "A"
      : "D"

    const actualResult =
      actualHome > actualAway ? "H"
      : actualHome < actualAway ? "A"
      : "D"

    if (predResult === actualResult) {
      return 1
    }

    return 0
  }
  useEffect(() => {
    if (loading) return

    const fetchData = async () => {
      const { data: predictions } = await supabase
        .from("predictions")
        .select("*")

      const { data: matches } = await supabase
        .from("matches")
        .select("*")

      const pointsMap: Record<
        string,
        { points: number; email: string }
      > = {}

      let points = 0

      predictions?.forEach((p) => {
        const match = matches?.find((m) => m.id === p.match_id)
        if (!match) return

        const pPoints = calculatePoints(
          p.predicted_home_score,
          p.predicted_away_score,
          match.home_score,
          match.away_score
        )

        if (!pointsMap[p.user_id]) {
          pointsMap[p.user_id] = {
            points: 0,
            email: p.user_email || "",
          }
        }

        pointsMap[p.user_id].points += pPoints
      })

      const result = Object.entries(pointsMap).map(([user_id, value]) => ({
        user_id,
        points: value.points,
        email: value.email,
      }))

      result.sort((a, b) => b.points - a.points)

      setBoard(result)
    }

    fetchData()
  }, [loading])

  if (loading) {
    return <div className="p-10">Loading...</div>
  }

return (
  <div>
    <Navbar />

    <div className="p-10 space-y-10">

      {/* 🔝 SIMPLE LEADERBOARD */}
      <div className="bg-zinc-900 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">
          🏆 Ranking
        </h2>

        <div className="space-y-2">
          {board.map((user, index) => (
            <div
              key={user.user_id}
              className="flex justify-between items-center bg-zinc-800 px-4 py-2 rounded-lg"
            >
              <div className="flex gap-3 items-center">
                <span className="text-gray-400 w-6">
                  {index + 1}.
                </span>

                <span className="font-medium">
                  {user.email.split("@")[0]}
                </span>
              </div>

              <div className="font-bold text-white">
                {user.points}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ⬇️ EXISTING GRID */}
      <LeaderboardGrid />

    </div>
  </div>
)
}