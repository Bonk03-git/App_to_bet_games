-- Administratorzy aplikacji
--
-- Admina dodaje się tylko ręcznie, w SQL Editor w panelu Supabase:
--   insert into public.admins (user_id)
--   select id from auth.users where email = '<login>@worldcup.local';
-- Z aplikacji (klucz anon) nie da się dopisać, zmienić ani usunąć wiersza w tej tabeli.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Z aplikacji można tylko odczytać tę tabelę; zapis zablokowany także na poziomie uprawnień
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- Zalogowany użytkownik widzi tylko swój wiersz (żeby aplikacja wiedziała, czy pokazać panel admina)
drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own" on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- Czy aktualnie zalogowany użytkownik jest adminem; do użycia w politykach RLS
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
