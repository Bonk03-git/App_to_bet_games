"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/lib/useUser"
import { signOut } from "@/lib/auth"

export default function Dashboard() {
  const { user, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) return <div className="p-10">Loading...</div>
  if (!user) return null

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">
        Dashboard
      </h1>

      <p>Zalogowany jako: {user.email}</p>

      <button
        onClick={async () => {
          await signOut()
          router.push("/login")
        }}
        className="bg-red-500 text-white px-4 py-2"
      >
        Logout
      </button>
    </div>
  )
}