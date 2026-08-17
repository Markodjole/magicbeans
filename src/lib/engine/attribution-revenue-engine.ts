import { prisma } from "@/lib/prisma";
import type { AttributionConfidence } from "@/generated/prisma/client";
import { recordLedgerEntry } from "@/lib/ledger/ledger";
import { applyRevenueWaterfall, eligibleAttributedAmount, isEligibleConfidence } from "./revenue-share";

const HIGH_CONFIDENCE_WINDOW_DAYS = 30;

/**
 * THE central service (per spec: "the biggest feature is not the
 * marketplace, it's provable money flow"). Takes every AppTransaction
 * that doesn't yet have a RevenueAttribution, walks
 * transaction -> AppCustomer -> AttributedInstall -> MarketingCampaign,
 * assigns a confidence level, persists a RevenueAttribution row, and
 * splits eligible revenue across every ACTIVE investment for that app —
 * across ANY of its standing-terms vintages, not just one campaign or
 * one opportunity — respecting each investment's own return cap.
 *
 * Revenue is pooled and divided purely by each investment's share of
 * TOTAL active principal for the app, regardless of which terms vintage
 * it was made under; each investment's own slice is then split using
 * whichever revenue-share percentages/cap it individually locked in.
 * This is what makes "developer changes 70/30 to 60/40" only affect new
 * money — existing investors keep exactly the terms they signed up for,
 * while still drawing from the same shared revenue pool proportionally
 * to their capital.
 *
 * Nothing here is ever computed only in the UI: every number a page
 * shows is read back from what this function persisted.
 */
export async function runAttributionRevenueEngineForApp(appId: string): Promise<{ processed: number }> {
  const unattributedTransactions = await prisma.appTransaction.findMany({
    where: { appId, refundedAt: null, revenueAttributions: { none: {} } },
    include: { appCustomer: { include: { installs: true } } },
  });

  let processed = 0;
  for (const transaction of unattributedTransactions) {
    await processTransaction(transaction.id);
    processed++;
  }
  return { processed };
}

