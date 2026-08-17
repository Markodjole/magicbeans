import { prisma } from "@/lib/prisma";

/**
 * Read-only query helpers for the public marketplace (home page,
 * /opportunities list, /opportunities/[id] detail). Nothing here mutates
 * data or computes financial numbers — those are all pre-persisted by the
 * engine; this layer just shapes them for display.
 */

export async function listOpportunities(params?: { category?: string }) {
  return prisma.investmentOpportunity.findMany({
    where: {
      status: "OPEN",
      ...(params?.category ? { app: { category: params.category } } : {}),
    },
    include: {
      app: { include: { developer: true } },
      riskAssessment: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOpportunityDetail(opportunityId: string) {
  const opportunity = await prisma.investmentOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      app: {
        include: {
          developer: true,
          campaigns: { include: { dailyMetrics: { orderBy: { date: "asc" } }, advertisingAccount: true } },
        },
      },
      riskAssessment: true,
      investments: { select: { id: true, principalAmount: true, status: true } },
    },
  });
  if (!opportunity) return null;

  const campaigns = opportunity.app.campaigns;
  const campaignIds = campaigns.map((c) => c.id);

  const revenueAttributions = campaignIds.length
    ? await prisma.revenueAttribution.findMany({
        where: { campaignId: { in: campaignIds }, reversedAt: null },
        include: { transaction: { select: { purchasedAt: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const totalAttributedRevenue = revenueAttributions.reduce((s, r) => s + Number(r.attributedAmount), 0);
  const totalSpend = campaigns.reduce((s, c) => s + c.dailyMetrics.reduce((s2, m) => s2 + Number(m.spend), 0), 0);
  const totalInstalls = campaignIds.length
    ? await prisma.attributedInstall.count({ where: { campaignId: { in: campaignIds } } })
    : 0;
  const payingCustomers = campaignIds.length
    ? await prisma.appTransaction
        .findMany({
          where: { revenueAttributions: { some: { campaignId: { in: campaignIds }, reversedAt: null } } },
          select: { appCustomerId: true },
          distinct: ["appCustomerId"],
        })
        .then((rows) => rows.length)
    : 0;

  const revenueByDay = new Map<string, number>();
  for (const r of revenueAttributions) {
    const key = r.transaction.purchasedAt.toISOString().slice(0, 10);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(r.attributedAmount));
  }
  const spendByDay = new Map<string, number>();
  for (const campaign of campaigns) {
    for (const metric of campaign.dailyMetrics) {
      const key = metric.date.toISOString().slice(0, 10);
      spendByDay.set(key, (spendByDay.get(key) ?? 0) + Number(metric.spend));
    }
  }
  const dailySeries = Array.from(spendByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, spend]) => ({ date, spend, revenue: Math.round((revenueByDay.get(date) ?? 0) * 100) / 100 }));

  return {
    opportunity,
    campaigns,
    stats: {
      totalSpend,
      totalAttributedRevenue,
      totalInstalls,
      payingCustomers,
      roas: totalSpend > 0 ? totalAttributedRevenue / totalSpend : 0,
    },
    dailySeries,
  };
}

export async function listPerformanceOffers(params?: { category?: string }) {
  return prisma.performanceOffer.findMany({
    where: {
      status: "OPEN",
      ...(params?.category ? { app: { category: params.category } } : {}),
    },
    include: { app: { include: { developer: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPerformanceOfferDetail(offerId: string) {
  return prisma.performanceOffer.findUnique({
    where: { id: offerId },
    include: {
      app: { include: { developer: true } },
      creatives: true,
      targetingTemplates: true,
    },
  });
}

export async function getMarketplaceStats() {
  const [totalFunded, activeOpportunities, totalInvestors, totalDevelopers] = await Promise.all([
    prisma.investmentOpportunity.aggregate({ _sum: { amountFunded: true } }),
    prisma.investmentOpportunity.count({ where: { status: "OPEN" } }),
    prisma.investorProfile.count(),
    prisma.developerProfile.count(),
  ]);
  return {
    totalFunded: Number(totalFunded._sum.amountFunded ?? 0),
    activeOpportunities,
    totalInvestors,
    totalDevelopers,
  };
}

export async function getFeaturedOpportunities(limit = 3) {
  return prisma.investmentOpportunity.findMany({
    where: { status: "OPEN" },
    include: { app: true, riskAssessment: true },
    orderBy: { historicalROAS: "desc" },
    take: limit,
  });
}
