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

/**
 * Every real past/active campaign launched against this offer, with its
 * actual budget, real ad-platform spend, and real verified-subscriber
 * count — the data behind "copy what's already working," down to a
 * specific campaign, not just a category average. Anonymized by a
 * sequential label (Campaign 1, 2, ...) rather than the marketer's name,
 * since this is a public marketplace page — the numbers are real, only
 * who ran it is hidden. Sorted by conversions-per-$100-spent, the
 * closest honest proxy for "worth copying" — never a guarantee, just
 * what actually happened.
 */
export async function getOfferCampaignHistory(offerId: string) {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { offerId },
    include: { creative: true, targetingTemplate: true, conversions: true, dailyMetrics: true },
    orderBy: { createdAt: "asc" },
  });

  const rows = campaigns
    .filter((c) => c.creative && c.targetingTemplate)
    .map((c, i) => {
      const spend = c.dailyMetrics.reduce((s, m) => s + Number(m.spend), 0);
      const conversions = c.conversions.length;
      return {
        campaignId: c.id,
        label: `Campaign ${i + 1}`,
        creativeId: c.creativeId!,
        creativeName: c.creative!.name,
        targetingTemplateId: c.targetingTemplateId!,
        targetingName: c.targetingTemplate!.name,
        declaredBudget: Number(c.declaredBudget ?? 0),
        durationDays: c.durationDays ?? 0,
        realSpend: spend,
        conversions,
        conversionsPer100Spent: spend > 0 ? (conversions / spend) * 100 : 0,
        status: c.status,
      };
    });

  return rows.sort((a, b) => b.conversionsPer100Spent - a.conversionsPer100Spent);
}

/**
 * Same underlying campaigns, rolled up by (creative, targeting) combo —
 * a faster "which pairing tends to work" scan before drilling into
 * individual campaigns.
 */
export async function getOfferPerformanceBreakdown(offerId: string) {
  const history = await getOfferCampaignHistory(offerId);

  const byCombo = new Map<
    string,
    {
      creativeId: string;
      creativeName: string;
      targetingTemplateId: string;
      targetingName: string;
      campaignCount: number;
      conversions: number;
      spend: number;
    }
  >();

  for (const c of history) {
    const key = `${c.creativeId}::${c.targetingTemplateId}`;
    const existing = byCombo.get(key);
    if (existing) {
      existing.campaignCount++;
      existing.conversions += c.conversions;
      existing.spend += c.realSpend;
    } else {
      byCombo.set(key, {
        creativeId: c.creativeId,
        creativeName: c.creativeName,
        targetingTemplateId: c.targetingTemplateId,
        targetingName: c.targetingName,
        campaignCount: 1,
        conversions: c.conversions,
        spend: c.realSpend,
      });
    }
  }

  return Array.from(byCombo.values())
    .map((row) => ({ ...row, conversionsPer100Spent: row.spend > 0 ? (row.conversions / row.spend) * 100 : 0 }))
    .sort((a, b) => b.conversionsPer100Spent - a.conversionsPer100Spent);
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

export async function getFeaturedOffers(limit = 3) {
  return prisma.performanceOffer.findMany({
    where: { status: "OPEN" },
    include: { app: { include: { developer: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getOfferMarketplaceStats() {
  const [openOffers, totalMarketerPayouts, totalMarketers, totalDevelopers] = await Promise.all([
    prisma.performanceOffer.count({ where: { status: "OPEN" } }),
    prisma.payout.aggregate({ where: { status: "PAID", campaignId: { not: null } }, _sum: { amount: true } }),
    prisma.marketingCampaign.findMany({ where: { marketerId: { not: null } }, distinct: ["marketerId"], select: { marketerId: true } }),
    prisma.developerProfile.count(),
  ]);
  return {
    openOffers,
    totalMarketerPayouts: Number(totalMarketerPayouts._sum.amount ?? 0),
    totalMarketers: totalMarketers.length,
    totalDevelopers,
  };
}
