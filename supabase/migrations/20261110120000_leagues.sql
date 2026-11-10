-- Ligi (osobne tabele rankingowe) w jednym turnieju.
--
-- * Ligę (nazwa + hasło) zakłada tylko admin (public.is_admin()); każdy zalogowany może dołączyć
--   do dowolnej ligi, jeśli zna hasło. Admin nie jest automatycznie członkiem założonej ligi.
-- * Typy na mecze i typ bonusowy są osobne dla każdej ligi (predictions.league_id, bonus_predictions.league_id).
-- * Punkty za pojedynczy typ dalej liczą istniejące triggery (per wiersz). Ranking ligi liczy widok
--   league_standings (zamiast tabeli players, która sumuje wszystkie ligi).
-- * Funkcje punktów dostają security definer - naprawia to też przeliczanie punktów po wpisaniu
--   wyniku w panelu admina (wcześniej RLS po cichu blokowało aktualizację typów innych graczy).
-- * Istniejący gracze (wszyscy z tabeli players) i ich typy trafiają do ligi "Główna".
--
-- Uruchomić raz w SQL Editorze w Supabase. Kopia schematu sprzed migracji: supabase/schema_backup.sql.
-- PRZED uruchomieniem zmień hasło ligi "Główna" poniżej (ZMIEN_HASLO).
-- Wymaga migracji 20261105120000_admins.sql (public.is_admin()).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tabele
-- ---------------------------------------------------------------------------

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint leagues_name_length check (char_length(btrim(name)) between 1 and 50)
);

-- Nazwa ligi unikalna bez względu na wielkość liter
create unique index if not exists leagues_name_unique on public.leagues (lower(btrim(name)));

create table if not exists public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text not null,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_members_user_idx on public.league_members (user_id);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

-- Zapis tylko przez funkcje poniżej (security definer). Hasła (hash) nie da się odczytać z aplikacji.
revoke all on public.leagues from anon, authenticated;
revoke all on public.league_members from anon, authenticated;
grant select (id, name, created_by, created_at) on public.leagues to authenticated;
grant select on public.league_members to authenticated;

-- ---------------------------------------------------------------------------
-- Funkcje pomocnicze do RLS
-- ---------------------------------------------------------------------------

-- Czy zalogowany użytkownik należy do ligi (security definer - bez rekurencji RLS na league_members)
create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

-- Turniej już się zaczął (pierwszy mecz)? Wtedy typ bonusowy jest zamknięty
create or replace function public.is_tournament_started()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select min(m.match_time::timestamp) <= (now() at time zone 'Europe/Warsaw') from public.matches m),
    false
  );
$$;

revoke all on function public.is_league_member(uuid) from public, anon;
revoke all on function public.is_tournament_started() from public, anon;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_tournament_started() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS lig
-- ---------------------------------------------------------------------------

-- Listę lig (bez hasła) widzi każdy zalogowany - żeby mógł wybrać, do której dołączyć
drop policy if exists "leagues_select" on public.leagues;
create policy "leagues_select" on public.leagues
  for select to authenticated
  using (true);

-- Członków ligi widzą tylko jej członkowie
drop policy if exists "league_members_select" on public.league_members;
create policy "league_members_select" on public.league_members
  for select to authenticated
  using (public.is_league_member(league_id));

-- ---------------------------------------------------------------------------
-- Zakładanie, dołączanie, opuszczanie
-- ---------------------------------------------------------------------------

