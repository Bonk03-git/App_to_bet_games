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

return (
 <div className="w-full overflow-x-auto bg-zinc-950">

  <table className="min-w-max border-collapse text-xs w-full">

    {/* HEADER */}
    <thead>
      <tr className="bg-zinc-950 text-white sticky top-0 z-50">

        {/* USER */}
        <th className="sticky left-0 z-50 bg-zinc-950 px-4 py-2 text-center border-r border-zinc-800 shadow-md">
          Gracz
        </th>

        <th className="px-3 py-2 border-l border-zinc-800">
          Zwycięzca
        </th>

        <th className="px-3 py-2 border-l border-zinc-800">
          Król strzelców
        </th>

        {/* MATCHES */}
        {matches.map((m) => (
          <th
            key={m.id}
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

      {/* NOWY WIERSZ: RZECZYWISTE WYNIKI */}
      <tr className="bg-zinc-900 text-yellow-500 border-b border-zinc-800">
        {/* Puste komórki dla kolumn gracza i bonusów, żeby zachować układ */}
        <td className="sticky left-0 z-40 bg-zinc-900 text-center font-semibold px-4 py-1.5 border-r border-zinc-800 shadow-md">
          Wynik
        </td>
        <td className="border-l border-zinc-800"></td>
        <td className="border-l border-zinc-800"></td>

        {/* Mapowanie wyników dla każdego meczu */}
        {matches.map((m) => (
          <td
            key={`score-${m.id}`}
            className="text-center font-bold px-3 py-1.5 border-l border-zinc-800 text-sm"
          >
            {m.home_score !== null && m.away_score !== null ? (
              <span>{m.home_score} - {m.away_score}</span>
            ) : (
              <span className="text-gray-500 font-normal">-</span>
            )}
          </td>
        ))}
      </tr>

    </thead>

    {/* BODY */}
    <tbody>
      {Object.keys(usersMap).map((userId, i) => (
        <tr
          key={userId}
          className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}
        >

          {/* USER */}
          <td className="sticky left-0 z-40 bg-zinc-950 text-white text-center px-4 py-2 font-medium border-r border-zinc-800 shadow-md">
            {usersMap[userId].email?.split("@")[0]}
          </td>

          {/* WINNER */}
          <td className="text-center px-3 py-2 border-l border-zinc-800">
            {(() => {
              const bonus = bonusPredictions.find(
                (b) => b.user_id === userId
              )

              const winnerCorrect =
                bonus?.predicted_winner === ACTUAL_WINNER

              return isTournamentStarted() ? (
                <>
                  <div>{bonus?.predicted_winner || "-"}</div>
                  <div className="font-bold">
                    {winnerCorrect ? 5 : 0}
                  </div>
                </>
              ) : (
                <div className="text-gray-400">🔒</div>
              )
            })()}
          </td>

          {/* TOP SCORER */}
          <td className="text-center px-3 py-2 border-l border-zinc-800">
            {(() => {
              const bonus = bonusPredictions.find(
                (b) => b.user_id === userId
              )

              const scorerCorrect =
                bonus?.predicted_top_scorer === ACTUAL_TOP_SCORER

              return isTournamentStarted() ? (
                <>
                  <div>{bonus?.predicted_top_scorer || "-"}</div>
                  <div className="font-bold">
                    {scorerCorrect ? 5 : 0}
                  </div>
                </>
              ) : (
                <div className="text-gray-400">🔒</div>
              )
            })()}
          </td>

{/* MATCHES */}
          {matches.map((m) => {
            const cell = grid[userId]?.[m.id]

            // Dynamiczne kolorowanie samej czcionki dla punktów
            let pointsColorClass = "text-gray-500 bg-zinc-800" // Domyślnie dla 0 pkt
            if (cell && isMatchStarted(m.match_time)) {
              if (cell.points === 3) {
                pointsColorClass = "text-green-400 bg-green-950/60 font-bold border border-green-500/30" // 3 pkt
              } else if (cell.points === 1) {
                pointsColorClass = "text-yellow-500 bg-yellow-950/50 font-semibold border border-yellow-500/20" // 1 pkt
              }
            }

            return (
              <td
                key={m.id}
                className="text-center px-3 py-2 border-l border-zinc-800 min-w-[110px]"
              >
                {cell ? (
                  isMatchStarted(m.match_time) ? (
                    <div className="flex flex-col items-center justify-center gap-1">
                      {/* Ładne, wyraźne formatowanie typowanego wyniku */}
                      <div className="font-bold text-zinc-200 text-sm tracking-wider">
                        {cell.prediction}
                      </div>
                      
                      {/* Kolorowany indykator punktów */}
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
      ))}
    </tbody>

  </table>

</div>
)
}