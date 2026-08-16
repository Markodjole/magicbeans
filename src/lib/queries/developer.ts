import { prisma } from "@/lib/prisma";

export async function getDeveloperApps(developerProfileId: string) {
  return prisma.app.findMany({
    where: { developerId: developerProfileId },
    include: {
      integrationConnections: true,
      opportunities: { select: { id: true, status: true, amountFunded: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAppPerformanceSummary(appId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const campaigns = await prisma.marketingCampaign.findMany({
    where: { appId },
    include: { dailyMetrics: { where: { date: { gte: since } } } },
  });

  const spend = campaigns.reduce((s, c) => s + c.dailyMetrics.reduce((s2, m) => s2 + Number(m.spend), 0), 0);
  const installs = campaigns.reduce((s, c) => s + c.dailyMetrics.reduce((s2, m) => s2 + m.conversions, 0), 0);

  const transactions = await prisma.appTransaction.findMany({
    where: { appId, purchasedAt: { gte: since }, refundedAt: null },
  });
  const revenue = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const payingUsers = new Set(transactions.map((t) => t.appCustomerId)).size;

  return {
    spend,
    revenue,
    installs,
    payingUsers,
    cac: installs > 0 ? spend / installs : 0,
    roas: spend > 0 ? revenue / spend : 0,
  };
}

export async function getAppObligations(appId: string) {
  const opportunities = await prisma.investmentOpportunity.findMany({
    where: { appId },
    include: { investments: true },
  });

  return opportunities.map((opp) => ({
    opportunity: opp,
    developerShareEarned: opp.investments.reduce((s, i) => s + Number(i.developerRevenueEarned), 0),
    investorShareOwed: opp.investments.reduce((s, i) => s + Number(i.investorRevenueEarned) - Number(i.amountPaidToInvestor), 0),
  }));
}