async function processTransaction(transactionId: string) {
  const transaction = await prisma.appTransaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { appCustomer: { include: { installs: true } } },
  });

  const install = transaction.appCustomer.installs.sort(
    (a, b) => a.installedAt.getTime() - b.installedAt.getTime()
  )[0];

  let confidence: AttributionConfidence;
  let attributionMethod: string;
  let campaignId: string | null = null;
  const attributionProvider = install?.attributionProvider;

  if (!install) {
    confidence = "UNATTRIBUTED";
    attributionMethod = "no_install_record";
  } else if (install.campaignId) {
    campaignId = install.campaignId;
    const daysSinceInstall = (transaction.purchasedAt.getTime() - install.installedAt.getTime()) / 86_400_000;
    if (daysSinceInstall <= HIGH_CONFIDENCE_WINDOW_DAYS) {
      confidence = "HIGH";
      attributionMethod = "direct_campaign_match";
    } else {
      confidence = "MEDIUM";
      attributionMethod = "delayed_campaign_match";
    }
  } else {
    confidence = "LOW";
    attributionMethod = "inferred_media_source";
  }

  if (!campaignId) {
    // Nothing to attribute revenue to; UNATTRIBUTED/LOW-without-campaign
    // transactions still deserve a record for auditability, but there's
    // no campaign to tie it to.
    if (confidence === "UNATTRIBUTED") return;
    // LOW without a campaign id can't be linked to a specific campaign row
    // (FK is required) — skip persisting until inference can resolve one.
    return;
  }

  await prisma.$transaction(async (tx) => {
    const attribution = await tx.revenueAttribution.create({
      data: {
        transactionId: transaction.id,
        campaignId,
        attributionProvider: attributionProvider!,
        confidence,
        attributedAmount: transaction.amount,
        attributionMethod,
      },
    });

    const eligible = eligibleAttributedAmount(Number(transaction.amount), confidence);
    if (eligible <= 0) return;

    // Pool ALL of this app's active investments, across every
    // standing-terms vintage — not scoped to one campaign or opportunity.
    // Only investments that existed by the time this transaction happened
    // are eligible: an investor who joins later must never retroactively
    // draw from revenue generated before their money was in.
    const activeInvestments = await tx.investment.findMany({
      where: {
        status: "ACTIVE",
        opportunity: { appId: transaction.appId },
        createdAt: { lte: transaction.purchasedAt },
      },
      include: { opportunity: true },
    });
    const totalPrincipal = activeInvestments.reduce((sum, inv) => sum + Number(inv.principalAmount), 0);

    if (totalPrincipal <= 0) {
      // No investor capital active for this app yet — still record the
      // raw attributed-revenue event, just untagged (nothing to trace it
      // to on an investment's audit page since no investment exists).
      await recordLedgerEntry(tx, {
        type: "ATTRIBUTED_REVENUE",
        amount: eligible,
        description: `Attributed revenue from transaction ${transaction.transactionId}`,
        metadata: { transactionId: transaction.id, campaignId, confidence },
      });
      return;
    }

    // One ATTRIBUTED_REVENUE rollup entry per terms-vintage involved,
    // sized to that vintage's share of the pool — so it shows up
    // correctly on every affected investment's audit timeline via
    // opportunityId (see getInvestmentAuditTimeline).
    const weightByOpportunity = new Map<string, number>();
    for (const inv of activeInvestments) {
      const weight = Number(inv.principalAmount) / totalPrincipal;
      weightByOpportunity.set(inv.opportunityId, (weightByOpportunity.get(inv.opportunityId) ?? 0) + weight);
    }
    for (const [opportunityId, weight] of weightByOpportunity) {
      await recordLedgerEntry(tx, {
        type: "ATTRIBUTED_REVENUE",
        amount: Math.round(eligible * weight * 100) / 100,
        opportunityId,
        description: `Attributed revenue from transaction ${transaction.transactionId}`,
        metadata: { transactionId: transaction.id, campaignId, confidence },
      });
    }

    for (const investment of activeInvestments) {
      const opportunity = investment.opportunity;
      const weight = Number(investment.principalAmount) / totalPrincipal;

      // Recoup-then-split waterfall: this investment's weighted slice of
      // revenue repays its own principal in full (100% to the investor)
      // before the investor/developer percentage split applies to
      // anything above that — see applyRevenueWaterfall's doc comment.
      const waterfall = applyRevenueWaterfall({
        slice: eligible * weight,
        principalAmount: Number(investment.principalAmount),
        returnCapMultiple: Number(opportunity.returnCapMultiple),
        investorSharePercent: Number(opportunity.investorRevenueSharePercent),
        developerSharePercent: Number(opportunity.developerRevenueSharePercent),
        investorRevenueEarnedSoFar: Number(investment.investorRevenueEarned),
      });

      await tx.revenueShareAccrual.create({
        data: {
          investmentId: investment.id,
          revenueAttributionId: attribution.id,
          investorAmount: waterfall.investorAmount,
          developerAmount: waterfall.developerAmount,
        },
      });

      if (waterfall.investorAmount > 0) {
        await recordLedgerEntry(tx, {
          type: "INVESTOR_REVENUE_SHARE",
          amount: waterfall.investorAmount,
          investmentId: investment.id,
          description: `Investor revenue share from transaction ${transaction.transactionId}`,
          metadata: { revenueAttributionId: attribution.id },
        });
      }
      await recordLedgerEntry(tx, {
        type: "DEVELOPER_REVENUE_SHARE",
        amount: waterfall.developerAmount,
        opportunityId: opportunity.id,
        description: `Developer revenue share from transaction ${transaction.transactionId}`,
        metadata: { investmentId: investment.id, revenueAttributionId: attribution.id },
      });

      const newInvestorEarned = Number(investment.investorRevenueEarned) + waterfall.investorAmount;
      await tx.investment.update({
        where: { id: investment.id },
        data: {
          attributableRevenue: { increment: eligible * weight },
          investorRevenueEarned: { increment: waterfall.investorAmount },
          developerRevenueEarned: { increment: waterfall.developerAmount },
          currentReturnMultiple: newInvestorEarned / Number(investment.principalAmount),
          status: waterfall.capReached ? "COMPLETED" : investment.status,
        },
      });
    }
  }, { timeout: 30_000, maxWait: 10_000 });
}

export { applyRevenueWaterfall, eligibleAttributedAmount, isEligibleConfidence };
