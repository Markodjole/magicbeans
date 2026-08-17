/**
 * Seeds a full believable demo dataset by driving the SAME code paths a
 * real deployment would use: syncAdvertising/Attribution/Revenue ->
 * AttributionRevenueEngine -> capital deployment -> createInvestment ->
 * payout. Nothing here computes a financial number directly — it only
 * creates the base entities (users/apps/campaigns/funding terms) and
 * calls into src/lib exactly like the admin "trigger sync" button or the
 * developer "set funding terms" form would.
 *
 * Two-phase timeline per app: a PRE-FUNDING window (historical
 * performance a developer would show off before opening funding terms)
 * and a POST-FUNDING window (where investor capital is actually at risk
 * and revenue share accrues) — this is what makes the demo's investor
 * dashboards show real, non-zero attributable revenue and earned share.
 *
 * A handful of apps also get a mid-stream TERMS CHANGE (openFundingTerms
 * superseding the initial terms), so the seeded data actually exercises
 * the multi-vintage pooled-revenue-share engine: old investors keep
 * their original percentages, new investors get the new ones, all
 * drawing from the same shared revenue pool proportionally to principal.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { SeededRandom } from "../src/lib/seeded-random";
import { runFullSyncForApp } from "../src/lib/sync/run-sync";
import { createInvestment } from "../src/lib/engine/investment";
import { runPayoutForInvestment, runPayoutForCampaign } from "../src/lib/engine/payout";
import { handleTransactionRefund } from "../src/lib/engine/refund";
import { computeRiskScoreForOpportunity } from "../src/lib/engine/risk-score";
import { openFundingTerms } from "../src/lib/engine/funding-terms";
import { APP_ECONOMICS } from "../src/lib/providers/advertising/mock-economics";

const DEMO_PASSWORD = "password123";
const HISTORY_DAYS = 180;
const SPLIT_DAY = 120; // pre-funding window is days [-180, -60], post-funding is [-60, 0]
const TERMS_CHANGE_DAY = 30; // for multi-vintage demo apps, terms change this many days before "now"

const DAY_MS = 1000 * 60 * 60 * 24;
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

type AppSpec = {
  name: string;
  category: string;
  description: string;
  pricingModel: "subscription" | "one_time" | "freemium";
  subscriptionPrice: number;
  channel: "TIKTOK" | "META" | "GOOGLE_ADS";
  secondChannel?: { channel: "TIKTOK" | "META" | "GOOGLE_ADS"; label: string };
  /** Demo apps that also get a mid-stream funding-terms change. */
  termsChangeDemo?: boolean;
};

/**
 * Categories are real, current App Store top-chart categories (pulled live
 * from Apple's public RSS charts, 2026-08-15) — Games, Entertainment,
 * Education, Health & Fitness, Finance, Photo & Video, Lifestyle,
 * Productivity all appear in the real top-free/top-paid charts. App names
 * below are fictional, styled after real market positioning within each
 * category (e.g. DramaLoop echoes the real short-drama-app trend
 * currently on the Entertainment chart) — never a real company's name,
 * since attaching fabricated funding/ROAS numbers to a real, identifiable
 * business would misrepresent that business. See mock-economics.ts for
 * the real-benchmark-grounded CPI/conversion numbers behind each app.
 */
