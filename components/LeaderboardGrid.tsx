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

type BonusPrediction = {
  user_id: string
  predicted_winner: string
  predicted_top_scorer: string
}

const ACTUAL_WINNER = ""
const ACTUAL_TOP_SCORER = ""

const getPoints = (ph: number, pa: number, ah: number, aa: number) => {
  if (ah == null || aa == null) return 0

  if (ph === ah && pa === aa) return 3

  const pred = ph > pa ? "H" : ph < pa ? "A" : "D"
  const actual = ah > aa ? "H" : ah < aa ? "A" : "D"

  return pred === actual ? 1 : 0
}

export default function LeaderboardGrid() {
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [bonusPredictions, setBonusPredictions] = useState<BonusPrediction[]>([])

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

      setMatches(matchesData || [])
      setPredictions(predsData || [])
      setBonusPredictions(bonusData || [])
    }

    fetchData()
  }, [])

  const { users, rows, totals } = useMemo(() => {
    const usersMap: Record<string, string> = {}
    const rows: Record<string, Record<string, string>> = {}
    const totals: Record<string, number> = {}

    predictions.forEach((p) => {
      usersMap[p.user_id] = p.user_email.split("@")[0]

      if (!rows[p.user_id]) rows[p.user_id] = {}

      const match = matches.find((m) => m.id === p.match_id)
      if (!match) return

      const ph = Number(p.predicted_home_score)
      const pa = Number(p.predicted_away_score)

      const started = new Date() >= new Date(match.match_time)

      const points =
        started && match.home_score != null && match.away_score != null
          ? getPoints(ph, pa, match.home_score, match.away_score)
          : 0

      rows[p.user_id][p.match_id] = `${ph}-${pa} (${points})`
    })

    Object.keys(usersMap).forEach((uid) => {
      totals[uid] = Object.values(rows[uid] || {}).reduce((acc, val) => {
        const match = val.match(/\((\d+)\)/)
        return acc + (match ? Number(match[1]) : 0)
      }, 0)
    })

    return { users: usersMap, rows, totals }
  }, [matches, predictions])

  return (
    <div className="p-4 overflow-x-auto">
      <table className="min-w-max w-full border-collapse text-sm">

        {/* HEADER */}
        <thead>
          <tr className="bg-zinc-900 text-white">
            <th className="sticky left-0 z-20 bg-zinc-900 px-3 py-2 text-left min-w-[140px]">
              User
            </th>

            {matches.map((m) => (
              <th key={m.id} className="px-3 py-2 min-w-[120px] text-center">
                <div className="flex flex-col leading-tight">
                  <span className="font-bold">{m.home_team}</span>
                  <span className="text-xs text-gray-400">vs</span>
                  <span className="font-bold">{m.away_team}</span>
                </div>
              </th>
            ))}

            <th className="px-3 py-2 min-w-[120px]">Winner</th>
            <th className="px-3 py-2 min-w-[120px]">Top Scorer</th>

            <th className="sticky right-0 z-20 bg-zinc-900 px-3 py-2 min-w-[90px]">
              SUM
            </th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {Object.keys(users).map((uid, i) => (
            <tr
              key={uid}
              className={i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/40"}
            >

              {/* USER */}
              <td className="sticky left-0 z-10 bg-zinc-950 text-white px-3 py-2 font-medium">
                {users[uid]}
              </td>

              {/* MATCHES */}
              {matches.map((m) => (
                <td key={m.id} className="text-center px-3 py-2">
                  {rows[uid]?.[m.id] || "-"}
                </td>
              ))}

              {/* BONUS */}
              <td className="text-center px-3 py-2">-</td>
              <td className="text-center px-3 py-2">-</td>

              {/* SUM */}
              <td className="sticky right-0 z-10 bg-zinc-950 text-white text-center px-3 py-2 font-bold">
                {totals[uid] || 0}
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}