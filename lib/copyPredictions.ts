import { supabase } from "./supabase"

// Kopiuje typy użytkownika z jednej ligi do drugiej - tylko na mecze, które się jeszcze nie zaczęły,
// i typ bonusowy, jeśli turniej jeszcze trwa przed pierwszym meczem (to samo pilnuje RLS w bazie).
// Używane przy dołączaniu do ligi, gdy włączone jest "obstaw wszędzie to samo".
export const copyPredictions = async (
  user: { id: string; email?: string },
  fromLeagueId: string,
  toLeagueId: string
) => {
  const now = new Date()

  const { data: matches } = await supabase.from("matches").select("id, match_time")
  const upcoming = new Set(
    (matches || []).filter((m) => new Date(m.match_time) > now).map((m) => m.id)
  )
  const tournamentStarted = (matches || []).some((m) => new Date(m.match_time) <= now)

  const { data: preds } = await supabase
    .from("predictions")
    .select("match_id, predicted_home_score, predicted_away_score, who_wins")
    .eq("user_id", user.id)
    .eq("league_id", fromLeagueId)

  const rows = (preds || [])
    .filter((p) => upcoming.has(p.match_id))
    .map((p) => ({
      user_id: user.id,
      user_email: user.email,
      league_id: toLeagueId,
      match_id: p.match_id,
      predicted_home_score: p.predicted_home_score,
      predicted_away_score: p.predicted_away_score,
      who_wins: p.who_wins,
    }))

  if (rows.length > 0) {
    const { error } = await supabase
      .from("predictions")
      .upsert(rows, { onConflict: "user_id,match_id,league_id" })
    if (error) return error
  }

  if (!tournamentStarted) {
    const { data: bonus } = await supabase
      .from("bonus_predictions")
      .select("predicted_winner, predicted_top_scorer")
      .eq("user_id", user.id)
      .eq("league_id", fromLeagueId)
      .maybeSingle()

    if (bonus) {
      const { error } = await supabase.from("bonus_predictions").upsert(
        {
          user_id: user.id,
          user_email: user.email,
          league_id: toLeagueId,
          predicted_winner: bonus.predicted_winner,
          predicted_top_scorer: bonus.predicted_top_scorer,
        },
        { onConflict: "user_id,league_id" }
      )
      if (error) return error
    }
  }

  return null
}
