-- Panel admina: ręczne wpisywanie i poprawianie wyników (issue #2).
-- Wymaga migracji 20261105120000_admins.sql (tabela public.admins i funkcja public.is_admin()).
-- Uruchomić raz w SQL Editorze w Supabase.

-- Wynik wpisany/poprawiony ręcznie przez admina - funkcja sync-results go nie nadpisuje
-- (dalej aktualizuje tylko status meczu). Admin może oddać mecz z powrotem synchronizacji.
alter table public.matches
  add column if not exists manual_result boolean not null default false;

-- Z aplikacji (anon/authenticated) można zmieniać tylko kolumny wyniku.
-- Funkcja sync-results używa klucza service_role, więc to jej nie dotyczy.
revoke update on public.matches from anon, authenticated;
grant update (home_score, away_score, knockout_winner, manual_result) on public.matches to authenticated;

-- ...i tylko admin (sprawdzane w bazie przez is_admin())
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admin poprawia wyniki" on public.matches;
create policy "Admin poprawia wyniki"
  on public.matches
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Kontrola: na matches nie powinno być innych polityk UPDATE/ALL dla zwykłych użytkowników
-- (polityki są łączone przez OR - inna polityka otworzyłaby edycję wyników wszystkim):
-- select policyname, cmd, roles, qual from pg_policies where schemaname = 'public' and tablename = 'matches';