const APPS: AppSpec[] = [
  {
    name: "FocusFlow",
    category: "Productivity",
    description: "A focus-timer and deep-work tracker for people who context-switch too much.",
    pricingModel: "subscription",
    subscriptionPrice: 14.99,
    channel: "TIKTOK",
    secondChannel: { channel: "META", label: "Meta Retargeting" },
    termsChangeDemo: true,
  },
  {
    name: "MacroMate",
    category: "Health & Fitness",
    description: "Macro and calorie tracking with a barcode scanner and weekly coaching nudges.",
    pricingModel: "subscription",
    subscriptionPrice: 12.99,
    channel: "META",
    secondChannel: { channel: "TIKTOK", label: "TikTok Creator Push" },
    termsChangeDemo: true,
  },
  {
    name: "BlockBurst",
    category: "Games",
    description: "A casual falling-block puzzle game with daily challenges and a no-ads subscription tier.",
    pricingModel: "subscription",
    subscriptionPrice: 4.99,
    channel: "TIKTOK",
    secondChannel: { channel: "META", label: "Meta Lookalike Expansion" },
  },
  {
    name: "DramaLoop",
    category: "Entertainment",
    description: "Bite-sized serialized drama episodes, unlocked weekly or all at once with a subscription.",
    pricingModel: "subscription",
    subscriptionPrice: 9.99,
    channel: "TIKTOK",
    secondChannel: { channel: "META", label: "Meta Retargeting" },
  },
  {
    name: "ReceiptFox",
    category: "Finance",
    description: "Snap a photo of any receipt and get categorized, exportable expense records.",
    pricingModel: "subscription",
    subscriptionPrice: 7.99,
    channel: "GOOGLE_ADS",
  },
  {
    name: "PlantPal",
    category: "Lifestyle",
    description: "Identify houseplants and get a personalized watering/light-care schedule.",
    pricingModel: "subscription",
    subscriptionPrice: 6.99,
    channel: "TIKTOK",
  },
  {
    name: "StudySprint",
    category: "Education",
    description: "Spaced-repetition flashcards with exam countdown planning for students.",
    pricingModel: "subscription",
    subscriptionPrice: 12.99,
    channel: "TIKTOK",
    secondChannel: { channel: "GOOGLE_ADS", label: "Search Intent Campaign" },
    termsChangeDemo: true,
  },
  {
    name: "PhotoGlow",
    category: "Photo & Video",
    description: "One-tap portrait retouching and preset filters for social-ready photos.",
    pricingModel: "subscription",
    subscriptionPrice: 4.99,
    channel: "META",
  },
];

const DEVELOPER_NAMES = ["Priya Natarajan", "Marcus Webb", "Lena Fischer", "Devon Clarke", "Yuki Tanaka"];

// developer index (0-4) for each app in APPS, by position
const APP_DEVELOPER = [0, 1, 2, 0, 3, 4, 2, 4];

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn",
  "Drew", "Reese", "Skyler", "Rowan", "Hayden", "Emerson", "Finley", "Dakota", "Charlie", "Elliot",
];
const LAST_NAMES = [
  "Chen", "Patel", "Garcia", "Kim", "Novak", "Silva", "Muller", "Kowalski", "Andersen", "Rossi",
  "Nguyen", "Osei", "Haddad", "Bergström", "Costa", "Ibrahim", "Larsen", "Petrov", "Suzuki", "Adeyemi",
];

