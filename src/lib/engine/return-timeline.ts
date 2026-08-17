import { prisma } from "@/lib/prisma";
import { applyRevenueWaterfall, round2 } from "./revenue-share";

/**
 * "If I invest $X today, roughly how much would I have back by day 7 / 30
 * / 6 months / 1 year?" — extends the existing bear/base/bull calculator
 * (projection-math.ts) with a time axis, derived from this app's OWN
 * observed revenue-timing curve rather than an invented decay curve.
 *
 * Method: walk this app's real attributed-revenue-by-day history to get
 * what fraction of eventual revenue typically arrives within N days of
 * the marketing history's start, then apply that same fraction to the
 * base-case projection (amount * historicalROAS) and run it through the
 * real recoup-then-split waterfall. Horizons beyond the observed history
 * window are extrapolated from the trailing 30-day daily rate and marked
 * `extrapolated: true` — never silently presented as observed fact.
 *
 * Separately, avgDaysToRecoupPrincipal/avgDaysToReturnCap are NOT a
 * projection — they're measured directly from this app's real investments
 * (any terms vintage) via their actual RevenueShareAccrual timestamps.
 * Null when no investment has reached that milestone yet.
 */

const HORIZONS_DAYS = [7, 30, 182, 365] as const;
const HORIZON_LABELS: Record<number, string> = {
  7: "7 days",
  30: "30 days",
  182: "6 months",
  365: "1 year",
};

export type ReturnTimelinePoint = {
  days: number;
  label: string;
  projectedInvestorReturn: number;
  extrapolated: boolean;
};

export type ReturnTimelineSeriesPoint = {
  day: number;
  cumulativeReturn: number;
  extrapolated: boolean;
};

export type ReturnTimeline = {
  referenceAmount: number;
  points: ReturnTimelinePoint[];
  series: ReturnTimelineSeriesPoint[];
  returnCapDollarAmount: number;
  observedHistoryDays: number;
  historicalCAC: number | null;
  avgDaysToRecoupPrincipal: number | null;
  avgDaysToReturnCap: number | null;
  investmentsAnalyzed: number;
};

