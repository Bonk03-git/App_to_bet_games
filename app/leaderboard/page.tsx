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

      <div className="p-10">
        <h1 className="text-3xl font-bold mb-6">🏆 Leaderboard</h1>

        <LeaderboardGrid />
      </div>
    </div>
  )
}