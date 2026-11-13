-- Schemat bazy Predykcje MŚ2026 (Supabase, schemat public) - zrzut z 2026-11-10
-- Wygenerowany przez supabase/dump_schema.sql. Bez danych, auth/storage, pg_cron (supabase/cron.sql) i sekretów.

set check_function_bodies = false;

create extension if not exists pg_cron with schema pg_catalog;

create extension if not exists pg_net with schema public;

create extension if not exists pg_stat_statements with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists supabase_vault with schema vault;

create extension if not exists "uuid-ossp" with schema extensions;

create table public.admins (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table public.bet_markers (
  league_id uuid not null,
  user_id uuid not null,
  match_id uuid,
  id bigint generated always as identity not null
);

create table public.bonus_predictions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  user_email text,
  predicted_winner text,
  predicted_top_scorer text,
  created_at timestamp with time zone default now(),
  points integer default 0 not null,
  league_id uuid not null
);

create table public.bonus_results (
  id integer default 1 not null,
  winner text,
  top_scorer text
);

create table public.league_members (
  league_id uuid not null,
  user_id uuid not null,
  user_email text not null,
  joined_at timestamp with time zone default now() not null
);

create table public.leagues (
  id uuid default gen_random_uuid() not null,
  name text not null,
  password_hash text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.matches (
  id uuid default gen_random_uuid() not null,
  home_team text not null,
  away_team text not null,
  match_time timestamp without time zone not null,
  home_score integer,
  away_score integer,
  created_at timestamp without time zone default now(),
  is_it_group_phase boolean,
  knockout_winner text,
  external_id integer,
  status text,
  manual_result boolean default false not null
);

create table public.players (
  id uuid not null,
  email text,
  total_points integer default 0 not null,
  exact_hits integer default 0 not null
);

create table public.predictions (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  match_id uuid,
  predicted_home_score integer not null,
  predicted_away_score integer not null,
  created_at timestamp without time zone default now(),
  user_email text,
  last_updated timestamp with time zone default now(),
  points integer default 0 not null,
  is_exact_hit boolean default false not null,
  who_wins text,
  league_id uuid not null
);

alter table public.admins add constraint admins_pkey PRIMARY KEY (user_id);

alter table public.bet_markers add constraint bet_markers_pkey PRIMARY KEY (id);

alter table public.bet_markers add constraint bet_markers_unique UNIQUE NULLS NOT DISTINCT (league_id, user_id, match_id);

alter table public.bonus_predictions add constraint bonus_predictions_pkey PRIMARY KEY (id);

alter table public.bonus_predictions add constraint bonus_predictions_user_league_key UNIQUE (user_id, league_id);

alter table public.bonus_results add constraint bonus_results_id_check CHECK ((id = 1));

alter table public.bonus_results add constraint bonus_results_pkey PRIMARY KEY (id);

alter table public.league_members add constraint league_members_pkey PRIMARY KEY (league_id, user_id);

alter table public.leagues add constraint leagues_name_length CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 50)));

alter table public.leagues add constraint leagues_pkey PRIMARY KEY (id);

alter table public.matches add constraint matches_external_id_key UNIQUE (external_id);

alter table public.matches add constraint matches_knockout_winner_check CHECK ((knockout_winner = ANY (ARRAY['home'::text, 'away'::text])));

alter table public.matches add constraint matches_pkey PRIMARY KEY (id);

alter table public.players add constraint players_pkey PRIMARY KEY (id);

alter table public.predictions add constraint predictions_pkey PRIMARY KEY (id);

alter table public.predictions add constraint predictions_user_match_league_key UNIQUE (user_id, match_id, league_id);

alter table public.predictions add constraint predictions_who_wins_check CHECK ((who_wins = ANY (ARRAY['home'::text, 'away'::text])));

alter table public.admins add constraint admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.bet_markers add constraint bet_markers_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

alter table public.bet_markers add constraint bet_markers_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;

alter table public.bet_markers add constraint bet_markers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.bonus_predictions add constraint bonus_predictions_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

