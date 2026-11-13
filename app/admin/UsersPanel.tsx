"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@/lib/useUser"

interface AdminUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  is_admin: boolean
  leagues: { id: string; name: string }[]
}

const nick = (email: string) => email?.split("@")[0] || email

// Lista kont dla admina: usuwanie z lig i usuwanie kont.
// Dane i uprawnienia pilnują funkcje admin_* w bazie (sprawdzają is_admin()).
export default function UsersPanel() {
  const { user } = useUser()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState("")
  const [busy, setBusy] = useState(false)
  // Komunikat przy koncie, którego dotyczy ("list" = błąd pobierania listy)
  const [message, setMessage] = useState<{ text: string; error: boolean; place: string } | null>(null)

  const fetchUsers = async () => {
    const { data, error } = await supabase.rpc("admin_list_users")
    if (error) setMessage({ text: error.message, error: true, place: "list" })
    setUsers((data as AdminUser[]) || [])
    setLoaded(true)
  }

  useEffect(() => {
    let cancelled = false
    supabase.rpc("admin_list_users").then(({ data, error }) => {
      if (cancelled) return
      if (error) setMessage({ text: error.message, error: true, place: "list" })
      setUsers((data as AdminUser[]) || [])
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const removeFromLeague = async (u: AdminUser, league: { id: string; name: string }) => {
    if (!confirm(`Usunąć gracza „${nick(u.email)}” z ligi „${league.name}”? Jego typy w tej lidze zostaną usunięte.`)) return
    setBusy(true)
    const { error } = await supabase.rpc("admin_remove_from_league", {
      p_user_id: u.id,
      p_league_id: league.id,
    })
    if (error) {
      setMessage({ text: error.message, error: true, place: u.id })
    } else {
      await fetchUsers()
      setMessage({ text: `Usunięto z ligi „${league.name}”.`, error: false, place: u.id })
    }
    setBusy(false)
  }

  const deleteUser = async (u: AdminUser) => {
    if (!confirm(`Usunąć konto „${nick(u.email)}”? Znikną wszystkie jego typy i członkostwa w ligach. Tego nie da się cofnąć.`)) return
    setBusy(true)
    const { error } = await supabase.rpc("admin_delete_user", { p_user_id: u.id })
    if (error) {
      setMessage({ text: error.message, error: true, place: u.id })
    } else {
      await fetchUsers()
      setMessage({ text: `Usunięto konto „${nick(u.email)}”.`, error: false, place: "list" })
    }
    setBusy(false)
  }

  const messageAt = (place: string) =>
    message?.place === place ? (
      <p className={`text-sm mt-2 ${message.error ? "text-red-400" : "text-green-400"}`}>{message.text}</p>
    ) : null

  const query = filter.trim().toLowerCase()
  const visible = users.filter(
    (u) => !query || nick(u.email).toLowerCase().includes(query) || u.leagues.some((l) => l.name.toLowerCase().includes(query))
  )

  return (
    <div className="space-y-4">
      <p className="text-zinc-400 text-sm">
        Usunięcie z ligi kasuje typy gracza w tej lidze. Usunięcie konta kasuje wszystkie jego typy i
        członkostwa. Kont adminów nie można tu usunąć.
      </p>

      <input
        placeholder="Szukaj gracza lub ligi"
        className="field w-full"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {messageAt("list")}

      {loaded && visible.length === 0 && (
        <div className="text-zinc-400 text-center">Brak kont do wyświetlenia.</div>
      )}

      {visible.map((u) => {
        const isMe = u.id === user?.id
        return (
          <div key={u.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-bold text-lg flex items-center gap-2">
                  {nick(u.email)}
                  {u.is_admin && (
                    <span className="badge text-yellow-500 bg-yellow-950/50 border border-yellow-500/20 text-xs">
                      admin
                    </span>
                  )}
                  {isMe && <span className="text-xs text-zinc-500">(Ty)</span>}
                </div>
                <div className="text-sm text-zinc-400">
                  Założone {new Date(u.created_at).toLocaleDateString()}
                  {" · "}
                  {u.last_sign_in_at
                    ? `ostatnie logowanie ${new Date(u.last_sign_in_at).toLocaleString()}`
                    : "nigdy nie logował się"}
                </div>
              </div>

              {!u.is_admin && !isMe && (
                <button
                  className="btn bg-red-700 hover:bg-red-600"
                  disabled={busy}
                  onClick={() => deleteUser(u)}
                >
                  Usuń konto
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {u.leagues.length === 0 && <span className="text-sm text-zinc-500">Nie należy do żadnej ligi.</span>}
              {u.leagues.map((l) => (
                <span key={l.id} className="flex items-center gap-2 bg-zinc-800 rounded-lg pl-3 pr-1 py-1 text-sm">
                  {l.name}
                  <button
                    className="text-zinc-400 hover:text-red-400 px-2 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => removeFromLeague(u, l)}
                    title={`Usuń z ligi „${l.name}”`}
                    aria-label={`Usuń ${nick(u.email)} z ligi ${l.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            {messageAt(u.id)}
          </div>
        )
      })}
    </div>
  )
}
