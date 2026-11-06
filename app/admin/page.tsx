"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Navbar from "@/components/Navbar"
import { useRequireAuth } from "@/lib/useRequireAuth"
import { useIsAdmin } from "@/lib/useIsAdmin"

interface Match {
  id: string
  home_team: string
  away_team: string
  match_time: string
  home_score: number | null
  away_score: number | null
  is_it_group_phase: boolean
  knockout_winner: "home" | "away" | null
  status: string | null
  manual_result: boolean
}

// Duplikat z LeaderboardGrid / sync-results - trzymać spójnie
const LIVE_STATUSES = ["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"]

const isScore = (value: string) => /^\d{1,2}$/.test(value.trim())

function MatchRow({ match }: { match: Match }) {
  const [home, setHome] = useState(match.home_score?.toString() ?? "")
  const [away, setAway] = useState(match.away_score?.toString() ?? "")
  const [winner, setWinner] = useState<"home" | "away" | null>(match.knockout_winner)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // Po zmianie wyniku w bazie (sync-results, inny admin) pola formularza wracają do aktualnych wartości
  // (aktualizacja stanu w trakcie renderu - https://react.dev/learn/you-might-not-need-an-effect)
  const dbKey = `${match.home_score}-${match.away_score}-${match.knockout_winner}`
  const [prevDbKey, setPrevDbKey] = useState(dbKey)
  if (dbKey !== prevDbKey) {
    setPrevDbKey(dbKey)
    setHome(match.home_score?.toString() ?? "")
    setAway(match.away_score?.toString() ?? "")
    setWinner(match.knockout_winner)
  }

  // Zwycięzca dogrywki/karnych tylko w fazie pucharowej przy remisie po 90 minutach
  const needsWinner =
    !match.is_it_group_phase && isScore(home) && isScore(away) && Number(home) === Number(away)

  const isLive = match.status !== null && LIVE_STATUSES.includes(match.status)

  const save = async () => {
    if (!isScore(home) || !isScore(away)) {
      setMessage({ ok: false, text: "Wpisz oba wyniki (liczby całkowite od 0)." })
      return
    }
    if (needsWinner && !winner) {
      setMessage({ ok: false, text: "Wybierz zwycięzcę dogrywki/karnych." })
      return
    }

    setSaving(true)
    setMessage(null)
    const { data, error } = await supabase
      .from("matches")
      .update({
        home_score: Number(home),
        away_score: Number(away),
        knockout_winner: needsWinner ? winner : null,
        manual_result: true,
      })
      .eq("id", match.id)
      .select("id")
    setSaving(false)

    if (error) {
      setMessage({ ok: false, text: error.message })
    } else if (!data?.length) {
      // RLS nie zwraca błędu, tylko nie zmienia żadnego wiersza
      setMessage({ ok: false, text: "Brak uprawnień do zmiany wyniku." })
    } else {
      setMessage({ ok: true, text: "Zapisano - punkty przeliczą się automatycznie." })
    }
  }

  const releaseToSync = async () => {
    setSaving(true)
    setMessage(null)
    const { data, error } = await supabase
      .from("matches")
      .update({ manual_result: false })
      .eq("id", match.id)
      .select("id")
    setSaving(false)

    if (error || !data?.length) {
      setMessage({ ok: false, text: error?.message ?? "Brak uprawnień." })
    } else {
      setMessage({ ok: true, text: "Wynik znów będzie aktualizowany automatycznie." })
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold text-lg">
            {match.home_team} vs {match.away_team}
          </div>
          <div className="text-sm text-zinc-400">
            {new Date(match.match_time).toLocaleString()}
            {!match.is_it_group_phase && " · faza pucharowa"}
          </div>
        </div>

        <div className="flex gap-2 text-xs">
          {isLive && <span className="text-red-500 font-bold">● NA ŻYWO</span>}
          {match.status && !isLive && <span className="text-zinc-500">{match.status}</span>}
          {match.manual_result && (
            <span className="badge text-yellow-500 bg-yellow-950/50 border border-yellow-500/20">
              wpisany ręcznie
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 items-center">
        <input
          type="number"
          min={0}
          className="field w-16 text-center"
          value={home}
          onChange={(e) => setHome(e.target.value)}
          aria-label={`Gole: ${match.home_team}`}
        />
        <span className="text-zinc-500">:</span>
        <input
          type="number"
          min={0}
          className="field w-16 text-center"
          value={away}
          onChange={(e) => setAway(e.target.value)}
          aria-label={`Gole: ${match.away_team}`}
        />

        {needsWinner && (
          <select
            className="field"
            value={winner ?? ""}
            onChange={(e) => setWinner((e.target.value || null) as "home" | "away" | null)}
          >
            <option value="">Zwycięzca dogrywki/karnych</option>
            <option value="home">{match.home_team}</option>
            <option value="away">{match.away_team}</option>
          </select>
        )}

        <button
          className="btn bg-green-600 hover:bg-green-500"
          onClick={save}
          disabled={saving}
        >
          Zapisz wynik
        </button>

        {match.manual_result && (
          <button
            className="btn bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            onClick={releaseToSync}
            disabled={saving}
            title="Automatyczna synchronizacja znów będzie mogła zmieniać wynik tego meczu"
          >
            Oddaj synchronizacji
          </button>
        )}
      </div>

      {message && (
        <div className={`text-sm mt-2 ${message.ok ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  useRequireAuth()
  const router = useRouter()
  const { isAdmin, loading } = useIsAdmin()
  const [matches, setMatches] = useState<Match[]>([])
  const [showUpcoming, setShowUpcoming] = useState(false)

  // Strona tylko dla admina (zapis i tak blokuje RLS)
  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/dashboard")
  }, [loading, isAdmin, router])

  useEffect(() => {
    if (!isAdmin) return

    const fetchMatches = async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, home_team, away_team, match_time, home_score, away_score, is_it_group_phase, knockout_winner, status, manual_result")
        .order("match_time", { ascending: false })
      setMatches((data as Match[]) || [])
    }

    fetchMatches()

    // Na żywo: zmiany z sync-results lub od innego admina
    // (unikalna nazwa kanału - patrz komentarz w app/leaderboard/page.tsx)
    let refetchTimer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(`admin-${Date.now()}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        clearTimeout(refetchTimer)
        refetchTimer = setTimeout(fetchMatches, 500)
      })
      .subscribe()

    return () => {
      clearTimeout(refetchTimer)
      supabase.removeChannel(channel)
    }
  }, [isAdmin])

  if (loading || !isAdmin) return null

  const now = new Date()
  const visible = matches.filter((m) => showUpcoming || new Date(m.match_time) <= now)

  return (
    <div>
      <Navbar />

      <div className="max-w-3xl mx-auto p-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Panel admina</h1>
          <p className="text-zinc-400 text-sm">
            Wpisz wynik po 90 minutach. W fazie pucharowej przy remisie wybierz zwycięzcę
            dogrywki/karnych. Wynik zapisany tutaj nie zostanie nadpisany przez automatyczną
            synchronizację, dopóki nie klikniesz „Oddaj synchronizacji”.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showUpcoming}
            onChange={(e) => setShowUpcoming(e.target.checked)}
          />
          Pokaż także nierozpoczęte mecze
        </label>

        {visible.length === 0 && (
          <div className="text-zinc-400 text-center">Brak meczów do wyświetlenia.</div>
        )}

        {visible.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}
