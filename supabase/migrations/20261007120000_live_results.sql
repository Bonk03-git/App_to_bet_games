-- Automatyczne wyniki z football-data.org

-- id meczu w football-data.org (uzupełniane automatycznie przez funkcję sync-results,
-- można też wpisać ręcznie) i status meczu z API (IN_PLAY, PAUSED, FINISHED, ...)
alter table public.matches
  add column if not exists external_id integer unique,
  add column if not exists status text;

-- Realtime: ranking i tabela odświeżają się same po zmianie wyników/punktów
do $$
declare
  t text;
begin
  foreach t in array array['matches', 'predictions', 'players'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Punkty przeliczają się także po wpisaniu samego zwycięzcy dogrywki/karnych
-- (sync-results ustawia knockout_winner po meczu, gdy wynik po 90 minutach już jest w bazie)
create or replace trigger trg_matches_points
  after update of home_score, away_score, knockout_winner on public.matches
  for each row execute function public.recompute_points_for_match();