async function main() {
  console.log("Seeding GrowthFund demo data...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1. Admin
  await prisma.user.create({
    data: { email: "admin@growthfund.dev", name: "Platform Admin", role: "ADMIN", passwordHash },
  });

  // 2. Developers
  const developers = [];
  for (let i = 0; i < DEVELOPER_NAMES.length; i++) {
    const user = await prisma.user.create({
      data: {
        email: `dev${i + 1}@growthfund.dev`,
        name: DEVELOPER_NAMES[i],
        role: "DEVELOPER",
        passwordHash,
        developerProfile: { create: { displayName: DEVELOPER_NAMES[i], approved: true } },
      },
      include: { developerProfile: true },
    });
    developers.push(user.developerProfile!);
  }
  console.log(`Created ${developers.length} developers`);

  // 3. Apps + integrations + campaigns
  const apps = [];
  for (let i = 0; i < APPS.length; i++) {
    const spec = APPS[i];
    const developer = developers[APP_DEVELOPER[i]];
    const rand = new SeededRandom("app", spec.name);
    const ageDays = HISTORY_DAYS + rand.int(30, 220);

    const app = await prisma.app.create({
      data: {
        developerId: developer.id,
        name: spec.name,
        category: spec.category,
        description: spec.description,
        pricingModel: spec.pricingModel,
        subscriptionPrice: spec.subscriptionPrice,
        approved: true,
        createdAt: daysAgo(ageDays),
      },
    });

    await createCampaign(app.id, spec.name, spec.channel, "Growth Campaign");
    await prisma.integrationConnection.create({
      data: { appId: app.id, category: "ATTRIBUTION", provider: "APPSFLYER", mode: "MOCK", connectedAt: new Date() },
    });
    await prisma.integrationConnection.create({
      data: { appId: app.id, category: "REVENUE", provider: "REVENUECAT", mode: "MOCK", connectedAt: new Date() },
    });

    if (spec.secondChannel) {
      await createCampaign(app.id, spec.name, spec.secondChannel.channel, spec.secondChannel.label);
    }

    apps.push({ app, spec });
  }
  console.log(`Created ${apps.length} apps with campaigns + integrations`);

  // 4. Pre-funding historical sync (establishes "historical performance")
  const preFundingStart = daysAgo(HISTORY_DAYS);
  const preFundingEnd = daysAgo(HISTORY_DAYS - SPLIT_DAY);
  for (const { app } of apps) {
    process.stdout.write(`  syncing pre-funding history for ${app.name}...\n`);
    await runFullSyncForApp(app.id, preFundingStart, preFundingEnd);
  }

  // 5. Funding terms — one standing offer per app, opened from that app's
  // aggregate historical performance across all its campaigns/channels.
  const opportunities = [];
  const fundingDate = daysAgo(HISTORY_DAYS - SPLIT_DAY - 1);
  for (const { app, spec } of apps) {
    const performance = await computeAppHistoricalPerformance(app.id, preFundingStart, preFundingEnd);
    const initialShare = spec.termsChangeDemo ? 75 : 70;
    const opp = await openFundingTerms({
      appId: app.id,
      title: `${app.name} standing growth funding terms`,
      description: `Fund ${app.name}'s ongoing marketing across every connected channel. Terms are based on ${SPLIT_DAY} days of verified historical performance.`,
      minimumInvestment: 50,
      investorRevenueSharePercent: initialShare,
      returnCapMultiple: Math.round(new SeededRandom("opportunity", app.id).float(1.4, 1.8) * 100) / 100,
      historicalROAS: performance.roas || Number(APP_ECONOMICS[app.name]?.targetROAS ?? 1.5),
      historicalCAC: performance.cac || undefined,
      historicalLTV: performance.cac > 0 ? performance.cac * performance.roas : undefined,
      status: "OPEN",
    });
    await computeRiskScoreForOpportunity(opp.opportunityId);
    opportunities.push({ appId: app.id, opportunityId: opp.opportunityId, vintage: "initial" });
  }
  console.log(`Opened ${opportunities.length} standing funding terms`);

  // 6. Investors
  const investorRand = new SeededRandom("investors");
  const investors = [];
  for (let i = 0; i < 50; i++) {
    const first = investorRand.pick(FIRST_NAMES);
    const last = investorRand.pick(LAST_NAMES);
    const name = `${first} ${last}`;
    const user = await prisma.user.create({
      data: {
        email: `investor${i + 1}@growthfund.dev`,
        name,
        role: "INVESTOR",
        passwordHash,
        investorProfile: { create: { displayName: name } },
      },
      include: { investorProfile: true },
    });
    investors.push(user.investorProfile!);
  }
  console.log(`Created ${investors.length} investors`);

  // 7. Investments under the initial terms — backdated to just after the
  // pre-funding window.
  const investRand = new SeededRandom("investments");
  let investmentCount = await fundOpportunities(opportunities, investors, investRand, fundingDate);
  console.log(`Created ${investmentCount} investments under initial terms`);

  // 8. Mid-stream terms change for the designated demo apps — supersedes
  // the initial terms and opens a new vintage with a different split,
  // then funds THAT with a fresh batch of investors. Existing investments
  // keep pointing at the (now SUPERSEDED) initial opportunity, so they
  // keep earning their original 75% instead of the new rate.
  const termsChangeDate = daysAgo(TERMS_CHANGE_DAY);
  const newVintageOpportunities: typeof opportunities = [];
  for (const { app, spec } of apps) {
    if (!spec.termsChangeDemo) continue;
    const performance = await computeAppHistoricalPerformance(app.id, preFundingStart, daysAgo(TERMS_CHANGE_DAY));
    const opp = await openFundingTerms({
      appId: app.id,
      title: `${app.name} standing growth funding terms (revised)`,
      description: `Revised terms for ${app.name}'s ongoing marketing across every connected channel, reflecting updated performance.`,
      minimumInvestment: 50,
      investorRevenueSharePercent: 65,
      returnCapMultiple: Math.round(new SeededRandom("opportunity-v2", app.id).float(1.4, 1.8) * 100) / 100,
      historicalROAS: performance.roas || Number(APP_ECONOMICS[app.name]?.targetROAS ?? 1.5),
      historicalCAC: performance.cac || undefined,
      historicalLTV: performance.cac > 0 ? performance.cac * performance.roas : undefined,
      status: "OPEN",
    });
    await computeRiskScoreForOpportunity(opp.opportunityId);
    newVintageOpportunities.push({ appId: app.id, opportunityId: opp.opportunityId, vintage: "revised" });
  }
  investmentCount += await fundOpportunities(newVintageOpportunities, investors, investRand, termsChangeDate);
  opportunities.push(...newVintageOpportunities);
  console.log(`Created additional investments under revised terms (${newVintageOpportunities.length} apps changed terms) — ${investmentCount} total investments`);

  // 8.5. CPA marketplace pivot demo — one performance offer plus one
  // launched marketer campaign, layered onto an app that already has
  // standing revenue-share terms, showing both transaction models can
  // coexist on the same app. Created before the post-funding sync below
  // so its activity gets picked up by that SAME sync pass — no separate
  // sync call, no risk of double-processing already-synced dates.
  const cpaApp = apps.find(({ app }) => app.name === "FocusFlow")!.app;
  const cpaAppPerformance = await computeAppHistoricalPerformance(cpaApp.id, preFundingStart, preFundingEnd);
  const offer = await prisma.performanceOffer.create({
    data: {
      appId: cpaApp.id,
      title: `${cpaApp.name} — US iOS growth offer`,
      description: `We pay $32 for every verified subscriber you deliver to ${cpaApp.name}. Pick an approved creative and audience below, fund your own ad spend directly with the ad platform, and get paid once a real subscriber shows up.`,
      payoutPerConversion: 32,
      marketplaceFeePercent: 10,
      minBudget: 100,
      historicalCPA: cpaAppPerformance.cac || 8,
      status: "OPEN",
      creatives: {
        create: [
          { name: "Creative A — Testimonial", channel: "TIKTOK", description: "15s user testimonial, UGC style" },
          { name: "Creative B — Feature demo", channel: "TIKTOK", description: "Screen-recorded feature walkthrough" },
        ],
      },
      targetingTemplates: {
        create: [
          { name: "Broad US", channel: "TIKTOK", description: "US, 18-45, broad interest targeting" },
          { name: "Productivity enthusiasts", channel: "TIKTOK", description: "US, interest in productivity/self-improvement apps" },
        ],
      },
    },
    include: { creatives: true, targetingTemplates: true },
  });

  const marketer = investors[0];
  const marketerAccount = await prisma.advertisingAccount.findFirstOrThrow({ where: { appId: cpaApp.id, provider: "TIKTOK" } });
  const marketerCampaignStart = daysAgo(TERMS_CHANGE_DAY - 5);
  await prisma.marketingCampaign.create({
    data: {
      appId: cpaApp.id,
      advertisingAccountId: marketerAccount.id,
      provider: "TIKTOK",
      externalCampaignId: `marketer-campaign-${cpaApp.id}`,
      name: `${cpaApp.name} — ${offer.creatives[0].name} / ${offer.targetingTemplates[0].name}`,
      dailyBudget: 25,
      status: "ACTIVE",
      startDate: marketerCampaignStart,
      isMock: true,
      marketerId: marketer.id,
      offerId: offer.id,
      creativeId: offer.creatives[0].id,
      targetingTemplateId: offer.targetingTemplates[0].id,
      declaredBudget: 500,
      durationDays: TERMS_CHANGE_DAY - 5,
      launchedAt: marketerCampaignStart,
    },
  });
  console.log(`Created 1 performance offer with a launched marketer campaign for ${cpaApp.name}`);

  // 9. Post-funding sync — this is where revenue share actually accrues,
  // pooled across every vintage of terms an app has had.
  const postFundingStart = daysAgo(HISTORY_DAYS - SPLIT_DAY);
  const postFundingEnd = new Date();
  for (const { app } of apps) {
    process.stdout.write(`  syncing post-funding activity for ${app.name}...\n`);
    await runFullSyncForApp(app.id, postFundingStart, postFundingEnd);
  }

  // 10. Simulate a handful of refunds AFTER revenue was already accrued,
  // to exercise the reversal path with real accrued numbers behind it.
  const refundCandidates = await prisma.appTransaction.findMany({
    where: {
      refundedAt: null,
      purchasedAt: { gte: postFundingStart },
      revenueAttributions: { some: { confidence: { in: ["HIGH", "MEDIUM"] }, reversedAt: null } },
    },
    take: 10,
  });
  for (const txn of refundCandidates) {
    await handleTransactionRefund(txn.id, new Date(txn.purchasedAt.getTime() + 3 * DAY_MS));
  }
  console.log(`Simulated ${refundCandidates.length} post-accrual refunds`);

  // 11. Payouts for roughly half of investments with earned revenue
  const investmentsWithRevenue = await prisma.investment.findMany({
    where: { investorRevenueEarned: { gt: 0 } },
  });
  const payoutRand = new SeededRandom("payouts");
  let payoutCount = 0;
  for (const inv of investmentsWithRevenue) {
    if (payoutRand.bool(0.5)) {
      const result = await runPayoutForInvestment(inv.id);
      if (result) payoutCount++;
    }
  }
  console.log(`Ran ${payoutCount} investor payouts`);

  // 11.5. Payout for the demo marketer campaign, if it earned anything.
  const marketerCampaignForPayout = await prisma.marketingCampaign.findFirst({ where: { appId: cpaApp.id, offerId: offer.id } });
  if (marketerCampaignForPayout) {
    const marketerPayout = await runPayoutForCampaign(marketerCampaignForPayout.id);
    console.log(marketerPayout ? `Paid out $${marketerPayout.paid} to the demo marketer` : "No marketer payout owed yet");
  }

  console.log("\nDemo login credentials (all use password: " + DEMO_PASSWORD + "):");
  console.log("  Admin:     admin@growthfund.dev");
  console.log("  Developer: dev1@growthfund.dev .. dev5@growthfund.dev");
  console.log("  Investor:  investor1@growthfund.dev .. investor50@growthfund.dev");
  console.log("\nSeed complete.");
}

async function fundOpportunities(
  opps: { appId: string; opportunityId: string }[],
  investors: { id: string }[],
  investRand: SeededRandom,
  investedAtBase: Date
): Promise<number> {
  let count = 0;
  for (const { opportunityId } of opps) {
    const opportunity = await prisma.investmentOpportunity.findUniqueOrThrow({ where: { id: opportunityId } });
    const numInvestors = investRand.int(1, 6);
    const shuffled = [...investors].sort(() => investRand.float(-1, 1));
    for (let i = 0; i < numInvestors; i++) {
      const investor = shuffled[i];
      const amount = Math.max(
        Number(opportunity.minimumInvestment),
        Math.round(investRand.float(100, 1200) / 10) * 10
      );
      const investedAt = new Date(investedAtBase.getTime() + investRand.int(0, 5) * DAY_MS);
      await createInvestment({ investorProfileId: investor.id, opportunityId, amount, investedAt });
      count++;
    }
  }
  return count;
}

async function createCampaign(appId: string, appName: string, channel: "TIKTOK" | "META" | "GOOGLE_ADS", label: string) {
  const connection = await prisma.integrationConnection.create({
    data: { appId, category: "ADVERTISING", provider: channel, mode: "MOCK", connectedAt: new Date() },
  });
  const account = await prisma.advertisingAccount.create({
    data: {
      appId,
      integrationConnectionId: connection.id,
      provider: channel,
      externalAccountId: `mock-${channel.toLowerCase()}-${appId}`,
      name: `${channel} Demo Account`,
    },
  });
  const profile = APP_ECONOMICS[appName];
  return prisma.marketingCampaign.create({
    data: {
      appId,
      advertisingAccountId: account.id,
      provider: channel,
      externalCampaignId: `mock-campaign-${appId}-${channel}`,
      name: `${appName} ${label}`,
      dailyBudget: profile?.baseDailySpend ?? 80,
      status: "ACTIVE",
      startDate: daysAgo(HISTORY_DAYS),
      isMock: true,
    },
  });
}

/** Aggregates spend/revenue/installs across ALL of an app's campaigns for a date range. */
async function computeAppHistoricalPerformance(appId: string, start: Date, end: Date) {
  const campaigns = await prisma.marketingCampaign.findMany({ where: { appId }, select: { id: true } });
  const campaignIds = campaigns.map((c) => c.id);
  if (campaignIds.length === 0) return { spend: 0, revenue: 0, installs: 0, roas: 0, cac: 0 };

  const [spendAgg, revenueAgg, installCount] = await Promise.all([
    prisma.campaignDailyMetric.aggregate({
      where: { campaignId: { in: campaignIds }, date: { gte: start, lte: end } },
      _sum: { spend: true },
    }),
    prisma.revenueAttribution.aggregate({
      where: { campaignId: { in: campaignIds }, reversedAt: null },
      _sum: { attributedAmount: true },
    }),
    prisma.attributedInstall.count({ where: { campaignId: { in: campaignIds } } }),
  ]);

  const spend = Number(spendAgg._sum.spend ?? 0);
  const revenue = Number(revenueAgg._sum.attributedAmount ?? 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const cac = installCount > 0 ? spend / installCount : 0;

  return { spend, revenue, installs: installCount, roas, cac };
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
