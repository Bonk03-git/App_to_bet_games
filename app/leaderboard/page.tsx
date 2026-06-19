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
  exactHits: number
}

export default function LeaderboardPage() {
  const { loading } = useRequireAuth()
  const [board, setBoard] = useState<Row[]>([])
  // NOWOŚĆ: Stan przechowujący ID zalogowanego użytkownika
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

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
      // NOWOŚĆ: Pobranie ID zalogowanego użytkownika
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }

      const { data: predictions } = await supabase
        .from("predictions")
        .select("*")

      const { data: matches } = await supabase
        .from("matches")
        .select("*")

      const pointsMap: Record<
        string,
        {
          points: number
          email: string
          exactHits: number
        }
      > = {}

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
            exactHits: 0
          }
        }

        pointsMap[p.user_id].points += pPoints
        if (pPoints === 3) {
          pointsMap[p.user_id].exactHits += 1
        }
      })

      const result = Object.entries(pointsMap).map(([user_id, value]) => ({
        user_id,
        points: value.points,
        email: value.email,
        exactHits: value.exactHits,
      }))

      result.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points
        }
        return b.exactHits - a.exactHits
      })

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
            {board.map((user, index) => {
              const isCurrentUser = user.user_id === currentUserId

              // NOWOŚĆ: Jeśli to zalogowany użytkownik, kafelek zmienia kolor z bg-zinc-800 na bg-zinc-700/80 i dostaje delikatną ramkę
              const cardBgClass = isCurrentUser
                ? "bg-zinc-700/80 border border-zinc-600 shadow-inner"
                : "bg-zinc-800 border border-transparent"

              return (
                <div
                  key={user.user_id}
                  className={`flex justify-between items-center px-4 py-2 rounded-lg transition-colors ${cardBgClass}`}
                >
                  <div className="flex gap-3 items-center">
                    <span className={"text-gray-400 w-6"}>
                      {index + 1}.
                    </span>

                    <span className={`font-medium text-white`}>
                      {user.email.split("@")[0]}
                    </span>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className="font-bold text-white">
                      {user.points} pkt
                    </div>

                    <div className={isCurrentUser ? "text-xs text-zinc-200" : "text-xs text-gray-400"}>
                      {user.exactHits} 🎯
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ⬇️ EXISTING GRID */}
        <LeaderboardGrid />

      </div>
    </div>
  )
}