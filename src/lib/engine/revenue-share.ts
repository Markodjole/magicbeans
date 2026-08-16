import { ELIGIBLE_ATTRIBUTION_CONFIDENCES } from "@/lib/config";
import type { AttributionConfidence } from "@/generated/prisma/client";

/**
 * Pure, centralized revenue-share math. Every page and every job that
 * needs "how much does the investor get" must call through here — never
 * reimplement the multiplication inline. Kept dependency-free (no Prisma)
 * so it's directly unit-testable.
 */

export function isEligibleConfidence(confidence: AttributionConfidence): boolean {
  return (ELIGIBLE_ATTRIBUTION_CONFIDENCES as readonly string[]).includes(confidence);
}

export function eligibleAttributedAmount(attributedAmount: number, confidence: AttributionConfidence): number {
  return isEligibleConfidence(confidence) ? attributedAmount : 0;
}

export function splitRevenueShare(
  eligibleAmount: number,
  investorSharePercent: number,
  developerSharePercent: number
): { investorShare: number; developerShare: number } {
  return {
    investorShare: round2(eligibleAmount * (investorSharePercent / 100)),
    developerShare: round2(eligibleAmount * (developerSharePercent / 100)),
  };
}

/**
 * Caps what an investor can actually be paid against principal * returnCapMultiple.
 * Never lets cumulative investor earnings exceed the cap, and reports
 * whether this application of revenue reaches (or was already at) the cap
 * so callers can transition the investment to COMPLETED.
 */
export function applyReturnCap(params: {
  principalAmount: number;
  returnCapMultiple: number;
  investorRevenueEarnedSoFar: number;
  proposedInvestorAmount: number;
}): { payableAmount: number; capReached: boolean; maxPayable: number } {
  const { principalAmount, returnCapMultiple, investorRevenueEarnedSoFar, proposedInvestorAmount } = params;
  const maxPayable = round2(principalAmount * returnCapMultiple);
  const remaining = Math.max(0, round2(maxPayable - investorRevenueEarnedSoFar));
  const payableAmount = round2(Math.min(Math.max(0, proposedInvestorAmount), remaining));
  const capReached = round2(investorRevenueEarnedSoFar + payableAmount) >= maxPayable;
  return { payableAmount, capReached, maxPayable };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The actual payout waterfall: an investor is repaid their own principal
 * in full — 100% of attributed revenue, no split — before any
 * profit-sharing percentage applies. Only revenue above what it takes to
 * recoup principal is split investor/developer. This is what makes a
 * "bear case" scenario mean something honest: as long as attributed
 * revenue for this investment reaches its principal, the investor is at
 * least whole, not already down 30-35% to a split that started from
 * dollar one. `investorRevenueEarnedSoFar` already includes both the
 * recoupment portion and any profit-share portion paid so far, so
 * "how much principal is still outstanding" is just
 * `principal - investorRevenueEarnedSoFar` — no separate field needed.
 */
export function applyRevenueWaterfall(params: {
  /** This investment's weighted slice of eligible revenue for one transaction (before any split). */
  slice: number;
  principalAmount: number;
  returnCapMultiple: number;
  /** Percent of PROFIT (revenue above recouped principal) that goes to the investor. */
  investorSharePercent: number;
  developerSharePercent: number;
  investorRevenueEarnedSoFar: number;
}): { investorAmount: number; developerAmount: number; capReached: boolean; maxPayable: number } {
  const { slice, principalAmount, returnCapMultiple, investorSharePercent, developerSharePercent, investorRevenueEarnedSoFar } =
    params;

  const remainingToRecoup = Math.max(0, round2(principalAmount - investorRevenueEarnedSoFar));
  const recoupPortion = Math.min(slice, remainingToRecoup);
  const profitPortion = round2(slice - recoupPortion);

  const { investorShare: investorProfitShare, developerShare: developerAmount } = splitRevenueShare(
    profitPortion,
    investorSharePercent,
    developerSharePercent
  );

  const proposedInvestorAmount = round2(recoupPortion + investorProfitShare);
  const cap = applyReturnCap({ principalAmount, returnCapMultiple, investorRevenueEarnedSoFar, proposedInvestorAmount });

  return {
    investorAmount: cap.payableAmount,
    developerAmount,
    capReached: cap.capReached,
    maxPayable: cap.maxPayable,
  };
}
