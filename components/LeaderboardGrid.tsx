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

type BonusPrediction = {
  user_id: string
  predicted_winner: string
  predicted_top_scorer: string
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

const ACTUAL_WINNER = "" // tu po zakończeniu turnieju wpisujemy zwycięzcę, żeby przyznać punkty bonusowe za typowanie zwycięzcy
const ACTUAL_TOP_SCORER = "" // tu po zakończeniu turnieju wpisujemy najlepšego strzelca, żeby przyznać punkty bonusowe za typowanie najlepšego strzelca


export default function LeaderboardGrid() {
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [bonusPredictions, setBonusPredictions] = useState<BonusPrediction[]>([])
  const isMatchStarted = (matchTime: string) => {
    return new Date() >= new Date(matchTime)
  }
  const isTournamentStarted = () => {
    if (matches.length === 0) return false

    return new Date() >= new Date(matches[0].match_time)
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

      const { data: bonusData } = await supabase
        .from("bonus_predictions")
        .select("*")

      setBonusPredictions(bonusData || [])
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
      const points =
        started &&
        match.home_score != null &&
        match.away_score != null
          ? getPoints(
              Number(p.predicted_home_score ?? 0),
              Number(p.predicted_away_score ?? 0),
              match.home_score,
              match.away_score
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
      
    const bonusPoints: Record<string, number> = {}
    bonusPredictions.forEach((b) => {
      let points = 0

      if (
        b.predicted_winner === ACTUAL_WINNER
      ) {
        points += 5
      }

      if (
        b.predicted_top_scorer === ACTUAL_TOP_SCORER
      ) {
        points += 5
      }

      bonusPoints[b.user_id] = points
    })

    // TOTALS
    Object.keys(usersMap).forEach((userId) => {
      totals[userId] = Object.values(
        grid[userId] || {}
      ).reduce((sum, cell) => sum + cell.points, 0) + (bonusPoints[userId] || 0)
    })

    return { usersMap, grid, totals }
  }, [matches, predictions])

  const { usersMap, grid, totals } = gridData

  const getUserColumnWidth = (users: Record<string, { email: string }>) => {
    const names = Object.values(users).map(u =>
      (u.email?.split("@")[0] || "")
    )

    const longest = Math.max(...names.map(n => n.length))

    // ~10px per znak (prosty heuristic)
    return Math.min(Math.max(longest * 10 + 40, 120), 300)
  }

  const userWidth = getUserColumnWidth(usersMap)

  const gridTemplate =
    `${userWidth}px repeat(` +
    matches.length +
    ", 110px) 120px 120px 90px"

  return (
    <div className="p-4 overflow-x-auto">
      <div className="overflow-x-auto relative">
      <div className="min-w-max">
      {/* HEADER */}
      <div
      className="grid font-bold border-b sticky top-0 z-10 items-center text-center justify-center"
      style={{ gridTemplateColumns: gridTemplate }}
      >
        <div className="sticky left-0 bg-zinc-950 text-white px-4 flex items-center justify-center whitespace-nowrap h-full">
          Gracz
        </div>

        {matches.map((m) => (
          <div
            key={m.id}
            className="text-center items-center justify-center text-xs px-2 border-l border-white h-full"
          >
            <div className="flex flex-col items-center justify-center leading-tight">
              <span className="font-bold">{m.home_team}</span>
              <span className="text-gray-400 text-[10px]">vs</span>
              <span className="font-bold">{m.away_team}</span>
            </div>
          </div>
        ))}

        <div className="text-center text-xs font-bold h-full border-l border-white">
          Winner
        </div>

        <div className="text-center text-xs font-bold h-full border-l border-white border-r">
          Top Scorer
        </div>

        <div className="sticky right-0 bg-zinc-950 text-white px-3 flex items-center justify-center h-full">
          SUM
        </div>
      </div>

      {/* ROWS */}
      <div>
        {Object.keys(usersMap).map((userId) => (
          <div
            key = {userId}
            className="grid border-b py-2 items-stretch justify-center text-center"
            style={{ gridTemplateColumns: gridTemplate }}
          >

            {/* USER */}
            <div className="sticky left-0 bg-zinc-950 text-white px-3 flex items-stretch justify-center text-center shadow-md">
              {usersMap[userId].email?.split("@")[0]}
            </div>

            {/* CELLS */}
            {matches.map((m) => {
              const cell = grid[userId]?.[m.id]

              return (
                <div
                  key={m.id}
                  className="flex flex-col items-center justify-center text-xs h-full border-l border-white"
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

            {(() => {
              const bonus = bonusPredictions.find(
                (b) => b.user_id === userId
              )

              const winnerCorrect =
                bonus?.predicted_winner === ACTUAL_WINNER

              const scorerCorrect =
                bonus?.predicted_top_scorer === ACTUAL_TOP_SCORER

              return (
                <>
                  <div className="flex flex-col items-center justify-center text-xs h-full border-l border-white">
                    {isTournamentStarted() ? (
                      <>
                        <div>{bonus?.predicted_winner || "-"}</div>
                        <div className="font-bold">
                          {winnerCorrect ? 5 : 0}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 text-lg">
                        🔒
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center text-xs h-full border-l border-r h-full border-white">
                    {isTournamentStarted() ? (
                      <>
                        <div>{bonus?.predicted_top_scorer || "-"}</div>
                        <div className="font-bold">
                          {scorerCorrect ? 5 : 0}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 text-lg">
                        🔒
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

            {/* TOTAL */}
            <div className="w-20 sticky right-0 bg-zinc-950 z-30 shadow-md">
              {totals[userId] || 0}
            </div>

          </div>
        ))}
      </div>
      </div>
      </div>
    </div>
  )
}