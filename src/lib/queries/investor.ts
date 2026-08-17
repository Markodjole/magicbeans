import { prisma } from "@/lib/prisma";

export async function getInvestorPortfolio(investorProfileId: string) {
  const investments = await prisma.investment.findMany({
    where: { investorId: investorProfileId },
    include: { opportunity: { include: { app: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totals = investments.reduce(
    (acc, inv) => {
      acc.totalInvested += Number(inv.principalAmount);
      acc.capitalDeployed += Number(inv.capitalDeployed);
      acc.attributableRevenue += Number(inv.attributableRevenue);
      acc.investorRevenueEarned += Number(inv.investorRevenueEarned);
      acc.amountPaidToInvestor += Number(inv.amountPaidToInvestor);
      if (inv.status === "ACTIVE" || inv.status === "PENDING") acc.active++;
      if (inv.status === "COMPLETED") acc.completed++;
      return acc;
    },
    {
      totalInvested: 0,
      capitalDeployed: 0,
      attributableRevenue: 0,
      investorRevenueEarned: 0,
      amountPaidToInvestor: 0,
      active: 0,
      completed: 0,
    }
  );

  return { investments, totals };
}

export async function getInvestmentDetail(investmentId: string) {
  const investment = await prisma.investment.findUnique({
    where: { id: investmentId },
    include: {
      opportunity: { include: { app: { include: { developer: true, campaigns: true } } } },
      capitalAllocations: { orderBy: { allocatedAt: "asc" } },
      revenueShareAccruals: {
        orderBy: { accruedAt: "asc" },
        include: { revenueAttribution: { include: { transaction: true } } },
      },
      payouts: { orderBy: { createdAt: "asc" } },
      ledgerEntries: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!investment) return null;

  // Funnel context spans every campaign/channel this app runs — an
  // investment isn't scoped to one specific campaign anymore.
  const campaignIds = investment.opportunity.app.campaigns.map((c) => c.id);
  const [installsCount, payingCustomersCount] = campaignIds.length
    ? await Promise.all([
        prisma.attributedInstall.count({ where: { campaignId: { in: campaignIds } } }),
        prisma.appTransaction.count({
          where: { revenueAttributions: { some: { campaignId: { in: campaignIds }, reversedAt: null } } },
        }),
      ])
    : [0, 0];

  return { investment, funnel: { installsCount, payingCustomersCount } };
}

/**
 * Chronological, expandable audit trail for one investment — the
 * "Campaign Audit Page" feature. Merges ledger entries with their
 * underlying provider-linked records so every line can show its source.
 */
export async function getInvestmentAuditTimeline(investmentId: string) {
  const entries = await prisma.ledgerEntry.findMany({
    where: { investmentId },
    orderBy: { createdAt: "asc" },
  });

  const opportunityEntries = await prisma.investment.findUnique({
    where: { id: investmentId },
    select: { opportunityId: true },
  });

  const opportunityLedger = opportunityEntries
    ? await prisma.ledgerEntry.findMany({
        where: { opportunityId: opportunityEntries.opportunityId, investmentId: null },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return [...entries, ...opportunityLedger].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * A marketer's launched CPA campaigns — the pivot's parallel to
 * getInvestorPortfolio, but for performance-offer campaigns instead of
 * revenue-share investments. Same underlying InvestorProfile id, wholly
 * separate data shape: no principal, no return cap, just a flat payout
 * per verified conversion delivered.
 */
export async function getMarketerCampaigns(marketerProfileId: string) {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { marketerId: marketerProfileId },
    include: {
      app: true,
      offer: true,
      creative: true,
      targetingTemplate: true,
      conversions: true,
      payouts: true,
      dailyMetrics: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return campaigns.map((c) => {
    const realSpend = c.dailyMetrics.reduce((s, m) => s + Number(m.spend), 0);
    const grossEarned = c.conversions.reduce((s, cv) => s + Number(cv.grossPayout), 0);
    const netEarned = c.conversions.reduce((s, cv) => s + Number(cv.netPayout), 0);
    const paidOut = c.payouts.reduce((s, p) => (p.status === "PAID" ? s + Number(p.amount) : s), 0);
    return {
      campaign: c,
      realSpend,
      conversionsDelivered: c.conversions.length,
      grossEarned,
      netEarned,
      owed: Math.round((netEarned - paidOut) * 100) / 100,
    };
  });
}

export async function getMarketerCampaignDetail(campaignId: string, marketerProfileId: string) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, marketerId: marketerProfileId },
    include: {
      app: true,
      offer: true,
      creative: true,
      targetingTemplate: true,
      conversions: { orderBy: { verifiedAt: "asc" }, include: { appCustomer: true } },
      payouts: { orderBy: { createdAt: "asc" } },
      ledgerEntries: { orderBy: { createdAt: "asc" } },
      dailyMetrics: { orderBy: { date: "asc" } },
    },
  });
  if (!campaign) return null;

  const realSpend = campaign.dailyMetrics.reduce((s, m) => s + Number(m.spend), 0);
  const grossEarned = campaign.conversions.reduce((s, cv) => s + Number(cv.grossPayout), 0);
  const netEarned = campaign.conversions.reduce((s, cv) => s + Number(cv.netPayout), 0);
  const paidOut = campaign.payouts.reduce((s, p) => (p.status === "PAID" ? s + Number(p.amount) : s), 0);

  return {
    campaign,
    realSpend,
    conversionsDelivered: campaign.conversions.length,
    grossEarned,
    netEarned,
    owed: Math.round((netEarned - paidOut) * 100) / 100,
  };
}

/**
 * Chronological PAID payouts for one investor, used to derive a simple
 * cumulative "money received over time" series for the dashboard chart.
 */
export async function getInvestorPayoutHistory(investorProfileId: string) {
  const payouts = await prisma.payout.findMany({
    where: { investorId: investorProfileId, status: "PAID" },
    orderBy: { paidAt: "asc" },
  });

  let running = 0;
  return payouts.map((payout) => {
    running += Number(payout.amount);
    return {
      date: (payout.paidAt ?? payout.createdAt).toISOString().slice(0, 10),
      cumulativePaidOut: Math.round(running * 100) / 100,
    };
  });
}
