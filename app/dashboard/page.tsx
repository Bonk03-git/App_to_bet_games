"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import Navbar from "@/components/Navbar"
import { useRequireAuth } from "@/lib/useRequireAuth"

// Kafelki prowadzą tam, gdzie linki w nagłówku (Navbar)
const TILES = [
  { href: "/matches", title: "⚽ Mecze", text: "Typowanie meczów i bonusów" },
  { href: "/leaderboard", title: "🏆 Tabela", text: "Ranking ligi i typy innych graczy" },
  { href: "/progress", title: "📈 Przebieg", text: "Punkty i miejsce w tabeli mecz po meczu" },
  { href: "/leagues", title: "👥 Ligi", text: "Dołączanie do lig i wychodzenie z nich" },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-zinc-100 mb-1">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

export default function DashboardPage() {
  useRequireAuth()

  return (
    <div>
      <Navbar />

      <div className="p-10">
        <div className="card mt-6 shadow">
          <h2 className="text-xl font-bold mb-4">Jak działa aplikacja?</h2>

          <div className="space-y-5 text-sm text-zinc-300">
            <p className="text-yellow-400 font-medium">
              ⚠️ Gra toczy się w ligach. Zanim zaczniesz typować, dołącz do ligi w zakładce „LIGI”.
              Hasło do ligi dostaniesz od administratora.
            </p>

            <Section title="Ligi">
              <p>
                Każda liga ma osobny ranking. Możesz należeć do kilku lig i w każdej typować inaczej.
              </p>
              <p>
                Jeśli należysz do kilku lig, na stronach „MECZE”, „TABELA” i „PRZEBIEG” u góry wybierasz
                ligę. Na stronie „MECZE” jest też przełącznik „Obstaw wszędzie to samo”: gdy jest
                włączony, typ zapisuje się we wszystkich Twoich ligach naraz. Gdy przy włączonym
                przełączniku dołączysz do nowej ligi, Twoje typy na nadchodzące mecze zostaną do niej
                skopiowane.
              </p>
              <p>Wyjście z ligi usuwa wszystkie Twoje typy w tej lidze.</p>
            </Section>

            <Section title="Typowanie meczów">
              <p>
                W zakładce „MECZE” typujesz wynik przed rozpoczęciem meczu i do tego momentu możesz go
                zmieniać. Po pierwszym gwizdku mecz znika z listy i typu nie da się już zmienić.
              </p>
              <p>
                Liczy się wynik po 90 minutach (z doliczonym czasem, bez dogrywki). W fazie pucharowej,
                jeśli obstawisz remis, dodatkowo wybierasz, kto wygra w dogrywce lub rzutach karnych.
              </p>
              <p>
                Zapisany typ widać nad meczem jako „Twój typ: …”. Jeśli ten napis się nie pojawił, typ
                nie został zapisany.
              </p>
            </Section>

            <Section title="Punktacja">
              <p>• 3 pkt – dokładny wynik</p>
              <p>• 1 pkt – poprawne rozstrzygnięcie (wygrana / remis / przegrana)</p>
              <p>• +1 pkt – w fazie pucharowej poprawnie wskazany zwycięzca dogrywki lub karnych</p>
            </Section>

            <Section title="Bonusy">
              <p>Do rozpoczęcia pierwszego meczu turnieju możesz obstawić (osobno w każdej lidze):</p>
              <p>• zwycięzcę turnieju – 5 pkt za trafienie</p>
              <p>
                • króla strzelców – 5 pkt za trafienie (wpisz imię i nazwisko zawodnika, np. „Kylian
                Mbappe”)
              </p>
            </Section>

            <Section title="Wyniki i tabela">
              <p>
                Wyniki pobierane są automatycznie na bieżąco, a punkty i ranking zmieniają się już w
                trakcie meczu (oznaczenie „● NA ŻYWO”). W razie potrzeby administrator poprawia wynik
                ręcznie.
              </p>
              <p>
                W zakładce „TABELA” widzisz ranking ligi i typy innych graczy. Typy na mecz są widoczne
                dopiero po jego rozpoczęciu, a wcześniej 🔒 pokazuje tylko, że ktoś już obstawił. Bonusy
                innych graczy widać po starcie turnieju.
              </p>
              <p>W zakładce „PRZEBIEG” są wykresy punktów i miejsca w tabeli po kolejnych meczach.</p>
            </Section>

            <Section title="Kto wygrywa?">
              <p>• Wygrywa osoba z największą liczbą punktów w danej lidze.</p>
              <p>• Przy remisie decyduje liczba trafionych dokładnych wyników (po 3 pkt).</p>
              <p>• Jeśli dalej jest remis, gracze dzielą miejsce ex aequo.</p>
            </Section>

            <p>Powodzenia i miłej zabawy!</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {TILES.map((tile) => (
            <Link key={tile.href} href={tile.href}>
              <div className="card shadow p-8 h-44 flex flex-col items-center justify-center text-center hover:scale-105 transition cursor-pointer">
                <h2 className="text-2xl font-bold mb-2">{tile.title}</h2>
                <p className="text-zinc-400">{tile.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