create or replace function public.create_league(p_name text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Tylko admin może zakładać ligi';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 50 then
    raise exception 'Nazwa ligi musi mieć od 1 do 50 znaków';
  end if;
  if p_password is null or char_length(p_password) < 4 then
    raise exception 'Hasło ligi musi mieć co najmniej 4 znaki';
  end if;
  if exists (select 1 from public.leagues where lower(btrim(name)) = lower(btrim(p_name))) then
    raise exception 'Liga o tej nazwie już istnieje';
  end if;

  insert into public.leagues (name, password_hash, created_by)
  values (btrim(p_name), extensions.crypt(p_password, extensions.gen_salt('bf')), v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.join_league(p_league_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'Musisz być zalogowany';
  end if;

  select password_hash into v_hash from public.leagues where id = p_league_id;
  if v_hash is null then
    raise exception 'Nie ma takiej ligi';
  end if;
  if p_password is null or extensions.crypt(p_password, v_hash) <> v_hash then
    raise exception 'Błędne hasło';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.league_members (league_id, user_id, user_email)
  values (p_league_id, v_uid, v_email)
  on conflict (league_id, user_id) do nothing;
end;
$$;

-- Opuszczenie ligi usuwa też typy użytkownika w tej lidze
create or replace function public.leave_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Musisz być zalogowany';
  end if;

  delete from public.predictions where user_id = v_uid and league_id = p_league_id;
  delete from public.bonus_predictions where user_id = v_uid and league_id = p_league_id;
  delete from public.league_members where user_id = v_uid and league_id = p_league_id;
end;
$$;

revoke all on function public.create_league(text, text) from public, anon;
revoke all on function public.join_league(uuid, text) from public, anon;
revoke all on function public.leave_league(uuid) from public, anon;
grant execute on function public.create_league(text, text) to authenticated;
grant execute on function public.join_league(uuid, text) to authenticated;
grant execute on function public.leave_league(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Liga "Główna" dla dotychczasowych graczy
-- ---------------------------------------------------------------------------

do $$
declare
  v_main uuid;
begin
  select id into v_main from public.leagues where lower(name) = 'główna';

  if v_main is null then
    insert into public.leagues (name, password_hash)
    values ('Główna', extensions.crypt('ZMIEN_HASLO', extensions.gen_salt('bf')))
    returning id into v_main;
  end if;

  insert into public.league_members (league_id, user_id, user_email)
  select v_main, u.id, u.email
  from auth.users u
  where u.id in (
    select user_id from public.predictions
    union select user_id from public.bonus_predictions
    union select id from public.players
  )
  on conflict (league_id, user_id) do nothing;

  -- league_id w typach
  alter table public.predictions add column if not exists league_id uuid references public.leagues (id) on delete cascade;
  alter table public.bonus_predictions add column if not exists league_id uuid references public.leagues (id) on delete cascade;

  update public.predictions set league_id = v_main where league_id is null;
  update public.bonus_predictions set league_id = v_main where league_id is null;
end $$;

alter table public.predictions alter column league_id set not null;
alter table public.bonus_predictions alter column league_id set not null;

-- Stare ograniczenia unikalności (user_id, match_id) i (user_id) zastępujemy wersjami z ligą.
-- Nazwy ograniczeń nie są znane (tworzone w panelu), więc szukamy ich po kolumnach.
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
    from pg_constraint c
    where c.contype in ('u', 'p')
      and (
        (c.conrelid = 'public.predictions'::regclass
          and (select array_agg(a.attname::text order by a.attname)
               from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any (c.conkey))
              = array['match_id', 'user_id'])
        or
        (c.conrelid = 'public.bonus_predictions'::regclass
          and (select array_agg(a.attname::text order by a.attname)
               from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any (c.conkey))
              = array['user_id'])
      )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;

  -- Unikalne indeksy utworzone bez constraintu
  for r in
    select i.indexrelid::regclass as idx
    from pg_index i
    where i.indisunique and not i.indisprimary
      and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
      and (
        (i.indrelid = 'public.predictions'::regclass
          and (select array_agg(a.attname::text order by a.attname)
               from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey))
              = array['match_id', 'user_id'])
        or
        (i.indrelid = 'public.bonus_predictions'::regclass
          and (select array_agg(a.attname::text order by a.attname)
               from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any (i.indkey))
              = array['user_id'])
      )
  loop
    execute format('drop index %s', r.idx);
  end loop;
end $$;

alter table public.predictions
  drop constraint if exists predictions_user_match_league_key,
  add constraint predictions_user_match_league_key unique (user_id, match_id, league_id);

alter table public.bonus_predictions
  drop constraint if exists bonus_predictions_user_league_key,
  add constraint bonus_predictions_user_league_key unique (user_id, league_id);

create index if not exists predictions_league_idx on public.predictions (league_id);

-- ---------------------------------------------------------------------------
-- RLS typów: tylko w swoich ligach; cudze typy widoczne dopiero po starcie meczu/turnieju
-- (match_time to czas polski bez strefy, stąd porównanie z now() w strefie Europe/Warsaw)
-- ---------------------------------------------------------------------------

-- Usuwamy wszystkie dotychczasowe polityki (nazwy nie są znane) i zakładamy nowe
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('predictions', 'bonus_predictions')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.predictions enable row level security;
alter table public.bonus_predictions enable row level security;

create policy "predictions_select" on public.predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_league_member(league_id) and exists (select 1 from public.matches m where m.id = match_id and m.match_time::timestamp <= (now() at time zone 'Europe/Warsaw')))
  );

create policy "predictions_insert" on public.predictions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
    and exists (select 1 from public.matches m where m.id = match_id and m.match_time::timestamp > (now() at time zone 'Europe/Warsaw'))
  );

