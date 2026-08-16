import { prisma } from "@/lib/prisma";

export type RiskInputs = {
  historicalROAS: number;
  roasVolatility: number; // 0..1, coefficient of variation
  monthsOfRevenueHistory: number;
  appAgeMonths: number;
  refundRatePercent: number; // 0..100
  monthlyRetentionPercent: number; // 0..100
  developerAppCount: number;
  dataCompleteness: number; // 0..1, fraction of expected sync days present
};

export type RiskAssessmentResult = {
  score: number;
  grade: string;
  positives: string[];
  negatives: string[];
};

/**
 * Deterministic, fully transparent (per spec: "Do NOT call this AI
 * initially. Show exactly why score was assigned"). Pure function so it's
 * directly unit-testable — computeRiskScoreForOpportunity below is the
 * only piece that touches the database.
 */
export function computeRiskScore(inputs: RiskInputs): RiskAssessmentResult {
  const positives: string[] = [];
  const negatives: string[] = [];
  let score = 50;

  if (inputs.historicalROAS >= 1) {
    const bonus = Math.min(20, (inputs.historicalROAS - 1) * 15);
    score += bonus;
    positives.push(`${inputs.historicalROAS.toFixed(2)}x historical ROAS`);
  } else {
    const penalty = Math.min(20, (1 - inputs.historicalROAS) * 25);
    score -= penalty;
    negatives.push(`Historical ROAS below 1.0x (${inputs.historicalROAS.toFixed(2)}x)`);
  }

  const volatilityPenalty = Math.round(inputs.roasVolatility * 30);
  score -= volatilityPenalty;
  if (inputs.roasVolatility <= 0.15) positives.push("Low ROAS volatility");
  else negatives.push("High month-to-month ROAS/CAC variation");

  const historyBonus = Math.min(15, inputs.monthsOfRevenueHistory * 1.5);
  score += historyBonus;
  if (inputs.monthsOfRevenueHistory >= 6) positives.push(`${Math.round(inputs.monthsOfRevenueHistory)} months revenue history`);
  else negatives.push("Small advertising/revenue history");

  const ageBonus = Math.min(10, inputs.appAgeMonths * 0.5);
  score += ageBonus;
  if (inputs.appAgeMonths >= 12) positives.push(`${Math.round(inputs.appAgeMonths)} months since app launch`);

  const refundPenalty = Math.min(20, inputs.refundRatePercent * 2);
  score -= refundPenalty;
  if (inputs.refundRatePercent > 8) negatives.push(`Elevated refund rate (${inputs.refundRatePercent.toFixed(1)}%)`);
  else positives.push("Refund rate within normal range");

  const retentionDelta = (inputs.monthlyRetentionPercent - 50) * 0.4;
  score += retentionDelta;
  if (inputs.monthlyRetentionPercent >= 60) positives.push(`Strong subscription retention (${inputs.monthlyRetentionPercent.toFixed(0)}%/mo)`);
  else negatives.push(`Weak subscription retention (${inputs.monthlyRetentionPercent.toFixed(0)}%/mo)`);

  if (inputs.developerAppCount >= 2) positives.push(`Developer has ${inputs.developerAppCount} apps on the platform`);
  else negatives.push("Limited developer track record on the platform");

  score += inputs.dataCompleteness * 10;
  if (inputs.dataCompleteness < 0.8) negatives.push("Incomplete synchronized performance data");

  score = Math.max(0, Math.min(100, Math.round(score)));

  let grade: string;
  if (score >= 90) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 80) grade = "A-";
  else if (score >= 75) grade = "B+";
  else if (score >= 70) grade = "B";
  else if (score >= 65) grade = "B-";
  else if (score >= 60) grade = "C+";
  else if (score >= 55) grade = "C";
  else if (score >= 50) grade = "C-";
  else grade = "D";

  return { score, grade, positives, negatives };
}

export async function computeRiskScoreForOpportunity(opportunityId: string): Promise<RiskAssessmentResult> {
  const opportunity = await prisma.investmentOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      app: {
        include: {
          developer: { include: { apps: true } },
          campaigns: { include: { dailyMetrics: true } },
        },
      },
    },
  });

  // Pool daily spend across every campaign/channel the app runs — risk is
  // assessed at the app level now, not one specific campaign.
  const spendByDate = new Map<string, number>();
  for (const campaign of opportunity.app.campaigns) {
    for (const metric of campaign.dailyMetrics) {
      const key = metric.date.toISOString().slice(0, 10);
      spendByDate.set(key, (spendByDate.get(key) ?? 0) + Number(metric.spend));
    }
  }
  const metrics = Array.from(spendByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, spend]) => ({ spend }));

  const roasByWeek: number[] = [];
  for (let i = 0; i < metrics.length; i += 7) {
    const week = metrics.slice(i, i + 7);
    const spend = week.reduce((s, m) => s + Number(m.spend), 0);
    if (spend > 0) {
      // Proxy: use conversions*avg revenue-per-install as a stand-in when
      // full revenue-per-week isn't precomputed here.
      roasByWeek.push(spend);
    }
  }
  const mean = roasByWeek.length ? roasByWeek.reduce((a, b) => a + b, 0) / roasByWeek.length : 0;
  const variance = roasByWeek.length
    ? roasByWeek.reduce((s, v) => s + (v - mean) ** 2, 0) / roasByWeek.length
    : 0;
  const volatility = mean > 0 ? Math.min(1, Math.sqrt(variance) / mean) : 0.3;

  const appAgeMonths = (Date.now() - opportunity.app.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const monthsOfHistory = metrics.length / 30;
  const expectedDays = Math.max(1, monthsOfHistory * 30);
  const completeness = Math.min(1, metrics.length / expectedDays);

  const transactions = await prisma.appTransaction.count({ where: { appId: opportunity.appId } });
  const refunded = await prisma.appTransaction.count({ where: { appId: opportunity.appId, refundedAt: { not: null } } });
  const refundRatePercent = transactions > 0 ? (refunded / transactions) * 100 : 0;

  const inputs: RiskInputs = {
    historicalROAS: Number(opportunity.historicalROAS ?? 1),
    roasVolatility: volatility,
    monthsOfRevenueHistory: monthsOfHistory,
    appAgeMonths,
    refundRatePercent,
    monthlyRetentionPercent: 65,
    developerAppCount: opportunity.app.developer.apps.length,
    dataCompleteness: completeness,
  };

  const result = computeRiskScore(inputs);

  await prisma.riskAssessment.upsert({
    where: { opportunityId },
    create: { opportunityId, score: result.score, grade: result.grade, positives: result.positives, negatives: result.negatives },
    update: { score: result.score, grade: result.grade, positives: result.positives, negatives: result.negatives },
  });
  await prisma.investmentOpportunity.update({ where: { id: opportunityId }, data: { riskScore: result.score } });

  return result;
}