alter table public.league_members add constraint league_members_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

alter table public.league_members add constraint league_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.leagues add constraint leagues_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table public.players add constraint players_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.predictions add constraint predictions_league_id_fkey FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

alter table public.predictions add constraint predictions_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;

alter table public.predictions add constraint predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX league_members_user_idx ON public.league_members USING btree (user_id);

CREATE UNIQUE INDEX leagues_name_unique ON public.leagues USING btree (lower(btrim(name)));

CREATE INDEX predictions_league_idx ON public.predictions USING btree (league_id);

CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, is_admin boolean, leagues jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin może przeglądać konta';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    exists (select 1 from public.admins a where a.user_id = u.id),
    coalesce(
      (select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name)
       from public.league_members lm
       join public.leagues l on l.id = lm.league_id
       where lm.user_id = u.id),
      '[]'::jsonb
    )
  from auth.users u
  order by u.email;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_remove_from_league(p_user_id uuid, p_league_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin może usuwać graczy z lig';
  end if;
  if not exists (
    select 1 from public.league_members where user_id = p_user_id and league_id = p_league_id
  ) then
    raise exception 'Gracz nie należy do tej ligi';
  end if;

  delete from public.predictions where user_id = p_user_id and league_id = p_league_id;
  delete from public.bonus_predictions where user_id = p_user_id and league_id = p_league_id;
  delete from public.league_members where user_id = p_user_id and league_id = p_league_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin może usuwać konta';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Nie możesz usunąć własnego konta';
  end if;
  if exists (select 1 from public.admins where user_id = p_user_id) then
    raise exception 'Nie można usunąć konta admina';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'Nie ma takiego konta';
  end if;

  -- bonus_predictions nie ma klucza obcego do auth.users, więc kasujemy jawnie (resztę też, dla porządku)
  delete from public.bonus_predictions where user_id = p_user_id;
  delete from public.predictions where user_id = p_user_id;
  delete from public.league_members where user_id = p_user_id;
  delete from public.players where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_bonus_points(actual_winner text, actual_top_scorer text, pred_winner text, pred_top_scorer text)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  pts int := 0;
begin
  if actual_winner is not null and pred_winner is not null
     and actual_winner = pred_winner then
    pts := pts + 5;
  end if;

  if actual_top_scorer is not null and pred_top_scorer is not null
     and actual_top_scorer = pred_top_scorer then
    pts := pts + 5;
  end if;

  return pts;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_points(real_home integer, real_away integer, pred_home integer, pred_away integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  if real_home is null or real_away is null
     or pred_home is null or pred_away is null then
    return 0;
  end if;

  if real_home = pred_home and real_away = pred_away then
    return 3;
  end if;

  if (real_home > real_away and pred_home > pred_away) or
     (real_home < real_away and pred_home < pred_away) or
     (real_home = real_away and pred_home = pred_away) then
    return 1;
  end if;

  return 0;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_league(p_name text, p_password text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.players (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_league_member(p_league_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_tournament_started()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (select min(m.match_time::timestamp) <= (now() at time zone 'Europe/Warsaw') from public.matches m),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.join_league(p_league_id uuid, p_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.leave_league(p_league_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_bonus_prediction_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
begin
  select winner, top_scorer into r from bonus_results where id = 1;
  new.points := calculate_bonus_points(r.winner, r.top_scorer, new.predicted_winner, new.predicted_top_scorer);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_points_for_bonus_results()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update bonus_predictions
  set points = calculate_bonus_points(new.winner, new.top_scorer, predicted_winner, predicted_top_scorer);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_points_for_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update predictions
  set
    points = calculate_points(new.home_score, new.away_score, predicted_home_score, predicted_away_score)
      + (case when new.is_it_group_phase = false and who_wins is not null and who_wins = new.knockout_winner then 1 else 0 end),
    is_exact_hit = (
      new.home_score is not null and new.away_score is not null
      and new.home_score = predicted_home_score
      and new.away_score = predicted_away_score
    )
  where match_id = new.id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recompute_prediction_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m record;
begin
  select home_score, away_score, is_it_group_phase, knockout_winner
  into m from matches where id = new.match_id;

  new.points := calculate_points(m.home_score, m.away_score, new.predicted_home_score, new.predicted_away_score)
    + case when m.is_it_group_phase = false
                and new.who_wins is not null
                and new.who_wins = m.knockout_winner
           then 1 else 0 end;
  new.is_exact_hit := (
    m.home_score is not null and m.away_score is not null
    and m.home_score = new.predicted_home_score
    and m.away_score = new.predicted_away_score
  );

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_bet_marker()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_player_total_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  affected_user uuid;
begin
  affected_user := coalesce(new.user_id, old.user_id);

  update players
  set
    total_points = (
      coalesce((select sum(points) from predictions where user_id = affected_user), 0)
      +
      coalesce((select sum(points) from bonus_predictions where user_id = affected_user), 0)
    ),
    exact_hits = coalesce(
      (select count(*) from predictions where user_id = affected_user and is_exact_hit = true),
      0
    )
  where id = affected_user;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_last_updated_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$function$
;

create or replace view public.league_standings with (security_invoker=true) as
 SELECT lm.league_id,
    lm.user_id,
    lm.user_email,
    COALESCE(p.points, 0) + COALESCE(b.points, 0) AS total_points,
    COALESCE(p.exact_hits, 0) AS exact_hits
   FROM league_members lm
     LEFT JOIN LATERAL ( SELECT sum(COALESCE(pr.points, 0))::integer AS points,
            count(*) FILTER (WHERE pr.is_exact_hit)::integer AS exact_hits
           FROM predictions pr
          WHERE pr.user_id = lm.user_id AND pr.league_id = lm.league_id) p ON true
     LEFT JOIN bonus_predictions b ON b.user_id = lm.user_id AND b.league_id = lm.league_id;

CREATE TRIGGER trg_bonus_predictions_bet_marker AFTER INSERT OR DELETE ON public.bonus_predictions FOR EACH ROW EXECUTE FUNCTION sync_bet_marker();

CREATE TRIGGER trg_bonus_predictions_points BEFORE INSERT OR UPDATE OF predicted_winner, predicted_top_scorer ON public.bonus_predictions FOR EACH ROW EXECUTE FUNCTION recompute_bonus_prediction_points();

CREATE TRIGGER trg_bonus_predictions_sync_points AFTER INSERT OR DELETE OR UPDATE OF points ON public.bonus_predictions FOR EACH ROW EXECUTE FUNCTION sync_player_total_points();

CREATE TRIGGER trg_bonus_results_points AFTER UPDATE OF winner, top_scorer ON public.bonus_results FOR EACH ROW EXECUTE FUNCTION recompute_points_for_bonus_results();

CREATE TRIGGER trg_matches_points AFTER UPDATE OF home_score, away_score, knockout_winner ON public.matches FOR EACH ROW EXECUTE FUNCTION recompute_points_for_match();

CREATE TRIGGER set_predictions_last_updated BEFORE UPDATE ON public.predictions FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER trg_predictions_bet_marker AFTER INSERT OR DELETE ON public.predictions FOR EACH ROW EXECUTE FUNCTION sync_bet_marker();

CREATE TRIGGER trg_predictions_points BEFORE INSERT OR UPDATE OF predicted_home_score, predicted_away_score, match_id ON public.predictions FOR EACH ROW EXECUTE FUNCTION recompute_prediction_points();

CREATE TRIGGER trg_predictions_sync_points AFTER INSERT OR DELETE OR UPDATE OF points ON public.predictions FOR EACH ROW EXECUTE FUNCTION sync_player_total_points();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

alter table public.admins enable row level security;

alter table public.bet_markers enable row level security;

alter table public.bonus_predictions enable row level security;

alter table public.bonus_results enable row level security;

alter table public.league_members enable row level security;

alter table public.leagues enable row level security;

alter table public.matches enable row level security;

alter table public.players enable row level security;

alter table public.predictions enable row level security;

create policy admins_select_own on public.admins as permissive for select to authenticated using ((user_id = auth.uid()));

create policy bet_markers_select on public.bet_markers as permissive for select to authenticated using (is_league_member(league_id));

create policy bonus_predictions_insert on public.bonus_predictions as permissive for insert to authenticated with check (((user_id = auth.uid()) AND is_league_member(league_id) AND (NOT is_tournament_started())));

create policy bonus_predictions_select on public.bonus_predictions as permissive for select to authenticated using (((user_id = auth.uid()) OR (is_league_member(league_id) AND is_tournament_started())));

create policy bonus_predictions_update on public.bonus_predictions as permissive for update to authenticated using (((user_id = auth.uid()) AND (NOT is_tournament_started()))) with check (((user_id = auth.uid()) AND is_league_member(league_id) AND (NOT is_tournament_started())));

create policy bonus_results_select_all on public.bonus_results as permissive for select to authenticated using (true);

create policy league_members_select on public.league_members as permissive for select to authenticated using (is_league_member(league_id));

create policy leagues_select on public.leagues as permissive for select to authenticated using (true);

create policy "Admin poprawia wyniki" on public.matches as permissive for update to authenticated using (is_admin()) with check (is_admin());

create policy "Anyone can view matches" on public.matches as permissive for select to public using (true);

create policy players_select_all on public.players as permissive for select to authenticated using (true);

create policy predictions_insert on public.predictions as permissive for insert to authenticated with check (((user_id = auth.uid()) AND is_league_member(league_id) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND (m.match_time > (now() AT TIME ZONE 'Europe/Warsaw'::text)))))));

create policy predictions_select on public.predictions as permissive for select to authenticated using (((user_id = auth.uid()) OR (is_league_member(league_id) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND (m.match_time <= (now() AT TIME ZONE 'Europe/Warsaw'::text))))))));

create policy predictions_update on public.predictions as permissive for update to authenticated using (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND (m.match_time > (now() AT TIME ZONE 'Europe/Warsaw'::text))))))) with check (((user_id = auth.uid()) AND is_league_member(league_id) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = predictions.match_id) AND (m.match_time > (now() AT TIME ZONE 'Europe/Warsaw'::text)))))));

