"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/useRequireAuth"
import Navbar from "@/components/Navbar"
import LeaderboardGrid from "@/components/LeaderboardGrid"
import LeagueSelect, { NoLeagues } from "@/components/LeagueSelect"
import { useLeagues } from "@/lib/useLeagues"

interface Row {
  user_id: string
  email: string
  points: number
  exactHits: number
  rank: number
}

export default function LeaderboardPage() {
  const { loading } = useRequireAuth()
  const { leagues, loading: leaguesLoading, selectedLeague, selectLeague } = useLeagues()
  const leagueId = selectedLeague?.id ?? null
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
    if (loading || !leagueId) return

    let cancelled = false

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }

      // Punkty za typy liczą triggery w bazie, a widok league_standings sumuje je w obrębie ligi
      const { data: standings } = await supabase
        .from("league_standings")
        .select("user_id, user_email, total_points, exact_hits")
        .eq("league_id", leagueId)

      if (cancelled) return

      const sorted = (standings || [])
        .map((pl) => ({
          user_id: pl.user_id,
          email: pl.user_email,
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

    // Ranking na żywo: punkty typów zmieniają się po każdej aktualizacji wyniku
    // Unikalna nazwa kanału: supabase.channel() zwraca istniejący kanał o tej samej nazwie,
    // a removeChannel z poprzedniego montowania (np. StrictMode) jeszcze go zamyka
    let refetchTimer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(`leaderboard-ranking-${Date.now()}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions", filter: `league_id=eq.${leagueId}` }, () => {
        clearTimeout(refetchTimer)
        refetchTimer = setTimeout(fetchData, 500)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${leagueId}` }, () => {
        clearTimeout(refetchTimer)
        refetchTimer = setTimeout(fetchData, 500)
      })
      .subscribe()

    return () => {
      cancelled = true
      clearTimeout(refetchTimer)
      supabase.removeChannel(channel)
    }
  }, [loading, leagueId])

  if (loading) {
    return <div className="p-10">Loading...</div>
  }

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

      <div className="p-10 space-y-10">
        <LeagueSelect leagues={leagues} selectedLeague={selectedLeague} onSelect={selectLeague} />

        <div className="card">
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
                    <span className="text-zinc-400 w-6">{user.rank}.</span>
                    <span className="font-medium">
                      {nickname(user.email)}
                    </span>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className="font-bold">{user.points} pkt</div>
                    <div className={isCurrentUser ? "text-xs text-zinc-200" : "text-xs text-zinc-400"}>
                      {user.exactHits} 🎯
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {leagueId && <LeaderboardGrid key={leagueId} leagueId={leagueId} />}
      </div>
    </div>
  )
}