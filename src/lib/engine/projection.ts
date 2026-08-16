/**
 * Whole-campaign bear/base/bull projections (previously persisted per
 * InvestmentOpportunity via a targetAmount) were dropped in favor of the
 * per-investor "if I put in $X" calculator, which needs no target amount
 * and no persisted row — see src/lib/engine/projection-math.ts, which
 * this re-exports for convenience/back-compat of existing imports.
 */
export { computeProjection, estimateInvestorReturn } from "./projection-math";
export type { ProjectionInputs, ProjectionResult, InvestorReturnEstimate } from "./projection-math";
