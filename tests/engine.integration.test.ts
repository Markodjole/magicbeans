import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runAttributionRevenueEngineForApp } from "@/lib/engine/attribution-revenue-engine";
import { runCapitalDeploymentForApp } from "@/lib/engine/capital-deployment";
import { handleTransactionRefund } from "@/lib/engine/refund";
import { getInvestmentLedgerSummary } from "@/lib/ledger/ledger";
import {
  createOpportunityFixture,
  createTestFixture,
  createTransactionFixture,
  deleteFixture,
} from "./helpers/fixtures";

const RUN_ID = `it-${process.pid}-${Math.floor(Math.random() * 1_000_000)}`;
const userIdsToClean: string[] = [];

afterAll(async () => {
  await deleteFixture(userIdsToClean);
  await prisma.$disconnect();
});

describe("AttributionRevenueEngine — core example ($1,000 principal, $2,000 revenue, recoup-then-70/30 split)", () => {
  it("recoups the $1,000 principal in full, then splits the remaining $1,000 profit 70/30 -> $1,700 investor / $300 developer", async () => {
    const fixture = await createTestFixture(`${RUN_ID}-core`);
    userIdsToClean.push(fixture.developerUser.id, fixture.investorUser.id);

    const opportunity = await createOpportunityFixture({
      appId: fixture.app.id,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 5, // high cap so it doesn't interfere with this test
    });
    const investment = await prisma.investment.create({
      data: {
        investorId: fixture.investorUser.investorProfile!.id,
        opportunityId: opportunity.id,
        principalAmount: 1000,
        status: "ACTIVE",
      },
    });

    await createTransactionFixture({
      appId: fixture.app.id,
      campaignId: fixture.campaign.id,
      externalUserId: `user-${RUN_ID}-core`,
      amount: 2000,
    });

    await runAttributionRevenueEngineForApp(fixture.app.id);

    const updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Number(updated.attributableRevenue)).toBe(2000);
    // $1,000 of the $2,000 repays principal (100% to investor); the
    // remaining $1,000 profit splits 70/30 -> investor 1000+700=1700.
    expect(Number(updated.investorRevenueEarned)).toBe(1700);
    expect(Number(updated.developerRevenueEarned)).toBe(300);
    expect(Number(updated.currentReturnMultiple)).toBeCloseTo(1.7, 5);

    const attribution = await prisma.revenueAttribution.findFirstOrThrow({ where: { campaignId: fixture.campaign.id } });
    expect(attribution.confidence).toBe("HIGH");
    expect(Number(attribution.attributedAmount)).toBe(2000);
  });
});

describe("Return cap enforcement", () => {
  it("never pays the investor more than principal * returnCapMultiple, and completes the investment", async () => {
    const fixture = await createTestFixture(`${RUN_ID}-cap`);
    userIdsToClean.push(fixture.developerUser.id, fixture.investorUser.id);

    // principal $1,000, cap 1.5x -> max payable $1,500
    const opportunity = await createOpportunityFixture({
      appId: fixture.app.id,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 1.5,
    });
    const investment = await prisma.investment.create({
      data: {
        investorId: fixture.investorUser.investorProfile!.id,
        opportunityId: opportunity.id,
        principalAmount: 1000,
        status: "ACTIVE",
      },
    });

    // $1,200 revenue -> $1,000 recoups principal (100% investor), $200
    // profit splits 70/30 -> investor 1000+140=1140 (under the $1,500 cap)
    await createTransactionFixture({
      appId: fixture.app.id,
      campaignId: fixture.campaign.id,
      externalUserId: `user-${RUN_ID}-cap-1`,
      amount: 1200,
    });
    await runAttributionRevenueEngineForApp(fixture.app.id);

    let updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Number(updated.investorRevenueEarned)).toBe(1140);
    expect(updated.status).toBe("ACTIVE");

    // Principal is already fully recouped, so this $600 is pure profit:
    // 70% -> $420 more (would total $1,560), must cap at $1,500.
    await createTransactionFixture({
      appId: fixture.app.id,
      campaignId: fixture.campaign.id,
      externalUserId: `user-${RUN_ID}-cap-2`,
      amount: 600,
    });
    await runAttributionRevenueEngineForApp(fixture.app.id);

    updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Number(updated.investorRevenueEarned)).toBe(1500);
    expect(updated.status).toBe("COMPLETED");

    // A third revenue event must add nothing further to the investor.
    await createTransactionFixture({
      appId: fixture.app.id,
      campaignId: fixture.campaign.id,
      externalUserId: `user-${RUN_ID}-cap-3`,
      amount: 1000,
    });
    await runAttributionRevenueEngineForApp(fixture.app.id);

    updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Number(updated.investorRevenueEarned)).toBe(1500);
  });
});

