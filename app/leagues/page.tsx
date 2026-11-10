"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/useRequireAuth"
import { useLeagues, type League } from "@/lib/useLeagues"
import { useIsAdmin } from "@/lib/useIsAdmin"
import { copyPredictions } from "@/lib/copyPredictions"
import Navbar from "@/components/Navbar"

export default function LeaguesPage() {
  const { loading } = useRequireAuth()
  // Wybór ligi i przełącznik "obstaw wszędzie to samo" są na stronach Mecze/Tabela/Przebieg -
  // tutaj tylko korzystamy z nich przy dołączaniu (nowa liga staje się wybraną, typy się kopiują)
  const { user, leagues, selectedLeague, selectLeague, sameEverywhere, refresh } = useLeagues()
  const { isAdmin } = useIsAdmin()

  const [allLeagues, setAllLeagues] = useState<League[]>([])
  const [joinPasswords, setJoinPasswords] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [busy, setBusy] = useState(false)
  // Komunikat pokazywany przy miejscu, którego dotyczy: "my" (Moje ligi), "join:<id>" (wiersz ligi), "create"
  const [message, setMessage] = useState<{ text: string; error: boolean; place: string } | null>(null)

  const messageAt = (place: string) =>
    message?.place === place ? (
      <p className={`text-sm mt-2 ${message.error ? "text-red-400" : "text-green-400"}`}>{message.text}</p>
    ) : null

  const fetchAllLeagues = async () => {
    const { data } = await supabase.from("leagues").select("id, name").order("name")
    setAllLeagues(data || [])
  }

  useEffect(() => {
    if (loading) return
    supabase
      .from("leagues")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAllLeagues(data || []))
  }, [loading])

  const myIds = new Set(leagues.map((l) => l.id))
  const otherLeagues = allLeagues.filter((l) => !myIds.has(l.id))

  // Po dołączeniu/założeniu: przy włączonym "obstaw wszędzie to samo" kopiujemy typy z dotychczasowej ligi
  const afterJoin = async (leagueId: string, name: string) => {
    let text = `Jesteś w lidze „${name}”.`
    const source = selectedLeague ?? leagues[0]
    if (user && sameEverywhere && source) {
      const error = await copyPredictions(user, source.id, leagueId)
      text += error
        ? ` Nie udało się skopiować typów: ${error.message}`
        : ` Skopiowano Twoje typy z ligi „${source.name}”.`
    }
    await refresh()
    await fetchAllLeagues()
    selectLeague(leagueId)
    setMessage({ text, error: false, place: "my" })
  }

  const joinLeague = async (league: League) => {
    const password = joinPasswords[league.id] ?? ""
    if (!password) {
      setMessage({ text: "Wpisz hasło ligi.", error: true, place: `join:${league.id}` })
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc("join_league", { p_league_id: league.id, p_password: password })
    if (error) {
      setMessage({ text: error.message, error: true, place: `join:${league.id}` })
    } else {
      setJoinPasswords((prev) => ({ ...prev, [league.id]: "" }))
      await afterJoin(league.id, league.name)
    }
    setBusy(false)
  }

  const createLeague = async () => {
    if (!newName.trim() || !newPassword) {
      setMessage({ text: "Podaj nazwę i hasło ligi.", error: true, place: "create" })
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc("create_league", {
      p_name: newName.trim(),
      p_password: newPassword,
    })
    if (error) {
      setMessage({ text: error.message, error: true, place: "create" })
    } else {
      // Admin nie jest automatycznie członkiem - jeśli chce grać w tej lidze, dołącza hasłem jak inni
      const name = newName.trim()
      setNewName("")
      setNewPassword("")
      await fetchAllLeagues()
      setMessage({ text: `Założono ligę „${name}”. Przekaż graczom jej nazwę i hasło.`, error: false, place: "create" })
    }
    setBusy(false)
  }

  const leaveLeague = async (league: League) => {
    if (!confirm(`Opuścić ligę „${league.name}”? Twoje typy w tej lidze zostaną usunięte.`)) return
    setBusy(true)
    const { error } = await supabase.rpc("leave_league", { p_league_id: league.id })
    if (error) {
      setMessage({ text: error.message, error: true, place: "my" })
    } else {
      await refresh()
      await fetchAllLeagues()
      setMessage({ text: `Opuszczono ligę „${league.name}”.`, error: false, place: "my" })
    }
    setBusy(false)
  }

  if (loading) {
    return <div className="p-10">Loading...</div>
  }

  return (
    <div>
      <Navbar />

      <div className="max-w-3xl mx-auto p-10 space-y-8">
        {/* MOJE LIGI */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Moje ligi</h2>

          {leagues.length === 0 ? (
            <p className="text-zinc-400">Nie należysz jeszcze do żadnej ligi.</p>
          ) : (
            <div className="space-y-2">
              {leagues.map((l) => (
                <div key={l.id} className="flex justify-between items-center bg-zinc-800 rounded-lg px-4 py-2">
                  <span className="font-medium">{l.name}</span>
                  <button
                    className="btn bg-red-700 hover:bg-red-600"
                    disabled={busy}
                    onClick={() => leaveLeague(l)}
                  >
                    Opuść
                  </button>
                </div>
              ))}
            </div>
          )}
          {messageAt("my")}
        </div>

        {/* DOŁĄCZ */}
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Dołącz do ligi</h2>

          {otherLeagues.length === 0 ? (
            <p className="text-zinc-400">Brak innych lig.</p>
          ) : (
            <div className="space-y-2">
              {otherLeagues.map((l) => (
                <div key={l.id} className="bg-zinc-800 rounded-lg px-4 py-2">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <span className="font-medium">{l.name}</span>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Hasło"
                      className="field bg-zinc-700 w-40"
                      value={joinPasswords[l.id] ?? ""}
                      onChange={(e) => setJoinPasswords((prev) => ({ ...prev, [l.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && joinLeague(l)}
                    />
                    <button className="btn bg-green-600 hover:bg-green-500" disabled={busy} onClick={() => joinLeague(l)}>
                      Dołącz
                    </button>
                  </div>
                </div>
                {/* np. "Błędne hasło" - pod okienkiem tej ligi */}
                {messageAt(`join:${l.id}`)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ZAŁÓŻ - tylko admin (pilnuje tego też funkcja create_league w bazie) */}
        {isAdmin && (
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Załóż ligę</h2>
          <div className="flex flex-col gap-3">
            <input
              placeholder="Nazwa ligi"
              className="field p-3"
              maxLength={50}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              type="password"
              placeholder="Hasło (min. 4 znaki) - przekaż je znajomym"
              className="field p-3"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button className="btn bg-blue-600 hover:bg-blue-500 p-3" disabled={busy} onClick={createLeague}>
              Załóż ligę
            </button>
            {messageAt("create")}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
