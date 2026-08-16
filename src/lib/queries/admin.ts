import { prisma } from "@/lib/prisma";

export async function getPlatformTotals() {
  const [funding, deployed, revenue, payouts, activeOpportunities, activeCampaigns, developers, investors] =
    await Promise.all([
      prisma.investmentOpportunity.aggregate({ _sum: { amountFunded: true } }),
      prisma.investment.aggregate({ _sum: { capitalDeployed: true } }),
      prisma.investment.aggregate({ _sum: { attributableRevenue: true } }),
      prisma.investment.aggregate({ _sum: { amountPaidToInvestor: true } }),
      prisma.investmentOpportunity.count({ where: { status: "OPEN" } }),
      prisma.marketingCampaign.count({ where: { status: "ACTIVE" } }),
      prisma.developerProfile.count(),
      prisma.investorProfile.count(),
    ]);

  return {
    totalFunding: Number(funding._sum.amountFunded ?? 0),
    capitalDeployed: Number(deployed._sum.capitalDeployed ?? 0),
    attributedRevenue: Number(revenue._sum.attributableRevenue ?? 0),
    investorPayouts: Number(payouts._sum.amountPaidToInvestor ?? 0),
    activeOpportunities,
    activeCampaigns,
    developers,
    investors,
  };
}

export async function getIntegrationHealth() {
  const connections = await prisma.integrationConnection.findMany({
    include: {
      app: { select: { name: true } },
      syncJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ provider: "asc" }],
  });

  return connections.map((c) => ({
    id: c.id,
    appId: c.appId,
    appName: c.app.name,
    provider: c.provider,
    category: c.category,
    mode: c.mode,
    lastError: c.lastError,
    lastSync: c.syncJobs[0] ?? null,
  }));
}

export async function listActiveCampaignsForAdmin() {
  return prisma.marketingCampaign.findMany({
    where: { status: "ACTIVE" },
    include: { app: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllUsers() {
  return prisma.user.findMany({
    include: { investorProfile: true, developerProfile: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listPendingApprovals() {
  const [developers, apps, opportunities] = await Promise.all([
    prisma.developerProfile.findMany({ where: { approved: false }, include: { user: true } }),
    prisma.app.findMany({ where: { approved: false }, include: { developer: true } }),
    prisma.investmentOpportunity.findMany({ where: { status: "PENDING_APPROVAL" }, include: { app: true } }),
  ]);
  return { developers, apps, opportunities };
}

export async function getLedgerEntries(params?: { type?: string; limit?: number }) {
  return prisma.ledgerEntry.findMany({
    where: params?.type ? { type: params.type as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: params?.limit ?? 100,
  });
}

export async function getRecentSyncJobs(limit = 50) {
  return prisma.syncJob.findMany({
    include: { integrationConnection: { include: { app: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listAppsForIntegrationTest() {
  return prisma.app.findMany({
    select: { id: true, name: true, category: true, subscriptionPrice: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Walks the full campaign -> install -> user -> transaction -> attributed
 * revenue -> ledger chain for one externalUserId, for the admin
 * integration-test screen (per spec: "show one user flow from AppsFlyer
 * install -> RevenueCat purchase -> attributed revenue"). Ledger entries
 * are matched by scanning metadata in JS rather than a JSON-path query —
 * this is a diagnostic screen, not a hot path, so simplicity wins.
 */
export async function getIntegrationTestChain(appId: string, externalUserId: string) {
  const [installs, appCustomer, opportunities] = await Promise.all([
    prisma.attributedInstall.findMany({
      where: { appId, externalUserId },
      include: { campaign: { select: { id: true, name: true, provider: true } } },
      orderBy: { installedAt: "asc" },
    }),
    prisma.appCustomer.findUnique({
      where: { appId_appUserId: { appId, appUserId: externalUserId } },
      include: {
        transactions: {
          include: { revenueAttributions: true },
          orderBy: { purchasedAt: "asc" },
        },
      },
    }),
    prisma.investmentOpportunity.findMany({ where: { appId }, select: { id: true } }),
  ]);

  const transactionIds = new Set((appCustomer?.transactions ?? []).map((t) => t.id));
  const attributionIds = new Set(
    (appCustomer?.transactions ?? []).flatMap((t) => t.revenueAttributions.map((a) => a.id))
  );

  const candidateLedgerEntries = opportunities.length
    ? await prisma.ledgerEntry.findMany({
        where: { opportunityId: { in: opportunities.map((o) => o.id) } },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    : [];

  const ledgerEntries = candidateLedgerEntries.filter((entry) => {
    const meta = entry.metadata as { transactionId?: string; revenueAttributionId?: string } | null;
    if (!meta) return false;
    return (
      (meta.transactionId && transactionIds.has(meta.transactionId)) ||
      (meta.revenueAttributionId && attributionIds.has(meta.revenueAttributionId))
    );
  });

  return { installs, appCustomer, ledgerEntries };
}