describe("Refund reversal", () => {
  it("reverses a transaction that spans both the recoup and profit-share phases", async () => {
    const fixture = await createTestFixture(`${RUN_ID}-refund`);
    userIdsToClean.push(fixture.developerUser.id, fixture.investorUser.id);

    // Small principal ($30) so a single $100 transaction crosses from the
    // recoup phase into the profit-share phase within one event: $30
    // repays principal (100% investor), $70 profit splits 70/30 -> +$49
    // investor / +$21 developer. Investor total = $30 + $49 = $79.
    const opportunity = await createOpportunityFixture({
      appId: fixture.app.id,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 10,
    });
    const investment = await prisma.investment.create({
      data: {
        investorId: fixture.investorUser.investorProfile!.id,
        opportunityId: opportunity.id,
        principalAmount: 30,
        status: "ACTIVE",
      },
    });

    const transaction = await createTransactionFixture({
      appId: fixture.app.id,
      campaignId: fixture.campaign.id,
      externalUserId: `user-${RUN_ID}-refund`,
      amount: 100,
    });
    await runAttributionRevenueEngineForApp(fixture.app.id);

    let updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Number(updated.investorRevenueEarned)).toBe(79);
    expect(Number(updated.developerRevenueEarned)).toBe(21);

    await handleTransactionRefund(transaction.id);

    updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Number(updated.investorRevenueEarned)).toBe(0);
    expect(Number(updated.developerRevenueEarned)).toBe(0);

    // Original rows must still exist — never deleted, only reversed.
    const attributions = await prisma.revenueAttribution.findMany({
      where: { transactionId: transaction.id },
      orderBy: { createdAt: "asc" },
    });
    expect(attributions).toHaveLength(2);
    expect(Number(attributions[0].attributedAmount)).toBe(100);
    expect(attributions[0].reversedAt).not.toBeNull();
    expect(Number(attributions[1].attributedAmount)).toBe(-100);

    const ledgerEntries = await prisma.ledgerEntry.findMany({ where: { investmentId: investment.id } });
    // REFUND is opportunity-level (a refund can span multiple investors'
    // accruals) — it must still show up on this investment's audit
    // timeline via opportunityId, per getInvestmentAuditTimeline.
    const refundEntry = await prisma.ledgerEntry.findFirst({ where: { type: "REFUND", opportunityId: opportunity.id } });
    expect(refundEntry).not.toBeNull();
    expect(Number(refundEntry!.amount)).toBe(-100);

    const reversalEntries = ledgerEntries.filter((e) => e.type === "REVERSAL");
    expect(reversalEntries).toHaveLength(2);
    const investorReversal = reversalEntries.find(
      (e) => (e.metadata as { reversedType?: string } | null)?.reversedType === "INVESTOR_REVENUE_SHARE"
    );
    const developerReversal = reversalEntries.find(
      (e) => (e.metadata as { reversedType?: string } | null)?.reversedType === "DEVELOPER_REVENUE_SHARE"
    );
    expect(Number(investorReversal!.amount)).toBe(-79);
    expect(Number(developerReversal!.amount)).toBe(-21);
  });

  it("ledger balances: INVESTOR_REVENUE_SHARE + its REVERSAL sums to the investment's investorRevenueEarned", async () => {
    const fixture = await createTestFixture(`${RUN_ID}-ledger`);
    userIdsToClean.push(fixture.developerUser.id, fixture.investorUser.id);

    const opportunity = await createOpportunityFixture({
      appId: fixture.app.id,
      investorRevenueSharePercent: 70,
      returnCapMultiple: 10,
    });
    const investment = await prisma.investment.create({
      data: {
        investorId: fixture.investorUser.investorProfile!.id,
        opportunityId: opportunity.id,
        principalAmount: 1000,
        status: "ACTIVE",
      },
    });

    const t1 = await createTransactionFixture({
      appId: fixture.app.id,
      campaignId: fixture.campaign.id,
      externalUserId: `user-${RUN_ID}-ledger-1`,
      amount: 300,
    });
    await createTransactionFixture({
      appId: fixture.app.id,
      campaignId: fixture.campaign.id,
      externalUserId: `user-${RUN_ID}-ledger-2`,
      amount: 200,
    });
    await runAttributionRevenueEngineForApp(fixture.app.id);
    await handleTransactionRefund(t1.id);

    const summary = await getInvestmentLedgerSummary(investment.id);
    const investorShareTotal =
      (summary.INVESTOR_REVENUE_SHARE ?? 0) +
      (await prisma.ledgerEntry
        .findMany({ where: { investmentId: investment.id, type: "REVERSAL" } })
        .then((rows) =>
          rows
            .filter((r) => (r.metadata as { reversedType?: string } | null)?.reversedType === "INVESTOR_REVENUE_SHARE")
            .reduce((s, r) => s + Number(r.amount), 0)
        ));

    const updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Math.round(investorShareTotal * 100) / 100).toBe(Number(updated.investorRevenueEarned));
    // Both $300 and $200 land entirely in the recoup phase (principal is
    // $1,000, well above $500 combined), so the investor keeps 100% of
    // each — not a 70% split. After refunding the $300 transaction, only
    // the $200 transaction's full amount remains.
    expect(Number(updated.investorRevenueEarned)).toBe(200);
  });
});

describe("Capital deployment", () => {
  it("deploys capital up to (but never beyond) the funded principal", async () => {
    const fixture = await createTestFixture(`${RUN_ID}-deploy`);
    userIdsToClean.push(fixture.developerUser.id, fixture.investorUser.id);

    const opportunity = await createOpportunityFixture({
      appId: fixture.app.id,
    });
    // Backdate the investment itself — that's what runCapitalDeploymentForApp
    // uses as the funding date now, not opportunity.startDate.
    const investment = await prisma.investment.create({
      data: {
        investorId: fixture.investorUser.investorProfile!.id,
        opportunityId: opportunity.id,
        principalAmount: 200, // deliberately small vs. spend below
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      },
    });

    // $500 of spend across 5 days, well beyond the $200 principal.
    for (let i = 0; i < 5; i++) {
      const date = new Date(Date.now() - 1000 * 60 * 60 * 24 * (4 - i));
      date.setUTCHours(0, 0, 0, 0);
      await prisma.campaignDailyMetric.create({
        data: {
          campaignId: fixture.campaign.id,
          date,
          spend: 100,
          impressions: 1000,
          clicks: 50,
          conversions: 10,
          provider: "TIKTOK",
        },
      });
    }

    await runCapitalDeploymentForApp(fixture.app.id);

    const updated = await prisma.investment.findUniqueOrThrow({ where: { id: investment.id } });
    expect(Number(updated.capitalDeployed)).toBe(200); // capped at principal, not $500
  });
});
