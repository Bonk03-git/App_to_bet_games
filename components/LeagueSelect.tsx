"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { League } from "@/lib/useLeagues"

// Wybór ligi na stronach Mecze/Tabela/Przebieg.
// allLeagues: zamiast wyboru pokazuje zablokowane "Wszystkie ligi" (Mecze z włączonym "obstaw wszędzie to samo").
// children: dodatkowe kontrolki w tym samym wierszu (np. przełącznik na stronie Mecze).
// Przy mniej niż dwóch ligach nic nie renderuje.
export default function LeagueSelect({
  leagues,
  selectedLeague,
  onSelect,
  allLeagues = false,
  children,
}: {
  leagues: League[]
  selectedLeague: League | null
  onSelect: (id: string) => void
  allLeagues?: boolean
  children?: ReactNode
}) {
  // Przy jednej lidze nie ma czego wybierać - nie pokazujemy wyboru ani dodatkowych kontrolek
  if (leagues.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <span className="text-zinc-400">Liga:</span>
        <select
          className="field"
          value={allLeagues ? "all" : selectedLeague?.id ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          disabled={allLeagues}
        >
          {allLeagues ? (
            <option value="all">Wszystkie ligi</option>
          ) : (
            leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))
          )}
        </select>
      </div>
      {children}
    </div>
  )
}

// Komunikat, gdy użytkownik nie należy jeszcze do żadnej ligi
export function NoLeagues() {
  return (
    <div className="card text-center space-y-3">
      <p className="text-zinc-300">Nie należysz jeszcze do żadnej ligi.</p>
      <Link href="/leagues" className="btn bg-blue-600 hover:bg-blue-500 inline-block">
        Dołącz do ligi
      </Link>
    </div>
  )
}
