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

      <div className="bg-zinc-900 text-white rounded-2xl p-6 mt-6 shadow">

        <h2 className="text-xl font-bold mb-3">
          Jak działa aplikacja?
        </h2>

        <div className="space-y-3 text-sm text-gray-300">

          <p>
            Każdy użytkownik typuje wyniki meczów przed ich rozpoczęciem. W przypadku meczy drabinkowych obstawiamy pierwsze 90 minut, nie uwzględniamy ewentualnej dogrywki!!!
          </p>

          <p>
            Punktacja:
            <br />• 3 pkt – poprawny wynik
            <br />• 1 pkt – poprawny zwycięzca (wygrana/remis/przegrana)
          </p>

          <p>
            Przed pierwszym meczem jest możliwość obstawienia:
            <br />• zwycięzcy turnieju
            <br />• króla strzelców (należy wpisać nazwisko i imię zawodnika, np. "Kylian Mbappe")
            <br />→ po 5 pkt za trafienie
          </p>

          <p>
            Prawidłowo obstawiony wynik, zostaje potwierzony przez informację nad danym meczem "Twój typ:". Jeżeli się nie pojawia, coś poszło nie tak.
            W zakładce mecze należy obstawić wynik przed rozpoczęciem meczu, a w tabeli można śledzić aktualny ranking, punkty innych graczy oraz ich typy (typy widoczne są po rozpoczęciu meczu).
          </p>

          <p>
            Ranking aktualizuje się po wpisaniu przez administratora prawidłowych wyników meczu.
          </p>

          <p className="text-yellow-400 font-medium">
            ⚠️ Użytkownik pojawia się w tabeli dopiero po oddaniu pierwszego typu.
          </p>

          <p>
            Powodzenia i miłej zabawy!
          </p>

        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

        {/* MATCHES */}
        <Link href="/matches">
          <div className="bg-zinc-900 text-white rounded-2xl shadow p-8 h-44 flex flex-col items-center justify-center text-center hover:scale-105 transition cursor-pointer">
            <h2 className="text-2xl font-bold mb-2 text-white">
              ⚽ Mecze
            </h2>

            <p className="text-gray-400">
              Typowanie meczów
            </p>
          </div>
        </Link>

        {/* LEADERBOARD */}
        <Link href="/leaderboard">
          <div className="bg-zinc-900 text-white rounded-2xl shadow p-8 h-44 flex flex-col items-center justify-center text-center hover:scale-105 transition cursor-pointer">
            <h2 className="text-2xl font-bold mb-2 text-white">
              🏆 Tabela
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