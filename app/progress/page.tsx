"use client"

import { useEffect, useMemo, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/useRequireAuth"
import Navbar from "@/components/Navbar"

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

type BonusPrediction = {
  user_id: string
  predicted_winner: string
  predicted_top_scorer: string
  points: number
}

const COLORS = [
  "#60a5fa", "#f87171", "#34d399", "#fbbf24",
  "#a78bfa", "#f472b6", "#22d3ee", "#fb923c",
  "#a3e635", "#e879f9",
]

const GRAY = "#52525b"

function SortedTooltip({ active, payload, label, suffix, order = "desc" }: any) {
  if (!active || !payload || !payload.length) return null

  const sorted = [...payload].sort((a: any, b: any) =>
    order === "asc" ? a.value - b.value : b.value - a.value
  )
  const matchLabel = payload[0]?.payload?.matchLabel

  return (
    <div
      style={{
        backgroundColor: "#18181b",
        border: "1px solid #3f3f46",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#fff",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 4, color: "#a1a1aa" }}>
        {label}. {matchLabel}
      </div>
      {sorted.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.dataKey}: {entry.value}{suffix || ""}
        </div>
      ))}
    </div>
  )
}

export default function ProgressPage() {
  const { loading } = useRequireAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [bonusPredictions, setBonusPredictions] = useState<BonusPrediction[]>([])
  const [bonusResultReady, setBonusResultReady] = useState(false)

  const [selectedPointsUser, setSelectedPointsUser] = useState<string | null>(null)
  const [selectedRankUser, setSelectedRankUser] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return

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

      // Wynik bonusowy - jeśli oba pola są wpisane, turniej jest "rozstrzygnięty"
      const { data: bonusResultData } = await supabase
        .from("bonus_results")
        .select("winner, top_scorer")
        .eq("id", 1)
        .single()

      setMatches(matchesData || [])
      setPredictions(predsData || [])
      setBonusPredictions(bonusData || [])
      setBonusResultReady(!!(bonusResultData?.winner && bonusResultData?.top_scorer))
    }

    fetchData()
  }, [loading])

  const { pointsData, rankData, nicknames } = useMemo(() => {
    const usersMap: Record<string, string> = {}
    predictions.forEach((p) => {
      if (!usersMap[p.user_id]) {
        usersMap[p.user_id] = p.user_email?.split("@")[0] || p.user_id
      }
    })
    bonusPredictions.forEach((b) => {
      if (!usersMap[b.user_id]) {
        usersMap[b.user_id] = b.user_id
      }
    })

    const finishedMatches = matches
      .filter((m) => m.home_score != null && m.away_score != null)
      .sort(
        (a, b) =>
          new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
      )

    const cumulative: Record<string, number> = {}
    const cumulativeExactHits: Record<string, number> = {}
    Object.keys(usersMap).forEach((uid) => {
      cumulative[uid] = 0
      cumulativeExactHits[uid] = 0
    })

    const pointsChartData: Record<string, any>[] = []
    const rankChartData: Record<string, any>[] = []

    const buildRankPoint = (
      matchNumber: number,
      label: string,
      pointsMap: Record<string, number>,
      exactHitsMap: Record<string, number>
    ) => {
      const ranked = Object.entries(usersMap)
        .map(([uid, nick]) => ({
          nick,
          points: pointsMap[uid] ?? 0,
          exactHits: exactHitsMap[uid] ?? 0,
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points
          return b.exactHits - a.exactHits
        })

      const rankPoint: Record<string, any> = { matchNumber, matchLabel: label }
      let currentRank = 1
      ranked.forEach((entry, i) => {
        if (
          i > 0 &&
          (entry.points < ranked[i - 1].points ||
            entry.exactHits < ranked[i - 1].exactHits)
        ) {
          currentRank = i + 1
        }
        rankPoint[entry.nick] = currentRank
      })
      return rankPoint
    }

    finishedMatches.forEach((m, idx) => {
      predictions
        .filter((p) => p.match_id === m.id)
        .forEach((p) => {
          // punkty już policzone triggerem w bazie
          cumulative[p.user_id] = (cumulative[p.user_id] || 0) + p.points
          if (p.points === 3) {
            cumulativeExactHits[p.user_id] = (cumulativeExactHits[p.user_id] || 0) + 1
          }
        })

      const label = `${m.home_team} - ${m.away_team}`

      const pointsPoint: Record<string, any> = {
        matchNumber: idx + 1,
        matchLabel: label,
      }
      Object.entries(usersMap).forEach(([uid, nick]) => {
        pointsPoint[nick] = cumulative[uid] ?? 0
      })
      pointsChartData.push(pointsPoint)

      rankChartData.push(
        buildRankPoint(idx + 1, label, cumulative, cumulativeExactHits)
      )
    })

    // Dodatkowy punkt końcowy: bonus za zwycięzcę + króla strzelców
    if (finishedMatches.length > 0 && bonusResultReady) {
      const finalCumulative = { ...cumulative }

      bonusPredictions.forEach((b) => {
        finalCumulative[b.user_id] = (finalCumulative[b.user_id] ?? 0) + (b.points || 0)
      })

      const finalLabel = "Wynik końcowy (+ bonus)"
      const finalMatchNumber = finishedMatches.length + 1

      const finalPointsPoint: Record<string, any> = {
        matchNumber: finalMatchNumber,
        matchLabel: finalLabel,
      }
      Object.entries(usersMap).forEach(([uid, nick]) => {
        finalPointsPoint[nick] = finalCumulative[uid] ?? 0
      })
      pointsChartData.push(finalPointsPoint)

      rankChartData.push(
        buildRankPoint(finalMatchNumber, finalLabel, finalCumulative, cumulativeExactHits)
      )
    }

    const finalCumulativeForSort = { ...cumulative }
    if (bonusResultReady) {
      bonusPredictions.forEach((b) => {
        finalCumulativeForSort[b.user_id] = (finalCumulativeForSort[b.user_id] ?? 0) + (b.points || 0)
      })
    }

    const sortedNicknames = Object.entries(usersMap)
      .map(([uid, nick]) => ({
        nick,
        points: finalCumulativeForSort[uid] ?? 0,
        exactHits: cumulativeExactHits[uid] ?? 0,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return b.exactHits - a.exactHits
      })
      .map((x) => x.nick)

    return {
      pointsData: pointsChartData,
      rankData: rankChartData,
      nicknames: sortedNicknames,
    }
  }, [matches, predictions, bonusPredictions, bonusResultReady])

  if (loading) {
    return <div className="p-10">Loading...</div>
  }

  const handleLegendClick = (
    dataKey: string,
    selected: string | null,
    setSelected: (v: string | null) => void
  ) => {
    setSelected(selected === dataKey ? null : dataKey)
  }

  return (
    <div>
      <Navbar />

      <div className="p-10 space-y-6">
        <div className="bg-zinc-900 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6 text-white">
            Przebieg turnieju — punkty
          </h2>

          {pointsData.length === 0 ? (
            <div className="text-gray-400">
              Brak jeszcze rozegranych meczów z wynikiem.
            </div>
          ) : (
            <div style={{ width: "100%", height: 500 }}>
              <ResponsiveContainer>
                <LineChart data={pointsData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis
                    dataKey="matchNumber"
                    stroke="#a1a1aa"
                    tick={{ fontSize: 11 }}
                    label={{ value: "Mecz nr", position: "insideBottom", offset: -5, fill: "#a1a1aa" }}
                  />
                  <YAxis stroke="#a1a1aa" allowDecimals={false} />
                  <Tooltip content={<SortedTooltip suffix=" pkt" order="desc" />} />
                  <Legend
                    onClick={(e: any) =>
                      handleLegendClick(e.dataKey, selectedPointsUser, setSelectedPointsUser)
                    }
                    formatter={(value: string) => (
                      <span
                        style={{
                          color:
                            selectedPointsUser && selectedPointsUser !== value
                              ? GRAY
                              : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  {nicknames.map((nick, i) => {
                    const isDimmed = selectedPointsUser && selectedPointsUser !== nick
                    return (
                      <Line
                        key={nick}
                        type="monotone"
                        dataKey={nick}
                        stroke={isDimmed ? GRAY : COLORS[i % COLORS.length]}
                        strokeWidth={selectedPointsUser === nick ? 3 : 2}
                        strokeOpacity={isDimmed ? 0.4 : 1}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-zinc-900 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6 text-white">
            Przebieg turnieju — miejsce w tabeli
          </h2>

          {rankData.length === 0 ? (
            <div className="text-gray-400">
              Brak jeszcze rozegranych meczów z wynikiem.
            </div>
          ) : (
            <div style={{ width: "100%", height: 500 }}>
              <ResponsiveContainer>
                <LineChart data={rankData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis
                    dataKey="matchNumber"
                    stroke="#a1a1aa"
                    tick={{ fontSize: 11 }}
                    label={{ value: "Mecz nr", position: "insideBottom", offset: -5, fill: "#a1a1aa" }}
                  />
                  <YAxis
                    stroke="#a1a1aa"
                    allowDecimals={false}
                    reversed
                    domain={[1, nicknames.length]}
                    tickCount={nicknames.length}
                    label={{ value: "Miejsce", angle: -90, position: "insideLeft", fill: "#a1a1aa" }}
                  />
                  <Tooltip content={<SortedTooltip suffix=". miejsce" order="asc" />} />
                  <Legend
                    onClick={(e: any) =>
                      handleLegendClick(e.dataKey, selectedRankUser, setSelectedRankUser)
                    }
                    formatter={(value: string) => (
                      <span
                        style={{
                          color:
                            selectedRankUser && selectedRankUser !== value
                              ? GRAY
                              : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  {nicknames.map((nick, i) => {
                    const isDimmed = selectedRankUser && selectedRankUser !== nick
                    return (
                      <Line
                        key={nick}
                        type="monotone"
                        dataKey={nick}
                        stroke={isDimmed ? GRAY : COLORS[i % COLORS.length]}
                        strokeWidth={selectedRankUser === nick ? 3 : 2}
                        strokeOpacity={isDimmed ? 0.4 : 1}
                        dot={{ r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}