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
  status: string | null
  is_it_group_phase: boolean
  knockout_winner: "home" | "away" | null
}

type Prediction = {
  user_id: string
  user_email: string
  match_id: string
  predicted_home_score: number
  predicted_away_score: number
  who_wins: "home" | "away" | null
  points: number
}

type Cell = {
  prediction: string
  points: number
  // punkt za trafionego zwycięzcę dogrywki/karnych (faza pucharowa, remis po 90 minutach)
  knockoutPoint: boolean
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

// Statusy z football-data.org oznaczające trwający mecz
const LIVE_STATUSES = ["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"]

const bonusPointsColorClass = (points: number) => {
  if (points === 5) {
    return "badge-hit"
  }
  return "badge-miss"
}

type Member = {
  user_id: string
  user_email: string
}

export default function LeaderboardGrid({ leagueId }: { leagueId: string }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [bonusPredictions, setBonusPredictions] = useState<BonusPrediction[]>([])
  const [bonusResult, setBonusResult] = useState<BonusResult>({ winner: null, top_scorer: null })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // Kto już obstawił (bez samego typu) - do kłódek przed startem meczu/turnieju.
  // Cudze typy RLS pokazuje dopiero po starcie, więc bierzemy to z tabeli bet_markers (match_id null = bonus).
  const [placedBets, setPlacedBets] = useState<Set<string>>(new Set())
  const [placedBonus, setPlacedBonus] = useState<Set<string>>(new Set())

  const matchRefs = useRef<Record<string, HTMLTableCellElement | null>>({})

  const isMatchStarted = (matchTime: string) => {
    return new Date() >= new Date(matchTime)
  }

  const isMatchLive = (status: string | null) => {
    return status !== null && LIVE_STATUSES.includes(status)
  }

  const isTournamentStarted = () => {
    if (matches.length === 0) return false
    return new Date() >= new Date(matches[0].match_time)
  }

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }

      const { data: matchesData } = await supabase
        .from("matches")
        .select("*")
        .order("match_time", { ascending: true })

      // Tylko wybrana liga (RLS i tak pokazuje cudze typy dopiero po starcie meczu)
      const { data: predsData } = await supabase
        .from("predictions")
        .select("*")
        .eq("league_id", leagueId)

      const { data: bonusData } = await supabase
        .from("bonus_predictions")
        .select("*")
        .eq("league_id", leagueId)

      const { data: membersData } = await supabase
        .from("league_members")
        .select("user_id, user_email")
        .eq("league_id", leagueId)

      // Wynik bonusowy pobierany z bazy zamiast na sztywno w kodzie
      const { data: bonusResultData } = await supabase
        .from("bonus_results")
        .select("winner, top_scorer")
        .eq("id", 1)
        .single()

      if (cancelled) return

      const { data: markersData } = await supabase
        .from("bet_markers")
        .select("user_id, match_id")
        .eq("league_id", leagueId)

      if (cancelled) return

      const markers = markersData || []
      setPlacedBets(new Set(markers.filter((r) => r.match_id).map((r) => `${r.user_id}:${r.match_id}`)))
      setPlacedBonus(new Set(markers.filter((r) => !r.match_id).map((r) => r.user_id)))
      setBonusResult(bonusResultData || { winner: null, top_scorer: null })
      setBonusPredictions(bonusData || [])
      setMatches(matchesData || [])
      setPredictions(predsData || [])
      setMembers(membersData || [])
    }

    fetchData()

    // Wyniki na żywo: po zmianie meczu lub punktów w bazie pobieramy dane od nowa
    // (unikalna nazwa kanału - patrz komentarz w app/leaderboard/page.tsx)
    let refetchTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer)
      refetchTimer = setTimeout(fetchData, 500)
    }

    const channel = supabase
      .channel(`leaderboard-grid-${Date.now()}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions", filter: `league_id=eq.${leagueId}` }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_members", filter: `league_id=eq.${leagueId}` }, scheduleRefetch)
      // nowa kłódka, gdy ktoś z ligi obstawi (sam typ przyjdzie dopiero po starcie meczu)
      .on("postgres_changes", { event: "*", schema: "public", table: "bet_markers", filter: `league_id=eq.${leagueId}` }, scheduleRefetch)
      .subscribe()

    return () => {
      cancelled = true
      clearTimeout(refetchTimer)
      supabase.removeChannel(channel)
    }
  }, [leagueId])

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
    // Wiersze = członkowie ligi (także ci, którzy jeszcze nic nie obstawili)
    const usersMap: Record<string, { email: string }> = {}
    members.forEach((m) => {
      usersMap[m.user_id] = { email: m.user_email }
    })
    const grid: Record<string, Record<string, Cell>> = {}

    predictions.forEach((p) => {
      const match = matches.find((m) => m.id === p.match_id)
      if (!match || !usersMap[p.user_id]) return

      const ph = Number(p.predicted_home_score ?? 0)
      const pa = Number(p.predicted_away_score ?? 0)

      const started = isMatchStarted(match.match_time)
      // punkty policzone już triggerem w bazie - tu tylko ukrywamy je przed startem meczu
      const points = started ? p.points : 0
      // ten sam warunek co w triggerze w bazie (recompute_points_for_match)
      const knockoutPoint =
        started && !match.is_it_group_phase && p.who_wins !== null && p.who_wins === match.knockout_winner

      if (!grid[p.user_id]) {
        grid[p.user_id] = {}
      }

      grid[p.user_id][p.match_id] = {
        prediction: `${ph}-${pa}`,
        points,
        knockoutPoint,
      }
    })

    const sortedUserIds = Object.keys(usersMap).sort((a, b) => {
      if (a === currentUserId) return -1
      if (b === currentUserId) return 1
      return 0
    })

    return { usersMap, grid, sortedUserIds }
  }, [matches, predictions, members, currentUserId])

  const { usersMap, grid, sortedUserIds } = gridData

  return (
    <div className="w-full overflow-x-auto bg-zinc-950">
      <table className="min-w-max border-collapse text-xs w-full">
        <thead>
          <tr className="bg-zinc-950 sticky top-0 z-50">
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
                  <span className="text-zinc-400 text-[10px]">vs</span>
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
                  <div className="flex flex-col items-center leading-tight">
                    <span>{m.home_score} - {m.away_score}</span>
                    {isMatchLive(m.status) && (
                      <span className="text-[10px] text-red-500 font-semibold animate-pulse">● NA ŻYWO</span>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-500 font-normal">-</span>
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
                  {usersMap[userId].email?.split("@")[0]}
                </td>

                {/* WINNER */}
                <td className="text-center px-3 py-2 border-l border-zinc-800 min-w-[110px]">
                  {(() => {
                    const bonus = bonusPredictions.find((b) => b.user_id === userId)
                    const winnerCorrect = bonus?.predicted_winner === bonusResult.winner
                    const points = winnerCorrect ? 5 : 0

                    if (!isTournamentStarted()) {
                      return <div className="text-zinc-400">{placedBonus.has(userId) ? "🔒" : "-"}</div>
                    }

                    return bonus?.predicted_winner ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="font-bold text-zinc-200 text-sm tracking-wider">
                          {bonus.predicted_winner}
                        </div>
                        <span className={`badge ${bonusPointsColorClass(points)}`}>
                          {points} pkt
                        </span>
                      </div>
                    ) : (
                      <div className="text-zinc-400">-</div>
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
                      return <div className="text-zinc-400">{placedBonus.has(userId) ? "🔒" : "-"}</div>
                    }

                    return bonus?.predicted_top_scorer ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="font-bold text-zinc-200 text-sm tracking-wider">
                          {bonus.predicted_top_scorer}
                        </div>
                        <span className={`badge ${bonusPointsColorClass(points)}`}>
                          {points} pkt
                        </span>
                      </div>
                    ) : (
                      <div className="text-zinc-400">-</div>
                    )
                  })()}
                </td>

                {/* MATCHES */}
                {matches.map((m) => {
                  const cell = grid[userId]?.[m.id]
                  // punkty za sam wynik - punkt za dogrywkę/karne jest w osobnym boxie obok
                  const matchPoints = cell ? (cell.knockoutPoint ? cell.points - 1 : cell.points) : 0

                  let pointsColorClass = "badge-miss"
                  if (cell && isMatchStarted(m.match_time)) {
                    if (matchPoints === 3) {
                      pointsColorClass = "badge-hit"
                    } else if (matchPoints === 1) {
                      pointsColorClass = "badge-outcome"
                    }
                  }

                  return (
                    <td key={m.id} className="text-center px-3 py-2 border-l border-zinc-800 min-w-[110px]">
                      {!isMatchStarted(m.match_time) ? (
                        // przed startem: kłódka = gracz już obstawił (typ ukryty)
                        <div className="text-zinc-400">
                          {cell || placedBets.has(`${userId}:${m.id}`) ? "🔒" : "-"}
                        </div>
                      ) : cell ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="font-bold text-zinc-200 text-sm tracking-wider">
                              {cell.prediction}
                            </div>
                            {/* box +1 wystaje w prawo, więc główne punkty zostają na środku */}
                            <div className="relative inline-flex">
                              <span className={`badge ${pointsColorClass}`}>
                                {matchPoints} pkt
                              </span>
                              {cell.knockoutPoint && (
                                <span className="badge badge-hit absolute left-full top-0 ml-1">
                                  +1
                                </span>
                              )}
                            </div>
                          </div>
                      ) : (
                        <div className="text-zinc-400">-</div>
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