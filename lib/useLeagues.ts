"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "./supabase"
import { useUser } from "./useUser"

export interface League {
  id: string
  name: string
}

const SELECTED_KEY = "selectedLeagueId"
const SAME_EVERYWHERE_KEY = "sameEverywhere"

// localStorage może być niedostępny (tryb prywatny, zablokowane dane) - wtedy po prostu nie pamiętamy wyboru
const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

// Ligi zalogowanego użytkownika + wybrana liga (wspólna dla stron Mecze/Tabela/Przebieg)
// + przełącznik "obstaw wszędzie to samo" (zapamiętywany w przeglądarce)
export const useLeagues = () => {
  const { user } = useUser()
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sameEverywhere, setSameEverywhereState] = useState(true)

  const fetchLeagues = useCallback(async (): Promise<League[]> => {
    if (!user) return []
    const { data } = await supabase
      .from("league_members")
      .select("league_id, leagues(id, name)")
      .eq("user_id", user.id)

    // leagues to relacja many-to-one, ale typy supabase-js mogą ją opisać jako tablicę
    return (data || [])
      .flatMap((row: { leagues: League | League[] | null }) =>
        Array.isArray(row.leagues) ? row.leagues : row.leagues ? [row.leagues] : []
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pl"))
  }, [user])

  const refresh = useCallback(async () => {
    const list = await fetchLeagues()
    setLeagues(list)
  }, [fetchLeagues])

  useEffect(() => {
    if (!user) return

    // Pierwsze pobranie; zapamiętane ustawienia z przeglądarki czytamy dopiero tutaj (nie przy renderze
    // na serwerze), żeby nie było rozjazdu hydratacji
    fetchLeagues().then((list) => {
      setSelectedId(readStorage(SELECTED_KEY))
      setSameEverywhereState(readStorage(SAME_EVERYWHERE_KEY) !== "false")
      setLeagues(list)
      setLoading(false)
    })

    const channel = supabase
      .channel(`my-leagues-${Date.now()}-${Math.random()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_members", filter: `user_id=eq.${user.id}` },
        () => refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchLeagues, refresh])

  const selectLeague = (id: string) => {
    setSelectedId(id)
    writeStorage(SELECTED_KEY, id)
  }

  const setSameEverywhere = (value: boolean) => {
    setSameEverywhereState(value)
    writeStorage(SAME_EVERYWHERE_KEY, String(value))
  }

  // Zapamiętana liga, o ile użytkownik dalej do niej należy; inaczej pierwsza z listy
  const selectedLeague = leagues.find((l) => l.id === selectedId) ?? leagues[0] ?? null

  return {
    user,
    leagues,
    loading,
    selectedLeague,
    selectLeague,
    sameEverywhere,
    setSameEverywhere,
    refresh,
  }
}
