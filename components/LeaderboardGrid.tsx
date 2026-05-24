"use client"

import { useEffect, useMemo, useState } from "react"
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
}

type Cell = {
  prediction: string
  points: number
}

const getPoints = (
  ph: number,
  pa: number,
  ah: number,
  aa: number
) => {
  if (ah == null || aa == null) return 0

  if (ph === ah && pa === aa) return 3

  const pred =
    ph > pa ? "H" : ph < pa ? "A" : "D"

  const actual =
    ah > aa ? "H" : ah < aa ? "A" : "D"

  return pred === actual ? 1 : 0
}

export default function LeaderboardGrid() {
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const isMatchStarted = (matchTime: string) => {
    return new Date() >= new Date(matchTime)
  }
  useEffect(() => {
    const fetchData = async () => {
      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("match_time", { ascending: true })

      const { data: predsData } = await supabase
        .from("predictions")
        .select("*")

      setMatches(matchesData || [])
      setPredictions(predsData || [])
    }

    fetchData()
  }, [])

  const gridData = useMemo(() => {
    const usersMap: Record<string, { email: string }> = {}

    const grid: Record<
      string,
      Record<string, Cell>
    > = {}

    const totals: Record<string, number> = {}

    // BUILD GRID
    predictions.forEach((p) => {
      const match = matches.find(
        (m) => m.id === p.match_id
      )
      if (!match) return

      if (!usersMap[p.user_id]) {
        usersMap[p.user_id] = {
          email: p.user_email,
        }
      }

      const ph = Number(p.predicted_home_score ?? 0)
      const pa = Number(p.predicted_away_score ?? 0)

      const started = isMatchStarted(match.match_time)

      const points = started
        ? getPoints(
            Number(p.predicted_home_score ?? 0),
            Number(p.predicted_away_score ?? 0),
            Number(match.home_score ?? 0),
            Number(match.away_score ?? 0)
            )
        : 0

      if (!grid[p.user_id]) {
        grid[p.user_id] = {}
      }

      grid[p.user_id][p.match_id] = {
        prediction: `${ph}-${pa}`,
        points,
      }
    })

    // TOTALS
    Object.keys(usersMap).forEach((userId) => {
      totals[userId] = Object.values(
        grid[userId] || {}
      ).reduce((sum, cell) => sum + cell.points, 0)
    })

    return { usersMap, grid, totals }
  }, [matches, predictions])

  const { usersMap, grid, totals } = gridData

  return (
    <div className="p-4 overflow-x-auto">

      {/* HEADER */}
      <div className="flex font-bold border-b pb-2 bg-white sticky top-0 z-10">
        <div className="w-40 sticky left-0 bg-white z-40">
          User
        </div>

        {matches.map((m) => (
          <div
            key={m.id}
            className="w-28 text-center text-xs px-2"
          >
            <div className="font-semibold">
              {m.home_team} {m.home_score ?? "-"}-{m.away_score ?? "-"} {m.away_team}
            </div>
          </div>
        ))}

        <div className="w-20 sticky right-0 bg-white z-40">
          SUM
        </div>
      </div>

      {/* ROWS */}
      <div>
        {Object.keys(usersMap).map((userId) => (
          <div
            key={userId}
            className="flex border-b py-2"
          >

            {/* USER */}
            <div className="w-40 sticky left-0 bg-white z-30 shadow-md">
              {usersMap[userId].email?.split("@")[0]}
            </div>

            {/* CELLS */}
            {matches.map((m) => {
              const cell = grid[userId]?.[m.id]

              return (
                <div
                  key={m.id}
                  className="w-28 text-center text-xs"
                >
                  {cell ? (
                    isMatchStarted(m.match_time) ? (
                      <>
                        <div>{cell.prediction}</div>
                        <div className="font-bold">
                          {cell.points}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400">
                        🔒
                      </div>
                    )
                  ) : (
                    <div className="text-gray-400">-</div>
                  )}
                </div>
              )
            })}

            {/* TOTAL */}
            <div className="w-20 sticky right-0 bg-white z-30 shadow-md">
              {totals[userId] || 0}
            </div>

          </div>
        ))}
      </div>
    </div>
  )
}