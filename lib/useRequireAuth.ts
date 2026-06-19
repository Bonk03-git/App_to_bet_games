"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export function useRequireAuth() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser()

      // Jeśli serwer zwróci błąd lub użytkownik nie istnieje w bazie (został usunięty):
      if (error || !data.user) {
        // Kluczowy krok: Czyścimy nieaktywną sesję w Local Storage przeglądarki
        await supabase.auth.signOut()
        
        // Używamy replace, aby użytkownik nie mógł "wrócić" przyciskiem wstecz do pętli
        router.replace("/login")
        return
      }

      setLoading(false)
    }

    checkUser()
  }, [router])

  return { loading }
}