"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "@/lib/auth"
import { useIsAdmin } from "@/lib/useIsAdmin"

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isAdmin } = useIsAdmin()

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
  }

  const linkClass = (path: string) =>
    pathname === path
      ? "text-blue-500 font-bold"
      : "text-zinc-400 hover:text-white transition"

  return (
    <nav className="flex justify-between items-center p-4 mb-6">
      <Link href="/dashboard" className="font-bold text-lg">
        ⚽ World Cup Predictor
      </Link>

      <div className="flex gap-4 items-center">

        <Link href="/dashboard" className={linkClass("/dashboard")}>
          Menu
        </Link>

        <Link href="/matches" className={linkClass("/matches")}>
          Mecze
        </Link>

        <Link href="/leaderboard" className={linkClass("/leaderboard")}>
          Tabela
        </Link>

        <Link href="/progress" className={linkClass("/progress")}>
          Przebieg
        </Link>

        {isAdmin && (
          <Link href="/admin" className={linkClass("/admin")}>
            Admin
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="text-red-500 hover:text-red-400 transition"
        >
          Wyloguj
        </button>

      </div>
    </nav>
  )
}