"use client"

import Link from "next/link"
import { signOut } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useRequireAuth } from "@/lib/useRequireAuth"

export default function DashboardPage() {
  const router = useRouter()
  useRequireAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }
  const { loading } = useRequireAuth()

  if (loading) {
    return <div className="p-10">Loading...</div>
  }

  return (
    <div className="p-10">

      <h1 className="text-4xl font-bold mb-10">
        World Cup Predictor ⚽
      </h1>

      <button
      onClick={handleSignOut}
      className="mb-6 bg-red-500 text-white px-4 py-2 rounded"
      >
      Logout
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* MATCHES */}
        <Link href="/matches">
          <div className="bg-white rounded-xl shadow p-6 hover:scale-105 transition cursor-pointer">
            <h2 className="text-2xl font-bold mb-2">
              ⚽ Matches
            </h2>

            <p className="text-gray-600">
              Typowanie meczów i podgląd spotkań
            </p>
          </div>
        </Link>

        {/* LEADERBOARD */}
        <Link href="/leaderboard">
          <div className="bg-white rounded-xl shadow p-6 hover:scale-105 transition cursor-pointer">
            <h2 className="text-2xl font-bold mb-2">
              🏆 Leaderboard
            </h2>

            <p className="text-gray-600">
              Ranking graczy i punkty
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}