export const calculatePoints = (
  match: any,
  prediction: any
) => {
  if (
    match.home_score === null ||
    match.away_score === null
  ) {
    return 0
  }

  const realHome = match.home_score
  const realAway = match.away_score

  const predHome = prediction.predicted_home_score
  const predAway = prediction.predicted_away_score

  // 3 pkt - exact score
  if (realHome === predHome && realAway === predAway) {
    return 3
  }

  // winner logic
  const realResult =
    realHome > realAway
      ? "home"
      : realHome < realAway
      ? "away"
      : "draw"

  const predResult =
    predHome > predAway
      ? "home"
      : predHome < predAway
      ? "away"
      : "draw"

  if (realResult === predResult) {
    return 1
  }

  return 0
}