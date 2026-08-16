import { prisma } from "@/lib/prisma";
import { recordLedgerEntry } from "@/lib/ledger/ledger";
import { round2 } from "./revenue-share";

/**
 * Handles a transaction being refunded after revenue share was already
 * accrued against it. Per spec's exact example: $100 revenue, $70 already
 * accrued to the investor (70% share) — refunding creates reversal
 * entries (ATTRIBUTED_REVENUE-equivalent -$100, investor -$70, developer
 * -$30) rather than deleting or editing the original rows. Financial
 * history stays fully intact and auditable.
 */
export async function handleTransactionRefund(transactionId: string, refundedAt: Date = new Date()): Promise<void> {
  const transaction = await prisma.appTransaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: {
      revenueAttributions: {
        where: { reversalOf: null },
        include: {
          revenueShareAccruals: {
            where: { reversedAt: null },
            include: { investment: { select: { opportunityId: true } } },
          },
        },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.appTransaction.update({ where: { id: transactionId }, data: { refundedAt } });

    for (const attribution of transaction.revenueAttributions) {
      if (attribution.reversedAt) continue;

      await tx.revenueAttribution.update({ where: { id: attribution.id }, data: { reversedAt: refundedAt } });
      await tx.revenueAttribution.create({
        data: {
          transactionId: attribution.transactionId,
          campaignId: attribution.campaignId,
          investmentId: attribution.investmentId,
          attributionProvider: attribution.attributionProvider,
          confidence: attribution.confidence,
          attributedAmount: -Number(attribution.attributedAmount),
          attributionMethod: "refund_reversal",
          reversalOfId: attribution.id,
        },
      });

      // One REFUND rollup entry per terms-vintage that actually had
      // revenue accrued against it — sized to what was really paid out
      // (investor + developer amounts), not the raw pre-eligibility
      // transaction amount, and grouped by opportunity the same way
      // ATTRIBUTED_REVENUE is (a refund can span multiple vintages if the
      // original revenue was pooled across several).
      const refundByOpportunity = new Map<string, number>();
      for (const accrual of attribution.revenueShareAccruals) {
        const opportunityId = accrual.investment.opportunityId;
        const paidOut = Number(accrual.investorAmount) + Number(accrual.developerAmount);
        refundByOpportunity.set(opportunityId, (refundByOpportunity.get(opportunityId) ?? 0) + paidOut);
      }
      for (const [opportunityId, paidOut] of refundByOpportunity) {
        if (paidOut === 0) continue;
        await recordLedgerEntry(tx, {
          type: "REFUND",
          amount: -paidOut,
          opportunityId,
          description: `Refund reversal of attributed revenue for transaction ${transaction.transactionId}`,
          metadata: { transactionId: transaction.id, campaignId: attribution.campaignId, revenueAttributionId: attribution.id },
        });
      }

      for (const accrual of attribution.revenueShareAccruals) {
        await tx.revenueShareAccrual.update({ where: { id: accrual.id }, data: { reversedAt: refundedAt } });

        const investorAmount = Number(accrual.investorAmount);
        const developerAmount = Number(accrual.developerAmount);

        if (investorAmount !== 0) {
          await recordLedgerEntry(tx, {
            type: "REVERSAL",
            amount: -investorAmount,
            investmentId: accrual.investmentId,
            description: `Reversal of investor revenue share for transaction ${transaction.transactionId}`,
            metadata: { revenueShareAccrualId: accrual.id, reversedType: "INVESTOR_REVENUE_SHARE" },
          });
        }
        if (developerAmount !== 0) {
          await recordLedgerEntry(tx, {
            type: "REVERSAL",
            amount: -developerAmount,
            investmentId: accrual.investmentId,
            description: `Reversal of developer revenue share for transaction ${transaction.transactionId}`,
            metadata: { revenueShareAccrualId: accrual.id, reversedType: "DEVELOPER_REVENUE_SHARE" },
          });
        }

        const investment = await tx.investment.findUniqueOrThrow({ where: { id: accrual.investmentId } });
        const newInvestorEarned = round2(Number(investment.investorRevenueEarned) - investorAmount);
        const newDeveloperEarned = round2(Number(investment.developerRevenueEarned) - developerAmount);
        const newAttributable = round2(Number(investment.attributableRevenue) - investorAmount - developerAmount);

        await tx.investment.update({
          where: { id: accrual.investmentId },
          data: {
            investorRevenueEarned: newInvestorEarned,
            developerRevenueEarned: newDeveloperEarned,
            attributableRevenue: Math.max(0, newAttributable),
            currentReturnMultiple: newInvestorEarned / Number(investment.principalAmount),
            status: investment.status === "COMPLETED" ? "ACTIVE" : investment.status,
          },
        });
      }
    }
  });
}
