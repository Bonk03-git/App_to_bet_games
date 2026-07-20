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
  rank: number
}

// Te same wartości powinny być zsynchronizowane z LeaderboardGrid.tsx
const ACTUAL_WINNER = "Hiszpania"
const ACTUAL_TOP_SCORER = "Kylian Mbappe"

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

  // NOWOŚĆ: nadawanie wspólnego miejsca przy remisie (te same punkty i te same celne trafienia)
  // np. 1, 2, 2, 4, 5 zamiast 1, 2, 3, 4, 5
  const assignRanks = (
    sorted: { user_id: string; email: string; points: number; exactHits: number }[]
  ): Row[] => {
    const result: Row[] = []

    sorted.forEach((entry, i) => {
      const prev = result[i - 1]
      const isTie =
        prev !== undefined &&
        entry.points === sorted[i - 1].points &&
        entry.exactHits === sorted[i - 1].exactHits

      const rank = isTie ? prev.rank : i + 1

      result.push({ ...entry, rank })
    })

    return result
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

      const { data: bonusPredictions } = await supabase
        .from("bonus_predictions")
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

      // doliczenie punktów bonusowych (zwycięzca turnieju + król strzelców)
      bonusPredictions?.forEach((b) => {
        if (!pointsMap[b.user_id]) {
          pointsMap[b.user_id] = {
            points: 0,
            email: b.user_email || "",
            exactHits: 0
          }
        }

        if (b.predicted_winner === ACTUAL_WINNER) {
          pointsMap[b.user_id].points += 5
        }
        if (b.predicted_top_scorer === ACTUAL_TOP_SCORER) {
          pointsMap[b.user_id].points += 5
        }
      })

      const sorted = Object.entries(pointsMap)
        .map(([user_id, value]) => ({
          user_id,
          points: value.points,
          email: value.email,
          exactHits: value.exactHits,
        }))
        .sort((a, b) => {
          if (b.points !== a.points) {
            return b.points - a.points
          }
          return b.exactHits - a.exactHits
        })

      setBoard(assignRanks(sorted))
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
            {board.map((user) => {
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
                      {user.rank}.
                    </span>

                    <span className={`font-medium text-white`}>
                      {nickname(user.email)}
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
