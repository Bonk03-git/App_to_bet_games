"use client"

import Navbar from "@/components/Navbar"
import { useRequireAuth } from "@/lib/useRequireAuth"

export default function LeaderboardPage() {
  useRequireAuth()
  return (
    <div>
      <Navbar />
      <div className="p-10">
          <h1 className="text-3xl font-bold mb-6">
            Upcoming Leaderboard
          </h1>
      </div>
    </div>
  )
}