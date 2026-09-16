export interface ScoreSummary {
  totalScore: number;
  maxPossibleScore: number;
  percentageScore: number;
  predicate: string;
}

export function calculateRppScore(
  itemScores: Record<string, { score: number; is_active?: boolean }>,
  maxPerItem = 3
): ScoreSummary {
  let totalScore = 0;
  let maxPossibleScore = 0;

  for (const [_, item] of Object.entries(itemScores)) {
    if (item.is_active === false) continue;
    const score = Math.max(1, Math.min(maxPerItem, item.score || 1));
    totalScore += score;
    maxPossibleScore += maxPerItem;
  }

  const percentageScore =
    maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100 * 100) / 100 : 0;

  let predicate = "Kurang (K)";
  if (percentageScore >= 91) predicate = "Sangat Baik (SB)";
  else if (percentageScore >= 81) predicate = "Baik (B)";
  else if (percentageScore >= 71) predicate = "Cukup (C)";

  return {
    totalScore,
    maxPossibleScore,
    percentageScore,
    predicate,
  };
}

export function calculateSupervisionScore(
  itemScores: Record<string, { score: number; is_active?: boolean }>,
  maxPerItem = 4
): ScoreSummary {
  let totalScore = 0;
  let maxPossibleScore = 0;

  for (const [_, item] of Object.entries(itemScores)) {
    if (item.is_active === false) continue;
    const score = Math.max(1, Math.min(maxPerItem, item.score || 1));
    totalScore += score;
    maxPossibleScore += maxPerItem;
  }

  const percentageScore =
    maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100 * 100) / 100 : 0;

  let predicate = "Kurang";
  if (percentageScore >= 85) predicate = "Amat Baik";
  else if (percentageScore >= 75) predicate = "Baik";
  else if (percentageScore >= 60) predicate = "Cukup";

  return {
    totalScore,
    maxPossibleScore,
    percentageScore,
    predicate,
  };
}
