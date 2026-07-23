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

export default function LeaderboardPage() {
  const { loading } = useRequireAuth()
  const [board, setBoard] = useState<Row[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const nickname = (email: string) => {
    return email?.split("@")[0]
  }

  // Nadawanie wspólnego miejsca przy remisie (te same punkty i te same celne trafienia)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }

      // Punkty i trafienia są już policzone i zsumowane w bazie (triggery)
      const { data: players } = await supabase
        .from("players")
        .select("id, email, total_points, exact_hits")

      const sorted = (players || [])
        .map((pl) => ({
          user_id: pl.id,
          email: pl.email,
          points: pl.total_points,
          exactHits: pl.exact_hits,
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
        <div className="bg-zinc-900 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">🏆 Ranking</h2>

          <div className="space-y-2">
            {board.map((user) => {
              const isCurrentUser = user.user_id === currentUserId

              const cardBgClass = isCurrentUser
                ? "bg-zinc-700/80 border border-zinc-600 shadow-inner"
                : "bg-zinc-800 border border-transparent"

              return (
                <div
                  key={user.user_id}
                  className={`flex justify-between items-center px-4 py-2 rounded-lg transition-colors ${cardBgClass}`}
                >
                  <div className="flex gap-3 items-center">
                    <span className="text-gray-400 w-6">{user.rank}.</span>
                    <span className="font-medium text-white">
                      {nickname(user.email)}
                    </span>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className="font-bold text-white">{user.points} pkt</div>
                    <div className={isCurrentUser ? "text-xs text-zinc-200" : "text-xs text-gray-400"}>
                      {user.exactHits} 🎯
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <LeaderboardGrid />
      </div>
    </div>
  )
}