"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

type Match = {
  id: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  match_time: string
}

type Prediction = {
  user_id: string
  user_email: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  points: number
}

type Cell = {
  prediction: string
  points: number
}

type BonusPrediction = {
  user_id: string
  predicted_winner: string
  predicted_top_scorer: string
}

type BonusResult = {
  winner: string | null
  top_scorer: string | null
}

const bonusPointsColorClass = (points: number) => {
  if (points === 5) {
    return "text-green-400 bg-green-950/60 font-bold border border-green-500/30"
  }
  return "text-gray-500 bg-zinc-800"
}

export default function LeaderboardGrid() {
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [bonusPredictions, setBonusPredictions] = useState<BonusPrediction[]>([])
  const [bonusResult, setBonusResult] = useState<BonusResult>({ winner: null, top_scorer: null })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const matchRefs = useRef<Record<string, HTMLTableCellElement | null>>({})

  const isMatchStarted = (matchTime: string) => {
    return new Date() >= new Date(matchTime)
  }

  const isTournamentStarted = () => {
    if (matches.length === 0) return false
    return new Date() >= new Date(matches[0].match_time)
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }

      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("match_time", { ascending: true })

      const { data: predsData } = await supabase
        .from("predictions")
        .select("*")

      const { data: bonusData } = await supabase
        .from("bonus_predictions")
        .select("*")

      // Wynik bonusowy pobierany z bazy zamiast na sztywno w kodzie
      const { data: bonusResultData } = await supabase
        .from("bonus_results")
        .select("winner, top_scorer")
        .eq("id", 1)
        .single()

      setBonusResult(bonusResultData || { winner: null, top_scorer: null })
      setBonusPredictions(bonusData || [])
      setMatches(matchesData || [])
      setPredictions(predsData || [])
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (!matches.length) return

    const now = new Date()
    let targetMatch = matches[0]

    matches.forEach((match) => {
      if (new Date(match.match_time) <= now) {
        targetMatch = match
      }
    })

    setTimeout(() => {
      const el = matchRefs.current[targetMatch.id]
      if (!el) return

      const container = el.closest(".overflow-x-auto") as HTMLElement | null
      if (!container) return

      const offset = 120

      container.scrollTo({
        left: el.offsetLeft - offset,
        behavior: "smooth",
      })
    }, 100)
  }, [matches])

  const gridData = useMemo(() => {
    const usersMap: Record<string, { email: string }> = {}
    const grid: Record<string, Record<string, Cell>> = {}

    predictions.forEach((p) => {
      const match = matches.find((m) => m.id === p.match_id)
      if (!match) return

      if (!usersMap[p.user_id]) {
        usersMap[p.user_id] = {
          email: p.user_email,
        }
      }

      const ph = Number(p.predicted_home_score ?? 0)
      const pa = Number(p.predicted_away_score ?? 0)

      const started = isMatchStarted(match.match_time)
      // punkty policzone już triggerem w bazie - tu tylko ukrywamy je przed startem meczu
      const points = started ? p.points : 0

      if (!grid[p.user_id]) {
        grid[p.user_id] = {}
      }

      grid[p.user_id][p.match_id] = {
        prediction: `${ph}-${pa}`,
        points,
      }
    })

    const sortedUserIds = Object.keys(usersMap).sort((a, b) => {
      if (a === currentUserId) return -1
      if (b === currentUserId) return 1
      return 0
    })

    return { usersMap, grid, sortedUserIds }
  }, [matches, predictions, currentUserId])

  const { usersMap, grid, sortedUserIds } = gridData

  return (
    <div className="w-full overflow-x-auto bg-zinc-950">
      <table className="min-w-max border-collapse text-xs w-full">
        <thead>
          <tr className="bg-zinc-950 text-white sticky top-0 z-50">
            <th className="sticky left-0 z-50 bg-zinc-950 px-4 py-2 text-center border-r border-zinc-800 shadow-md">
              Gracz
            </th>
            <th className="px-3 py-2 border-l border-zinc-800">Zwycięzca</th>
            <th className="px-3 py-2 border-l border-zinc-800">Król strzelców</th>

            {matches.map((m) => (
              <th
                key={m.id}
                ref={(el) => {
                  matchRefs.current[m.id] = el
                }}
                className="px-3 py-2 min-w-[110px] border-l border-zinc-800"
              >
                <div className="flex flex-col items-center leading-tight">
                  <span className="font-bold">{m.home_team}</span>
                  <span className="text-gray-400 text-[10px]">vs</span>
                  <span className="font-bold">{m.away_team}</span>
                </div>
              </th>
            ))}
          </tr>

          <tr className="bg-zinc-900 text-yellow-500 border-b border-zinc-800">
            <td className="sticky left-0 z-40 bg-zinc-900 text-center font-semibold px-4 py-1.5 border-r border-zinc-800 shadow-md">
              Wynik
            </td>
            <td className="border-l border-zinc-800"></td>
            <td className="border-l border-zinc-800"></td>

            {matches.map((m) => (
              <td key={`score-${m.id}`} className="text-center font-bold px-3 py-1.5 border-l border-zinc-800 text-sm">
                {m.home_score !== null && m.away_score !== null ? (
                  <span>{m.home_score} - {m.away_score}</span>
                ) : (
                  <span className="text-gray-500 font-normal">-</span>
                )}
              </td>
            ))}
          </tr>
        </thead>

        <tbody>
          {sortedUserIds.map((userId, i) => {
            const isCurrentUser = userId === currentUserId
            const rowBgClass = i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"

            return (
              <tr key={userId} className={rowBgClass}>
                <td className="sticky left-0 z-40 bg-zinc-950 text-center px-4 py-2 font-medium border-r border-zinc-800 shadow-md">
                  <span className="text-white">
                    {usersMap[userId].email?.split("@")[0]}
                  </span>
                </td>

                {/* WINNER */}
                <td className="text-center px-3 py-2 border-l border-zinc-800 min-w-[110px]">
                  {(() => {
                    const bonus = bonusPredictions.find((b) => b.user_id === userId)
                    const winnerCorrect = bonus?.predicted_winner === bonusResult.winner
                    const points = winnerCorrect ? 5 : 0

                    if (!isTournamentStarted()) {
                      return <div className="text-gray-400">🔒</div>
                    }

                    return bonus?.predicted_winner ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="font-bold text-zinc-200 text-sm tracking-wider">
                          {bonus.predicted_winner}
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${bonusPointsColorClass(points)}`}>
                          {points} pkt
                        </span>
                      </div>
                    ) : (
                      <div className="text-gray-400">-</div>
                    )
                  })()}
                </td>

                {/* TOP SCORER */}
                <td className="text-center px-3 py-2 border-l border-zinc-800 min-w-[110px]">
                  {(() => {
                    const bonus = bonusPredictions.find((b) => b.user_id === userId)
                    const scorerCorrect = bonus?.predicted_top_scorer === bonusResult.top_scorer
                    const points = scorerCorrect ? 5 : 0

                    if (!isTournamentStarted()) {
                      return <div className="text-gray-400">🔒</div>
                    }

                    return bonus?.predicted_top_scorer ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="font-bold text-zinc-200 text-sm tracking-wider">
                          {bonus.predicted_top_scorer}
                        </div>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${bonusPointsColorClass(points)}`}>
                          {points} pkt
                        </span>
                      </div>
                    ) : (
                      <div className="text-gray-400">-</div>
                    )
                  })()}
                </td>

                {/* MATCHES */}
                {matches.map((m) => {
                  const cell = grid[userId]?.[m.id]

                  let pointsColorClass = "text-gray-500 bg-zinc-800"
                  if (cell && isMatchStarted(m.match_time)) {
                    if (cell.points === 3) {
                      pointsColorClass = "text-green-400 bg-green-950/60 font-bold border border-green-500/30"
                    } else if (cell.points === 1) {
                      pointsColorClass = "text-yellow-500 bg-yellow-950/50 font-semibold border border-yellow-500/20"
                    }
                  }

                  return (
                    <td key={m.id} className="text-center px-3 py-2 border-l border-zinc-800 min-w-[110px]">
                      {cell ? (
                        isMatchStarted(m.match_time) ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="font-bold text-zinc-200 text-sm tracking-wider">
                              {cell.prediction}
                            </div>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${pointsColorClass}`}>
                              {cell.points} pkt
                            </span>
                          </div>
                        ) : (
                          <div className="text-gray-400">🔒</div>
                        )
                      ) : (
                        <div className="text-gray-400">-</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}