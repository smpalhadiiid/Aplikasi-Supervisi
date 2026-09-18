import { describe, it, expect } from "vitest";
import {
  calculateRppScore,
  calculateSupervisionScore,
  calculateCompositeScore,
} from "./scoreCalculator";

describe("Score Calculator Utilities", () => {
  it("calculates RPP percentage and predicate correctly", () => {
    const items = {
      i1: { score: 3, is_active: true },
      i2: { score: 3, is_active: true },
      i3: { score: 3, is_active: true },
    };

    const res = calculateRppScore(items, 3);
    expect(res.totalScore).toBe(9);
    expect(res.maxPossibleScore).toBe(9);
    expect(res.percentageScore).toBe(100);
    expect(res.predicate).toBe("Sangat Baik (SB)");
    expect(res.isComplete).toBe(true);
  });

  it("assigns Cukup predicate when percentage is between 71 and 80", () => {
    const items = {
      i1: { score: 2, is_active: true },
      i2: { score: 2, is_active: true },
      i3: { score: 3, is_active: true },
    };

    const res = calculateRppScore(items, 3); // 7 / 9 = 77.78%
    expect(res.percentageScore).toBe(77.78);
    expect(res.predicate).toBe("Cukup (C)");
    expect(res.isComplete).toBe(true);
  });

  it("marks predicate as 'Belum Lengkap' if any indicator has 0 or empty score", () => {
    const incompleteItems = {
      i1: { score: 3, is_active: true },
      i2: { score: 0, is_active: true }, // uncompleted
    };

    const res = calculateRppScore(incompleteItems, 3);
    expect(res.isComplete).toBe(false);
    expect(res.predicate).toBe("Belum Lengkap");
    expect(res.status).toBe("BELUM LENGKAP");
  });

  it("calculates Supervision score with max item score 4", () => {
    const items = {
      i1: { score: 4, is_active: true },
      i2: { score: 3, is_active: true },
    };

    const res = calculateSupervisionScore(items, 4); // 7 / 8 = 87.5%
    expect(res.totalScore).toBe(7);
    expect(res.maxPossibleScore).toBe(8);
    expect(res.percentageScore).toBe(87.5);
    expect(res.predicate).toBe("Amat Baik");
    expect(res.isComplete).toBe(true);
  });

  it("calculates weighted composite score: 40% RPP + 60% Supervisi", () => {
    // 80 * 0.4 + 90 * 0.6 = 32 + 54 = 86 -> Amat Baik
    const composite = calculateCompositeScore(80, 90, 40, 60);
    expect(composite.compositeScore).toBe(86);
    expect(composite.predicate).toBe("Amat Baik");

    // When both are 0, status must be Belum Lengkap, not Perlu Pembinaan
    const emptyScore = calculateCompositeScore(0, 0, 40, 60);
    expect(emptyScore.predicate).toBe("Belum Lengkap");
    expect(emptyScore.status).toBe("BELUM LENGKAP");
  });

  it("handles inactive items correctly without counting them in max score", () => {
    const items = {
      i1: { score: 3, is_active: true },
      i2: { score: 1, is_active: false },
    };

    const res = calculateRppScore(items, 3);
    expect(res.totalScore).toBe(3);
    expect(res.maxPossibleScore).toBe(3);
    expect(res.percentageScore).toBe(100);
    expect(res.isComplete).toBe(true);
  });
});

