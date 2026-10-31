### OPIS PROJEKTU
Stronka do obstawiania wyników meczy na mistrzostwach piłki nożnej 2026 (Predykcje MŚ2026).

Gracze typują wynik każdego meczu oraz raz, przed startem turnieju, zwycięzcę mistrzostw i króla strzelców. Ranking pokazuje, kto zdobył najwięcej punktów.

### ZASADY PUNKTACJI
- dokładny wynik – 3 pkt,
- trafione rozstrzygnięcie (wygrana / remis / porażka) – 1 pkt,
- zwycięzca turnieju – 5 pkt,
- król strzelców – 5 pkt.

Liczy się wynik po 90 minutach. Przy równej liczbie punktów decyduje liczba dokładnych trafień.

### FUNKCJE
- logowanie loginem i hasłem,
- obstawianie meczów do momentu ich rozpoczęcia,
- ranking i tabela typów wszystkich graczy (typy innych są widoczne po rozpoczęciu meczu),
- wykresy punktów w czasie,
- wyniki na żywo z [football-data.org](https://www.football-data.org) – ranking i tabela odświeżają się same, a trwające mecze mają oznaczenie „● NA ŻYWO”.

### TECHNOLOGIE
Next.js, React, TypeScript, Tailwind CSS, Recharts, Supabase.

### URUCHOMIENIE
```bash
npm install
npm run dev
```
W pliku `.env` trzeba ustawić `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### DOKUMENTACJA
- [architecture.md](architecture.md) – architektura, baza danych, wyniki na żywo, wdrożenie.
