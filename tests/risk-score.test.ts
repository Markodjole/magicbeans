import { describe, expect, it } from "vitest";
import { computeRiskScore } from "@/lib/engine/risk-score";

const STRONG_INPUTS = {
  historicalROAS: 2.2,
  roasVolatility: 0.1,
  monthsOfRevenueHistory: 12,
  appAgeMonths: 24,
  refundRatePercent: 2,
  monthlyRetentionPercent: 70,
  developerAppCount: 3,
  dataCompleteness: 1,
};

const WEAK_INPUTS = {
  historicalROAS: 0.7,
  roasVolatility: 0.6,
  monthsOfRevenueHistory: 1,
  appAgeMonths: 2,
  refundRatePercent: 15,
  monthlyRetentionPercent: 35,
  developerAppCount: 1,
  dataCompleteness: 0.4,
};

describe("computeRiskScore", () => {
  it("is deterministic — same inputs always produce the same score", () => {
    const a = computeRiskScore(STRONG_INPUTS);
    const b = computeRiskScore(STRONG_INPUTS);
    expect(a).toEqual(b);
  });

  it("scores a strong app higher than a weak app", () => {
    const strong = computeRiskScore(STRONG_INPUTS);
    const weak = computeRiskScore(WEAK_INPUTS);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("keeps the score within 0-100", () => {
    expect(computeRiskScore(STRONG_INPUTS).score).toBeLessThanOrEqual(100);
    expect(computeRiskScore(WEAK_INPUTS).score).toBeGreaterThanOrEqual(0);
  });

  it("explains itself with concrete positives/negatives", () => {
    const result = computeRiskScore(STRONG_INPUTS);
    expect(result.positives.length).toBeGreaterThan(0);
    expect(result.positives.some((p) => p.includes("ROAS"))).toBe(true);
  });

  it("flags a below-1.0x ROAS as a named negative", () => {
    const result = computeRiskScore(WEAK_INPUTS);
    expect(result.negatives.some((n) => n.toLowerCase().includes("roas"))).toBe(true);
  });
});