create policy "predictions_update" on public.predictions
  for update to authenticated
  using (user_id = auth.uid() and exists (select 1 from public.matches m where m.id = match_id and m.match_time::timestamp > (now() at time zone 'Europe/Warsaw')))
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
    and exists (select 1 from public.matches m where m.id = match_id and m.match_time::timestamp > (now() at time zone 'Europe/Warsaw'))
  );

create policy "bonus_predictions_select" on public.bonus_predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_league_member(league_id) and public.is_tournament_started())
  );

create policy "bonus_predictions_insert" on public.bonus_predictions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
    and not public.is_tournament_started()
  );

create policy "bonus_predictions_update" on public.bonus_predictions
  for update to authenticated
  using (user_id = auth.uid() and not public.is_tournament_started())
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
    and not public.is_tournament_started()
  );

-- ---------------------------------------------------------------------------
-- Funkcje punktów działają z uprawnieniami właściciela (security definer)
-- ---------------------------------------------------------------------------
-- Bez tego trigger po zmianie wyniku przez admina w panelu (klucz anon, rola authenticated)
-- podlega RLS na predictions, które pozwala zmieniać tylko własne typy na nierozpoczęte mecze,
-- więc punkty innych graczy po cichu się nie przeliczały. sync-results (service_role) tego problemu nie miał.

alter function public.recompute_points_for_match() security definer set search_path = public;
alter function public.recompute_points_for_bonus_results() security definer set search_path = public;
alter function public.sync_player_total_points() security definer set search_path = public;
alter function public.recompute_prediction_points() security definer set search_path = public;
alter function public.recompute_bonus_prediction_points() security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Ranking ligi
-- ---------------------------------------------------------------------------

-- security_invoker: widok działa z uprawnieniami użytkownika, więc RLS ogranicza go do jego lig
create or replace view public.league_standings
with (security_invoker = true)
as
select
  lm.league_id,
  lm.user_id,
  lm.user_email,
  coalesce(p.points, 0) + coalesce(b.points, 0) as total_points,
  coalesce(p.exact_hits, 0) as exact_hits
from public.league_members lm
left join lateral (
  select
    sum(coalesce(pr.points, 0))::int as points,
    count(*) filter (where pr.is_exact_hit)::int as exact_hits
  from public.predictions pr
  where pr.user_id = lm.user_id and pr.league_id = lm.league_id
) p on true
left join public.bonus_predictions b
  on b.user_id = lm.user_id and b.league_id = lm.league_id;

grant select on public.league_standings to authenticated;

-- Realtime: zmiany członków ligi odświeżają ranking i listę lig
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_members'
  ) then
    alter publication supabase_realtime add table public.league_members;
  end if;
end $$;

-- Zmiana hasła ligi (tylko w SQL Editorze):
--   update public.leagues set password_hash = extensions.crypt('<nowe hasło>', extensions.gen_salt('bf'))
--   where name = 'Główna';
