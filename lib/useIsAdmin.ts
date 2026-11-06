"use client"

import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import { useUser } from "./useUser"

// Czy zalogowany użytkownik jest adminem (wiersz w tabeli admins - RLS pokazuje tylko własny).
// To tylko do wyświetlania UI - właściwą blokadę zapisu robią polityki RLS w bazie.
export const useIsAdmin = () => {
  const { user, loading: userLoading } = useUser()
  // Wynik sprawdzenia zapamiętany razem z id użytkownika, którego dotyczy
  const [result, setResult] = useState<{ userId: string; isAdmin: boolean } | null>(null)

  useEffect(() => {
    if (!user) return

    let cancelled = false
    supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setResult({ userId: user.id, isAdmin: !!data })
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const checked = !!user && result?.userId === user.id
  return {
    isAdmin: checked && !!result?.isAdmin,
    loading: userLoading || (!!user && !checked),
  }
}
