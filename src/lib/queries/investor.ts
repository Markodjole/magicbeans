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