revoke all on public.admins from anon, authenticated;

grant select on public.admins to authenticated;

revoke all on public.bet_markers from anon, authenticated;

grant select on public.bet_markers to authenticated;

revoke all on public.bonus_predictions from anon, authenticated;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.bonus_predictions to anon;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.bonus_predictions to authenticated;

revoke all on public.bonus_results from anon, authenticated;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.bonus_results to anon;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.bonus_results to authenticated;

revoke all on public.league_members from anon, authenticated;

grant select on public.league_members to authenticated;

revoke all on public.league_standings from anon, authenticated;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.league_standings to anon;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.league_standings to authenticated;

revoke all on public.leagues from anon, authenticated;

grant select (id, name, created_by, created_at) on public.leagues to authenticated;

revoke all on public.matches from anon, authenticated;

grant delete, insert, maintain, references, select, trigger, truncate on public.matches to anon;

grant delete, insert, maintain, references, select, trigger, truncate on public.matches to authenticated;

grant update (home_score, away_score, knockout_winner, manual_result) on public.matches to authenticated;

revoke all on public.players from anon, authenticated;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.players to anon;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.players to authenticated;

revoke all on public.predictions from anon, authenticated;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.predictions to anon;

grant delete, insert, maintain, references, select, trigger, truncate, update on public.predictions to authenticated;

