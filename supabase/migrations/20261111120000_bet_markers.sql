-- Kłódki w tabeli typów (LeaderboardGrid) na bieżąco: kto w lidze już obstawił mecz / bonus - BEZ samego typu.
--
-- Po migracji 20261110120000_leagues.sql RLS nie pokazuje cudzych typów przed startem meczu, więc przeglądarka
-- (ani Realtime) nie wie, że przeciwnik obstawił. Tabela bet_markers trzyma tylko (liga, gracz, mecz),
-- uzupełniają ją triggery na predictions/bonus_predictions, a członkowie ligi widzą ją od razu i przez Realtime.
-- match_id = null oznacza typ bonusowy.
--
-- Uruchomić raz w SQL Editorze w Supabase (po 20261110120000_leagues.sql). Można uruchomić ponownie.

-- Poprzednia wersja tej migracji (funkcje RPC + odpytywanie co minutę) - już niepotrzebna
drop function if exists public.league_placed_bets(uuid);
drop function if exists public.league_placed_bonus(uuid);

create table if not exists public.bet_markers (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid references public.matches (id) on delete cascade,
  constraint bet_markers_unique unique nulls not distinct (league_id, user_id, match_id)
);

alter table public.bet_markers enable row level security;

-- Zapis tylko przez triggery poniżej; odczyt dla członków ligi
revoke all on public.bet_markers from anon, authenticated;
grant select on public.bet_markers to authenticated;

drop policy if exists "bet_markers_select" on public.bet_markers;
create policy "bet_markers_select" on public.bet_markers
  for select to authenticated
  using (public.is_league_member(league_id));

-- Triggery: typ dodany -> znacznik, typ usunięty -> bez znacznika
create or replace function public.sync_bet_marker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match uuid;
begin
  if tg_op = 'INSERT' then
    v_match := case when tg_table_name = 'predictions' then new.match_id else null end;
    insert into public.bet_markers (league_id, user_id, match_id)
    values (new.league_id, new.user_id, v_match)
    on conflict on constraint bet_markers_unique do nothing;
    return new;
  else
    v_match := case when tg_table_name = 'predictions' then old.match_id else null end;
    delete from public.bet_markers
    where league_id = old.league_id and user_id = old.user_id and match_id is not distinct from v_match;
    return old;
  end if;
end;
$$;

drop trigger if exists trg_predictions_bet_marker on public.predictions;
create trigger trg_predictions_bet_marker
  after insert or delete on public.predictions
  for each row execute function public.sync_bet_marker();

drop trigger if exists trg_bonus_predictions_bet_marker on public.bonus_predictions;
create trigger trg_bonus_predictions_bet_marker
  after insert or delete on public.bonus_predictions
  for each row execute function public.sync_bet_marker();

-- Znaczniki dla typów, które już są w bazie
insert into public.bet_markers (league_id, user_id, match_id)
select league_id, user_id, match_id from public.predictions
on conflict on constraint bet_markers_unique do nothing;

insert into public.bet_markers (league_id, user_id, match_id)
select league_id, user_id, null from public.bonus_predictions
on conflict on constraint bet_markers_unique do nothing;

-- Realtime: nowa kłódka pojawia się w tabeli od razu
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bet_markers'
  ) then
    alter publication supabase_realtime add table public.bet_markers;
  end if;
end $$;
