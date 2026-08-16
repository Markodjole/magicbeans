import { applyRevenueWaterfall, round2 } from "./revenue-share";

/**
 * Pure projection math — deliberately has ZERO imports of Prisma or
 * anything server-only, so it's safe to import directly into client
 * components (e.g. a live "what would I get back" calculator on the
 * invest form). projection.ts's computeProjectionForOpportunity wraps
 * this with a database read/write; that half must stay server-only.
 */

export type ProjectionInputs = {
  spendAmount: number;
  historicalROAS: number;
};

export type ProjectionResult = {
  spendAmount: number;
  bearRevenue: number;
  baseRevenue: number;
  bullRevenue: number;
};

// Fixed downside/upside band applied to the base (spend * historicalROAS)
// case. Single source of truth — the per-investment calculator and the
// whole-campaign projection must never drift apart.
export const PROJECTION_BEAR_MULTIPLIER = 0.6;
export const PROJECTION_BULL_MULTIPLIER = 1.36;

/**
 * Simple, explainable simulation (per spec: "Implement a simple
 * projection engine before machine learning"). Base case extrapolates
 * historical ROAS directly; bear/bull apply a fixed downside/upside band.
 * Always labeled "Projection — not guaranteed" wherever rendered — never
 * described as a promised return.
 */
export function computeProjection(inputs: ProjectionInputs): ProjectionResult {
  const base = inputs.spendAmount * inputs.historicalROAS;
  return {
    spendAmount: round2(inputs.spendAmount),
    bearRevenue: round2(base * PROJECTION_BEAR_MULTIPLIER),
    baseRevenue: round2(base),
    bullRevenue: round2(base * PROJECTION_BULL_MULTIPLIER),
  };
}

export type InvestorReturnEstimate = {
  bear: number;
  base: number;
  bull: number;
  maxPayable: number;
  capApplied: boolean;
};

/**
 * "If I put in $X, what might I get back?" — scales the campaign-level
 * projection down to one investor's proposed contribution and runs it
 * through the same recoup-then-split waterfall the real engine uses
 * (applyRevenueWaterfall): 100% of attributed revenue repays principal
 * first, then only revenue above that splits by the investor's
 * percentage, capped at their contractual return cap. This does NOT
 * account for dilution from other investors joining the same campaign
 * later — it's an upper-bound personal estimate assuming this
 * contribution's proportional share of the campaign's attributed
 * revenue, not a promise.
 */
export function estimateInvestorReturn(params: {
  amount: number;
  historicalROAS: number;
  investorRevenueSharePercent: number;
  returnCapMultiple: number;
}): InvestorReturnEstimate {
  const { amount, historicalROAS, investorRevenueSharePercent, returnCapMultiple } = params;
  const projection = computeProjection({ spendAmount: amount, historicalROAS });

  // A fresh investment: nothing recouped yet, so each scenario is
  // evaluated as if its whole revenue figure arrived in one event.
  const waterfallFor = (revenue: number) =>
    applyRevenueWaterfall({
      slice: revenue,
      principalAmount: amount,
      returnCapMultiple,
      investorSharePercent: investorRevenueSharePercent,
      developerSharePercent: 100 - investorRevenueSharePercent,
      investorRevenueEarnedSoFar: 0,
    });

  const bear = waterfallFor(projection.bearRevenue);
  const base = waterfallFor(projection.baseRevenue);
  const bull = waterfallFor(projection.bullRevenue);

  return {
    bear: bear.investorAmount,
    base: base.investorAmount,
    bull: bull.investorAmount,
    maxPayable: bull.maxPayable,
    capApplied: bull.capReached,
  };
}