revoke all on function public.admin_delete_user(p_user_id uuid) from public, anon, authenticated;

grant execute on function public.admin_delete_user(p_user_id uuid) to authenticated;

revoke all on function public.admin_list_users() from public, anon, authenticated;

grant execute on function public.admin_list_users() to authenticated;

revoke all on function public.admin_remove_from_league(p_user_id uuid, p_league_id uuid) from public, anon, authenticated;

grant execute on function public.admin_remove_from_league(p_user_id uuid, p_league_id uuid) to authenticated;

revoke all on function public.calculate_bonus_points(actual_winner text, actual_top_scorer text, pred_winner text, pred_top_scorer text) from public, anon, authenticated;

grant execute on function public.calculate_bonus_points(actual_winner text, actual_top_scorer text, pred_winner text, pred_top_scorer text) to anon;

grant execute on function public.calculate_bonus_points(actual_winner text, actual_top_scorer text, pred_winner text, pred_top_scorer text) to authenticated;

grant execute on function public.calculate_bonus_points(actual_winner text, actual_top_scorer text, pred_winner text, pred_top_scorer text) to public;

revoke all on function public.calculate_points(real_home integer, real_away integer, pred_home integer, pred_away integer) from public, anon, authenticated;

grant execute on function public.calculate_points(real_home integer, real_away integer, pred_home integer, pred_away integer) to anon;

