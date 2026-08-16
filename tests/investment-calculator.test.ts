import { describe, expect, it } from "vitest";
import { estimateInvestorReturn } from "@/lib/engine/projection-math";

describe("estimateInvestorReturn (per-investment calculator)", () => {
  it("recoups principal first, then splits only the profit above it", () => {
    // $50 at 2.0x ROAS -> $100 base revenue. $50 of that repays principal
    // (100% to investor), leaving $50 profit split 70/30 -> +$35.
    // Investor total = $50 + $35 = $85, well under a 3x ($150) cap.
    const result = estimateInvestorReturn({
      amount: 50,
      historicalROAS: 2.0,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 3,
    });
    expect(result.base).toBe(85);
    expect(result.capApplied).toBe(false);
  });

  it("never shows an estimate above the contractual return cap", () => {
    // $50 at a high ROAS would propose way more than a 1.2x cap ($60) allows.
    const result = estimateInvestorReturn({
      amount: 50,
      historicalROAS: 5,
      investorRevenueSharePercent: 90,
      returnCapMultiple: 1.2,
    });
    expect(result.maxPayable).toBe(60);
    expect(result.bear).toBeLessThanOrEqual(60);
    expect(result.base).toBeLessThanOrEqual(60);
    expect(result.bull).toBeLessThanOrEqual(60);
    expect(result.capApplied).toBe(true);
  });

  it("bear <= base <= bull before any cap is applied", () => {
    const result = estimateInvestorReturn({
      amount: 200,
      historicalROAS: 1.5,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 10, // high enough the cap never binds
    });
    expect(result.bear).toBeLessThanOrEqual(result.base);
    expect(result.base).toBeLessThanOrEqual(result.bull);
  });

  it("does not show a net loss once even the bear case clears principal", () => {
    // $50 at 1.76x ROAS, 65% share, 1.56x cap (StudySprint's real revised
    // terms). Bear revenue = 50 * 1.76 * 0.6 = $52.80, which is still
    // above the $50 principal, so the investor should come out ahead
    // even in the bear case, not underwater from a straight split.
    const result = estimateInvestorReturn({
      amount: 50,
      historicalROAS: 1.76,
      investorRevenueSharePercent: 65,
      returnCapMultiple: 1.56,
    });
    expect(result.bear).toBeGreaterThan(50);
  });

  it("scales linearly with the proposed amount", () => {
    const small = estimateInvestorReturn({
      amount: 50,
      historicalROAS: 1.8,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 10,
    });
    const big = estimateInvestorReturn({
      amount: 500,
      historicalROAS: 1.8,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 10,
    });
    expect(big.base).toBeCloseTo(small.base * 10, 5);
  });
});
