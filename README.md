# World Cup Predictor 2026

Prywatna aplikacja do typowania wyników MŚ 2026 dla znajomych.

## 📌 Założenia projektu

Aplikacja umożliwia:

* rejestrację i logowanie użytkowników,
* typowanie wyników meczów,
* automatyczne liczenie punktów,
* ranking live użytkowników,
* podgląd typów innych graczy,
* blokadę edycji po rozpoczęciu meczu,
* panel administratora,
* ręczne wpisywanie wyników meczów.

---

# 🛠 Stack technologiczny

| Element         | Technologia  |
| --------------- | ------------ |
| Frontend        | Next.js      |
| Backend/Auth/DB | Supabase     |
| Styling         | Tailwind CSS |
| Hosting         | Vercel       |
| Język           | TypeScript   |

---

# 📁 Struktura projektu

```text
worldcup-predictor/
│
├── app/
│   ├── login/
│   ├── register/
│   ├── dashboard/
│   ├── matches/
│   ├── leaderboard/
│   ├── admin/
│   ├── api/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/
│   ├── navbar.tsx
│   ├── match-card.tsx
│   ├── leaderboard-table.tsx
│   ├── prediction-form.tsx
│   └── loading-spinner.tsx
│
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   ├── scoring.ts
│   ├── matches.ts
│   ├── leaderboard.ts
│   └── utils.ts
│
├── types/
│   ├── match.ts
│   ├── prediction.ts
│   ├── profile.ts
│   └── leaderboard.ts
│
├── supabase/
│   ├── schema.sql
│   ├── policies.sql
│   ├── seed.sql
│   └── migrations/
│
├── public/
│   ├── flags/
│   ├── icons/
│   └── images/
│
├── middleware.ts
├── .env.local
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

---

# 📂 Opis folderów

## `/app`

Główne strony aplikacji.

### `login/`

Strona logowania użytkownika.

### `register/`

Strona rejestracji.

### `dashboard/`

Ekran główny po zalogowaniu.

### `matches/`

Lista meczów oraz formularz typowania.

### `leaderboard/`

Tabela rankingowa użytkowników.

### `admin/`

Panel administratora:

* dodawanie meczów,
* wpisywanie wyników,
* zarządzanie użytkownikami.

### `api/`

Endpointy backendowe Next.js.

---

# 🧩 `/components`

Komponenty wielokrotnego użytku.

## `match-card.tsx`

Wyświetlanie pojedynczego meczu.

## `prediction-form.tsx`

Formularz wpisywania typów.

## `leaderboard-table.tsx`

Tabela rankingowa.

## `navbar.tsx`

Nawigacja aplikacji.

---

# ⚙️ `/lib`

Najważniejsza logika aplikacji.

## `supabase.ts`

Połączenie z Supabase.

## `auth.ts`

Obsługa logowania i sprawdzania ról.

## `scoring.ts`

System punktacji.

Przykład:

```ts
exact score = 3 points
correct winner = 1 point
correct draw = 1 point
```

## `matches.ts`

Operacje na meczach.

## `leaderboard.ts`

Obliczanie rankingu.

---

# 🗄 `/types`

Typy TypeScript.

Przykłady:

```ts
export interface Match {}
export interface Prediction {}
```

---

# 🧱 `/supabase`

Pliki SQL związane z bazą danych.

## `schema.sql`

Struktura tabel.

## `policies.sql`

Reguły bezpieczeństwa (RLS).

## `seed.sql`

Początkowe dane testowe.

---

# 🧠 Główne funkcjonalności

## 🔐 Authentication

* login,
* rejestracja,
* role użytkowników.

Role:

```text
admin
user
```

---

# 👑 Administrator

Administrator może:

* dodawać mecze,
* wpisywać wyniki,
* edytować mecze,
* resetować punktację,
* zarządzać użytkownikami.

---

# ⚽ Typowanie meczów

Użytkownik może:

* typować tylko przyszłe mecze,
* edytować typ tylko przed kickoffem,
* oglądać typy innych użytkowników.

---

# 🧮 Punktacja

Przykładowy system:

| Typ                | Punkty |
| ------------------ | ------ |
| Dokładny wynik     | 3      |
| Poprawny zwycięzca | 1      |
| Poprawny remis     | 1      |

Logika będzie znajdować się w:

```text
/lib/scoring.ts
```

---

# 🔒 Middleware

`middleware.ts` odpowiada za:

* blokowanie dostępu dla niezalogowanych,
* ochronę panelu admina,
* redirecty.

---

# 🌍 Deployment

## Hosting

Aplikacja będzie hostowana na:

* Vercel

## Baza danych

* Supabase

---

# 🚀 Plan developmentu

## Etap 1

* setup projektu,
* auth,
* role.

## Etap 2

* baza meczów,
* formularz typowania.

## Etap 3

* punktacja,
* ranking live.

## Etap 4

* panel admina.

## Etap 5

* deployment,
* testy,
* poprawki UI.

---

# 📌 Naming conventions

## Komponenty

```text
PascalCase
```

Przykład:

```text
MatchCard.tsx
```

## Funkcje

```text
camelCase
```

Przykład:

```ts
calculatePoints()
```

---

# 🔥 Finalny cel

Lekka, szybka i nowoczesna aplikacja do typowania MŚ 2026 działająca:

* na telefonie,
* na komputerze,
* dla prywatnej grupy znajomych.
