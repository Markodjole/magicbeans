import { prisma } from "@/lib/prisma";

/**
 * Test fixtures are fully isolated from seeded demo data — every entity
 * created here hangs off a uniquely-prefixed User, and deleteFixture()
 * cascades through Prisma's onDelete: Cascade relations to clean up
 * everything in one call. Never touches the demo dataset other sessions
 * might be looking at in the browser.
 */
export async function createTestFixture(runId: string) {
  const developerUser = await prisma.user.create({
    data: {
      email: `test-dev-${runId}@test.growthfund.dev`,
      name: "Test Developer",
      role: "DEVELOPER",
      passwordHash: "x",
      developerProfile: { create: { displayName: "Test Developer", approved: true } },
    },
    include: { developerProfile: true },
  });

  const investorUser = await prisma.user.create({
    data: {
      email: `test-investor-${runId}@test.growthfund.dev`,
      name: "Test Investor",
      role: "INVESTOR",
      passwordHash: "x",
      investorProfile: { create: { displayName: "Test Investor" } },
    },
    include: { investorProfile: true },
  });

  const app = await prisma.app.create({
    data: {
      developerId: developerUser.developerProfile!.id,
      name: `Test App ${runId}`,
      category: "Productivity",
      pricingModel: "subscription",
      subscriptionPrice: 9.99,
      approved: true,
    },
  });

  const connection = await prisma.integrationConnection.create({
    data: { appId: app.id, category: "ADVERTISING", provider: "TIKTOK", mode: "MOCK" },
  });

  const account = await prisma.advertisingAccount.create({
    data: {
      appId: app.id,
      integrationConnectionId: connection.id,
      provider: "TIKTOK",
      externalAccountId: `test-account-${runId}`,
      name: "Test Account",
    },
  });

  const campaign = await prisma.marketingCampaign.create({
    data: {
      appId: app.id,
      advertisingAccountId: account.id,
      provider: "TIKTOK",
      externalCampaignId: `test-campaign-${runId}`,
      name: "Test Campaign",
      dailyBudget: 100,
      status: "ACTIVE",
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      isMock: true,
    },
  });

  return { developerUser, investorUser, app, campaign };
}

export async function createOpportunityFixture(params: {
  appId: string;
  investorRevenueSharePercent?: number;
  returnCapMultiple?: number;
}) {
  return prisma.investmentOpportunity.create({
    data: {
      appId: params.appId,
      title: "Test Funding Terms",
      description: "Test",
      minimumInvestment: 50,
      investorRevenueSharePercent: params.investorRevenueSharePercent ?? 70,
      developerRevenueSharePercent: 100 - (params.investorRevenueSharePercent ?? 70),
      returnCapMultiple: params.returnCapMultiple ?? 1.5,
      status: "OPEN",
    },
  });
}

export async function createTransactionFixture(params: {
  appId: string;
  campaignId: string;
  externalUserId: string;
  amount: number;
  installedAt?: Date;
  purchasedAt?: Date;
}) {
  const appCustomer = await prisma.appCustomer.create({
    data: { appId: params.appId, appUserId: params.externalUserId, externalUserId: params.externalUserId },
  });
  await prisma.attributedInstall.create({
    data: {
      appId: params.appId,
      campaignId: params.campaignId,
      externalUserId: params.externalUserId,
      installedAt: params.installedAt ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      mediaSource: "TikTok",
      attributionProvider: "APPSFLYER",
      appCustomerId: appCustomer.id,
    },
  });
  return prisma.appTransaction.create({
    data: {
      appId: params.appId,
      appCustomerId: appCustomer.id,
      transactionId: `test-txn-${params.externalUserId}`,
      productId: "monthly_subscription",
      amount: params.amount,
      currency: "USD",
      purchasedAt: params.purchasedAt ?? new Date(),
      platform: "IOS",
      provider: "REVENUECAT",
    },
  });
}

export async function deleteFixture(userIds: string[]) {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
