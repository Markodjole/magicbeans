import { describe, expect, it } from "vitest";
import {
  applyRevenueWaterfall,
  applyReturnCap,
  eligibleAttributedAmount,
  isEligibleConfidence,
  splitRevenueShare,
} from "@/lib/engine/revenue-share";

describe("splitRevenueShare", () => {
  it("matches the spec's core example: $2,000 revenue at 70/30 split", () => {
    const { investorShare, developerShare } = splitRevenueShare(2000, 70, 30);
    expect(investorShare).toBe(1400);
    expect(developerShare).toBe(600);
  });

  it("rounds to cents", () => {
    const { investorShare, developerShare } = splitRevenueShare(100, 33.33, 66.67);
    expect(investorShare).toBe(33.33);
    expect(developerShare).toBe(66.67);
  });
});

describe("isEligibleConfidence / eligibleAttributedAmount", () => {
  it("HIGH and MEDIUM are eligible by default", () => {
    expect(isEligibleConfidence("HIGH")).toBe(true);
    expect(isEligibleConfidence("MEDIUM")).toBe(true);
  });

  it("LOW and UNATTRIBUTED are not eligible by default", () => {
    expect(isEligibleConfidence("LOW")).toBe(false);
    expect(isEligibleConfidence("UNATTRIBUTED")).toBe(false);
  });

  it("zeroes out attributed amount for ineligible confidence", () => {
    expect(eligibleAttributedAmount(500, "LOW")).toBe(0);
    expect(eligibleAttributedAmount(500, "UNATTRIBUTED")).toBe(0);
    expect(eligibleAttributedAmount(500, "HIGH")).toBe(500);
  });
});

describe("applyReturnCap", () => {
  it("pays out in full when well under the cap", () => {
    const result = applyReturnCap({
      principalAmount: 1000,
      returnCapMultiple: 1.5,
      investorRevenueEarnedSoFar: 0,
      proposedInvestorAmount: 500,
    });
    expect(result.payableAmount).toBe(500);
    expect(result.capReached).toBe(false);
    expect(result.maxPayable).toBe(1500);
  });

  it("caps payout at principal * returnCapMultiple and flags cap reached", () => {
    // principal $1,000, cap 1.5x -> max payable $1,500
    const result = applyReturnCap({
      principalAmount: 1000,
      returnCapMultiple: 1.5,
      investorRevenueEarnedSoFar: 1400,
      proposedInvestorAmount: 300,
    });
    expect(result.payableAmount).toBe(100); // only 100 left before hitting 1500
    expect(result.capReached).toBe(true);
  });

  it("never pays anything once the cap has already been fully reached", () => {
    const result = applyReturnCap({
      principalAmount: 1000,
      returnCapMultiple: 1.5,
      investorRevenueEarnedSoFar: 1500,
      proposedInvestorAmount: 200,
    });
    expect(result.payableAmount).toBe(0);
    expect(result.capReached).toBe(true);
  });

  it("never produces a negative payable amount for a negative proposal (e.g. from a reversal)", () => {
    const result = applyReturnCap({
      principalAmount: 1000,
      returnCapMultiple: 1.5,
      investorRevenueEarnedSoFar: 500,
      proposedInvestorAmount: -50,
    });
    expect(result.payableAmount).toBe(0);
  });
});

describe("applyRevenueWaterfall — recoup principal first, then split only the profit", () => {
  it("pays 100% to the investor while still below principal (no split yet)", () => {
    // $1,000 principal, only $400 of revenue arrives -> all of it is recoupment.
    const result = applyRevenueWaterfall({
      slice: 400,
      principalAmount: 1000,
      returnCapMultiple: 5,
      investorSharePercent: 70,
      developerSharePercent: 30,
      investorRevenueEarnedSoFar: 0,
    });
    expect(result.investorAmount).toBe(400);
    expect(result.developerAmount).toBe(0);
  });

  it("splits only the portion above principal once recoupment completes mid-transaction", () => {
    // $1,000 principal, $2,000 revenue in one event: $1,000 recoups
    // principal (100% investor), remaining $1,000 splits 70/30.
    const result = applyRevenueWaterfall({
      slice: 2000,
      principalAmount: 1000,
      returnCapMultiple: 5, // high enough not to bind
      investorSharePercent: 70,
      developerSharePercent: 30,
      investorRevenueEarnedSoFar: 0,
    });
    expect(result.investorAmount).toBe(1700); // 1000 recoup + 700 (70% of 1000 profit)
    expect(result.developerAmount).toBe(300); // 30% of 1000 profit
  });

  it("splits the whole slice by percentage once principal was already recouped by a prior event", () => {
    const result = applyRevenueWaterfall({
      slice: 500,
      principalAmount: 1000,
      returnCapMultiple: 5,
      investorSharePercent: 70,
      developerSharePercent: 30,
      investorRevenueEarnedSoFar: 1000, // already fully recouped
    });
    expect(result.investorAmount).toBe(350);
    expect(result.developerAmount).toBe(150);
  });

  it("still respects the return cap on top of the waterfall", () => {
    // $1,000 principal, 1.2x cap -> max payable $1,200. A $2,000 slice
    // would propose $1,700 (as above), but must clip to $1,200.
    const result = applyRevenueWaterfall({
      slice: 2000,
      principalAmount: 1000,
      returnCapMultiple: 1.2,
      investorSharePercent: 70,
      developerSharePercent: 30,
      investorRevenueEarnedSoFar: 0,
    });
    expect(result.investorAmount).toBe(1200);
    expect(result.capReached).toBe(true);
    // Developer's share of the profit portion is NOT reduced by the investor's cap.
    expect(result.developerAmount).toBe(300);
  });
});