grant execute on function public.calculate_points(real_home integer, real_away integer, pred_home integer, pred_away integer) to authenticated;

grant execute on function public.calculate_points(real_home integer, real_away integer, pred_home integer, pred_away integer) to public;

revoke all on function public.create_league(p_name text, p_password text) from public, anon, authenticated;

grant execute on function public.create_league(p_name text, p_password text) to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.handle_new_user() to anon;

grant execute on function public.handle_new_user() to authenticated;

grant execute on function public.handle_new_user() to public;

revoke all on function public.is_admin() from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_league_member(p_league_id uuid) from public, anon, authenticated;

grant execute on function public.is_league_member(p_league_id uuid) to authenticated;

revoke all on function public.is_tournament_started() from public, anon, authenticated;

grant execute on function public.is_tournament_started() to authenticated;

revoke all on function public.join_league(p_league_id uuid, p_password text) from public, anon, authenticated;

grant execute on function public.join_league(p_league_id uuid, p_password text) to authenticated;

revoke all on function public.leave_league(p_league_id uuid) from public, anon, authenticated;

grant execute on function public.leave_league(p_league_id uuid) to authenticated;

revoke all on function public.recompute_bonus_prediction_points() from public, anon, authenticated;

grant execute on function public.recompute_bonus_prediction_points() to anon;

grant execute on function public.recompute_bonus_prediction_points() to authenticated;

grant execute on function public.recompute_bonus_prediction_points() to public;

revoke all on function public.recompute_points_for_bonus_results() from public, anon, authenticated;

grant execute on function public.recompute_points_for_bonus_results() to anon;

grant execute on function public.recompute_points_for_bonus_results() to authenticated;

grant execute on function public.recompute_points_for_bonus_results() to public;

revoke all on function public.recompute_points_for_match() from public, anon, authenticated;

grant execute on function public.recompute_points_for_match() to anon;

grant execute on function public.recompute_points_for_match() to authenticated;

grant execute on function public.recompute_points_for_match() to public;

revoke all on function public.recompute_prediction_points() from public, anon, authenticated;

grant execute on function public.recompute_prediction_points() to anon;

grant execute on function public.recompute_prediction_points() to authenticated;

grant execute on function public.recompute_prediction_points() to public;

revoke all on function public.sync_bet_marker() from public, anon, authenticated;

grant execute on function public.sync_bet_marker() to anon;

grant execute on function public.sync_bet_marker() to authenticated;

grant execute on function public.sync_bet_marker() to public;

revoke all on function public.sync_player_total_points() from public, anon, authenticated;

grant execute on function public.sync_player_total_points() to anon;

grant execute on function public.sync_player_total_points() to authenticated;

grant execute on function public.sync_player_total_points() to public;

revoke all on function public.update_last_updated_column() from public, anon, authenticated;

grant execute on function public.update_last_updated_column() to anon;

grant execute on function public.update_last_updated_column() to authenticated;

grant execute on function public.update_last_updated_column() to public;

alter publication supabase_realtime add table public.bet_markers;

alter publication supabase_realtime add table public.league_members;

alter publication supabase_realtime add table public.matches;

alter publication supabase_realtime add table public.players;

alter publication supabase_realtime add table public.predictions;