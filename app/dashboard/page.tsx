"use client"

import Link from "next/link"
import Navbar from "@/components/Navbar"
import { useRequireAuth } from "@/lib/useRequireAuth"

export default function DashboardPage() {
  useRequireAuth()

  return (
    <div>

      <Navbar />

    <div className="p-10">



      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

        {/* MATCHES */}
        <Link href="/matches">
          <div className="bg-zinc-900 text-white rounded-2xl shadow p-8 h-44 flex flex-col items-center justify-center text-center hover:scale-105 transition cursor-pointer">
            <h2 className="text-2xl font-bold mb-2 text-white">
              ⚽ Matches
            </h2>

            <p className="text-gray-400">
              Typowanie meczów i podgląd spotkań
            </p>
          </div>
        </Link>

        {/* LEADERBOARD */}
        <Link href="/leaderboard">
          <div className="bg-zinc-900 text-white rounded-2xl shadow p-8 h-44 flex flex-col items-center justify-center text-center hover:scale-105 transition cursor-pointer">
            <h2 className="text-2xl font-bold mb-2 text-white">
              🏆 Leaderboard
            </h2>

            <p className="text-gray-400">
              Ranking graczy i punkty
            </p>
          </div>
        </Link>

      </div>
    </div>
    </div>
  )
}