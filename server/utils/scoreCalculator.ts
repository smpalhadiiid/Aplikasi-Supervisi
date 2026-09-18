export interface ScoreSummary {
  totalScore: number;
  maxPossibleScore: number;
  percentageScore: number;
  predicate: string;
  isComplete: boolean;
  status: 'COMPLETED' | 'BELUM LENGKAP';
}

export function calculateRppScore(
  itemScores: Record<string, { score: number; is_active?: boolean }>,
  maxPerItem = 3
): ScoreSummary {
  let totalScore = 0;
  let maxPossibleScore = 0;
  let hasIncompleteItems = false;
  let activeItemCount = 0;

  for (const [_, item] of Object.entries(itemScores)) {
    if (item.is_active === false) continue;
    activeItemCount++;

    const rawScore = item.score;
    // Jika belum dinilai atau 0
    if (rawScore === undefined || rawScore === null || rawScore === 0) {
      hasIncompleteItems = true;
      maxPossibleScore += maxPerItem;
      continue;
    }

    const score = Math.max(1, Math.min(maxPerItem, Math.round(rawScore)));
    totalScore += score;
    maxPossibleScore += maxPerItem;
  }

  if (activeItemCount === 0 || hasIncompleteItems) {
    const percentageScore =
      maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100 * 100) / 100 : 0;
    return {
      totalScore,
      maxPossibleScore,
      percentageScore,
      predicate: "Belum Lengkap",
      isComplete: false,
      status: "BELUM LENGKAP",
    };
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
    isComplete: true,
    status: "COMPLETED",
  };
}

export function calculateSupervisionScore(
  itemScores: Record<string, { score: number; is_active?: boolean }>,
  maxPerItem = 4
): ScoreSummary {
  let totalScore = 0;
  let maxPossibleScore = 0;
  let hasIncompleteItems = false;
  let activeItemCount = 0;

  for (const [_, item] of Object.entries(itemScores)) {
    if (item.is_active === false) continue;
    activeItemCount++;

    const rawScore = item.score;
    if (rawScore === undefined || rawScore === null || rawScore === 0) {
      hasIncompleteItems = true;
      maxPossibleScore += maxPerItem;
      continue;
    }

    const score = Math.max(1, Math.min(maxPerItem, Math.round(rawScore)));
    totalScore += score;
    maxPossibleScore += maxPerItem;
  }

  if (activeItemCount === 0 || hasIncompleteItems) {
    const percentageScore =
      maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100 * 100) / 100 : 0;
    return {
      totalScore,
      maxPossibleScore,
      percentageScore,
      predicate: "Belum Lengkap",
      isComplete: false,
      status: "BELUM LENGKAP",
    };
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
    isComplete: true,
    status: "COMPLETED",
  };
}

/**
 * Perhitungan skor gabungan terbobot:
 * Nilai Akhir = (bobot_rpp * skor_rpp + bobot_supervisi * skor_supervisi) / 100
 */
export function calculateCompositeScore(
  rppScore: number,
  supScore: number,
  rppWeight: number = 40,
  supWeight: number = 60
): { compositeScore: number; predicate: string; status: 'COMPLETED' | 'BELUM LENGKAP' } {
  if (rppScore <= 0 && supScore <= 0) {
    return {
      compositeScore: 0,
      predicate: 'Belum Lengkap',
      status: 'BELUM LENGKAP',
    };
  }

  let compositeScore = 0;
  if (rppScore > 0 && supScore > 0) {
    const totalWeight = rppWeight + supWeight;
    compositeScore =
      Math.round(((rppScore * rppWeight + supScore * supWeight) / totalWeight) * 10) / 10;
  } else if (rppScore > 0) {
    compositeScore = Math.round(rppScore * 10) / 10;
  } else if (supScore > 0) {
    compositeScore = Math.round(supScore * 10) / 10;
  }

  let predicate = "Perlu Pembinaan";
  if (compositeScore >= 85) predicate = "Amat Baik";
  else if (compositeScore >= 75) predicate = "Baik";
  else if (compositeScore >= 60) predicate = "Cukup";

  return {
    compositeScore,
    predicate,
    status: "COMPLETED",
  };
}