export async function computeReturnTimeline(
  opportunityId: string,
  referenceAmount = 100
): Promise<ReturnTimeline | null> {
  const opportunity = await prisma.investmentOpportunity.findUnique({
    where: { id: opportunityId },
    include: { app: { include: { campaigns: { select: { id: true } } } } },
  });
  if (!opportunity) return null;

  const campaignIds = opportunity.app.campaigns.map((c) => c.id);
  if (campaignIds.length === 0) return null;

  const [dailyMetrics, revenueAttributions] = await Promise.all([
    prisma.campaignDailyMetric.findMany({
      where: { campaignId: { in: campaignIds } },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    prisma.revenueAttribution.findMany({
      where: { campaignId: { in: campaignIds }, reversedAt: null },
      include: { transaction: { select: { purchasedAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (dailyMetrics.length === 0 || revenueAttributions.length === 0) return null;

  const historyStart = dailyMetrics[0].date;
  const totalRevenue = revenueAttributions.reduce((s, r) => s + Number(r.attributedAmount), 0);
  if (totalRevenue <= 0) return null;

  const revenueByDayOffset = new Map<number, number>();
  let maxOffset = 0;
  for (const r of revenueAttributions) {
    const offset = Math.max(0, Math.floor((r.transaction.purchasedAt.getTime() - historyStart.getTime()) / 86_400_000));
    revenueByDayOffset.set(offset, (revenueByDayOffset.get(offset) ?? 0) + Number(r.attributedAmount));
    if (offset > maxOffset) maxOffset = offset;
  }

  const cumByDay = new Float64Array(maxOffset + 1);
  let running = 0;
  for (let d = 0; d <= maxOffset; d++) {
    running += revenueByDayOffset.get(d) ?? 0;
    cumByDay[d] = running;
  }
  const observedHistoryDays = maxOffset + 1;

  const tailWindow = Math.min(30, observedHistoryDays);
  const tailStartIdx = observedHistoryDays - tailWindow;
  const tailRevenue = cumByDay[observedHistoryDays - 1] - (tailStartIdx > 0 ? cumByDay[tailStartIdx - 1] : 0);
  const dailyRateTail = tailWindow > 0 ? tailRevenue / tailWindow : 0;

  function fractionAtDay(day: number): { fraction: number; extrapolated: boolean } {
    if (day <= 0) return { fraction: 0, extrapolated: false };
    if (day <= observedHistoryDays - 1) {
      return { fraction: cumByDay[day] / totalRevenue, extrapolated: false };
    }
    const extraDays = day - (observedHistoryDays - 1);
    const extrapolatedRevenue = cumByDay[observedHistoryDays - 1] + dailyRateTail * extraDays;
    return { fraction: extrapolatedRevenue / totalRevenue, extrapolated: true };
  }

  const historicalROAS = Number(opportunity.historicalROAS ?? 0);
  const investorSharePercent = Number(opportunity.investorRevenueSharePercent);
  const developerSharePercent = Number(opportunity.developerRevenueSharePercent);
  const returnCapMultiple = Number(opportunity.returnCapMultiple);

  function projectedReturnAtDay(day: number): { investorAmount: number; extrapolated: boolean } {
    const { fraction, extrapolated } = fractionAtDay(day);
    const revenueAtDay = referenceAmount * historicalROAS * fraction;
    const waterfall = applyRevenueWaterfall({
      slice: revenueAtDay,
      principalAmount: referenceAmount,
      returnCapMultiple,
      investorSharePercent,
      developerSharePercent,
      investorRevenueEarnedSoFar: 0,
    });
    return { investorAmount: waterfall.investorAmount, extrapolated };
  }

  const points: ReturnTimelinePoint[] = HORIZONS_DAYS.map((days) => {
    const { investorAmount, extrapolated } = projectedReturnAtDay(days);
    return { days, label: HORIZON_LABELS[days], projectedInvestorReturn: investorAmount, extrapolated };
  });

  const SERIES_STEP_DAYS = 5;
  const SERIES_END_DAY = 365;
  const series: ReturnTimelineSeriesPoint[] = [];
  for (let day = 0; day <= SERIES_END_DAY; day += SERIES_STEP_DAYS) {
    const { investorAmount, extrapolated } = projectedReturnAtDay(day);
    series.push({ day, cumulativeReturn: round2(investorAmount), extrapolated });
  }
  if (series[series.length - 1].day !== SERIES_END_DAY) {
    const { investorAmount, extrapolated } = projectedReturnAtDay(SERIES_END_DAY);
    series.push({ day: SERIES_END_DAY, cumulativeReturn: round2(investorAmount), extrapolated });
  }

  const investments = await prisma.investment.findMany({
    where: { opportunity: { appId: opportunity.appId } },
    include: {
      opportunity: { select: { returnCapMultiple: true } },
      revenueShareAccruals: { where: { reversedAt: null }, orderBy: { accruedAt: "asc" } },
    },
  });

  const recoupDays: number[] = [];
  const capDays: number[] = [];
  for (const inv of investments) {
    const principal = Number(inv.principalAmount);
    const capAmount = principal * Number(inv.opportunity.returnCapMultiple);
    let cum = 0;
    let recoupedAt: Date | null = null;
    let cappedAt: Date | null = null;
    for (const accrual of inv.revenueShareAccruals) {
      cum += Number(accrual.investorAmount);
      if (!recoupedAt && cum >= principal) recoupedAt = accrual.accruedAt;
      if (!cappedAt && cum >= capAmount) cappedAt = accrual.accruedAt;
    }
    if (recoupedAt) recoupDays.push((recoupedAt.getTime() - inv.createdAt.getTime()) / 86_400_000);
    if (cappedAt) capDays.push((cappedAt.getTime() - inv.createdAt.getTime()) / 86_400_000);
  }

  const avg = (arr: number[]) => (arr.length ? round2(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

  return {
    referenceAmount,
    points,
    series,
    returnCapDollarAmount: round2(referenceAmount * returnCapMultiple),
    observedHistoryDays,
    historicalCAC: opportunity.historicalCAC ? Number(opportunity.historicalCAC) : null,
    avgDaysToRecoupPrincipal: avg(recoupDays),
    avgDaysToReturnCap: avg(capDays),
    investmentsAnalyzed: investments.length,
  };
}
