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

CREATE OR REPLACE FUNCTION public.recompute_bonus_prediction_points()
 RETURNS trigger
 LANGUAGE plpgsql
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

CREATE OR REPLACE FUNCTION public.sync_player_total_points()
 RETURNS trigger
 LANGUAGE plpgsql
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

CREATE TRIGGER set_predictions_last_updated BEFORE UPDATE ON public.predictions FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

CREATE TRIGGER trg_bonus_predictions_points BEFORE INSERT OR UPDATE OF predicted_winner, predicted_top_scorer ON public.bonus_predictions FOR EACH ROW EXECUTE FUNCTION recompute_bonus_prediction_points();

CREATE TRIGGER trg_bonus_predictions_sync_points AFTER INSERT OR DELETE OR UPDATE OF points ON public.bonus_predictions FOR EACH ROW EXECUTE FUNCTION sync_player_total_points();

CREATE TRIGGER trg_bonus_results_points AFTER UPDATE OF winner, top_scorer ON public.bonus_results FOR EACH ROW EXECUTE FUNCTION recompute_points_for_bonus_results();

CREATE TRIGGER trg_matches_points AFTER UPDATE OF home_score, away_score, knockout_winner ON public.matches FOR EACH ROW EXECUTE FUNCTION recompute_points_for_match();

CREATE TRIGGER trg_predictions_points BEFORE INSERT OR UPDATE OF predicted_home_score, predicted_away_score, match_id ON public.predictions FOR EACH ROW EXECUTE FUNCTION recompute_prediction_points();

CREATE TRIGGER trg_predictions_sync_points AFTER INSERT OR DELETE OR UPDATE OF points ON public.predictions FOR EACH ROW EXECUTE FUNCTION sync_player_total_points();

create policy "Admin poprawia wyniki" on public.matches as PERMISSIVE for UPDATE to authenticated using (is_admin()) with check (is_admin());

create policy "Anyone can view matches" on public.matches as PERMISSIVE for SELECT to public using (true) with check (true);

create policy admins_select_own on public.admins as PERMISSIVE for SELECT to authenticated using ((user_id = auth.uid())) with check (true);

create policy bonus_insert on public.bonus_predictions as PERMISSIVE for INSERT to authenticated using (true) with check (((auth.uid() = user_id) AND ((now() AT TIME ZONE 'Europe/Warsaw'::text) < ( SELECT min(matches.match_time) AS min
   FROM matches))));

create policy bonus_results_select_all on public.bonus_results as PERMISSIVE for SELECT to authenticated using (true) with check (true);

create policy bonus_select on public.bonus_predictions as PERMISSIVE for SELECT to authenticated using (((auth.uid() = user_id) OR ((now() AT TIME ZONE 'Europe/Warsaw'::text) >= ( SELECT min(matches.match_time) AS min
   FROM matches)))) with check (true);

create policy bonus_update on public.bonus_predictions as PERMISSIVE for UPDATE to authenticated using (((auth.uid() = user_id) AND ((now() AT TIME ZONE 'Europe/Warsaw'::text) < ( SELECT min(matches.match_time) AS min
   FROM matches)))) with check (((auth.uid() = user_id) AND ((now() AT TIME ZONE 'Europe/Warsaw'::text) < ( SELECT min(matches.match_time) AS min
   FROM matches))));

create policy players_select_all on public.players as PERMISSIVE for SELECT to authenticated using (true) with check (true);

create policy predictions_insert on public.predictions as PERMISSIVE for INSERT to authenticated using (true) with check (((auth.uid() = user_id) AND ((now() AT TIME ZONE 'Europe/Warsaw'::text) < ( SELECT m.match_time
   FROM matches m
  WHERE (m.id = predictions.match_id)))));

create policy predictions_select on public.predictions as PERMISSIVE for SELECT to authenticated using (((auth.uid() = user_id) OR ((now() AT TIME ZONE 'Europe/Warsaw'::text) >= ( SELECT m.match_time
   FROM matches m
  WHERE (m.id = predictions.match_id))))) with check (true);

create policy predictions_update on public.predictions as PERMISSIVE for UPDATE to authenticated using (((auth.uid() = user_id) AND ((now() AT TIME ZONE 'Europe/Warsaw'::text) < ( SELECT m.match_time
   FROM matches m
  WHERE (m.id = predictions.match_id))))) with check (((auth.uid() = user_id) AND ((now() AT TIME ZONE 'Europe/Warsaw'::text) < ( SELECT m.match_time
   FROM matches m
  WHERE (m.id = predictions.match_id)))));