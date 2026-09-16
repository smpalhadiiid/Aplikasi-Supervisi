import { describe, it, expect } from "vitest";
import { calculateRppScore, calculateSupervisionScore } from "./scoreCalculator";

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
  });
});
