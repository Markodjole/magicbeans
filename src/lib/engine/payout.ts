import { prisma } from "@/lib/prisma";
import { recordLedgerEntry } from "@/lib/ledger/ledger";
import { getPaymentProvider } from "@/lib/integrations/provider-factory";
import { round2 } from "./revenue-share";

/**
 * Pays out an investment's currently-owed balance (investorRevenueEarned
 * minus what's already been paid). Never pays more than what's actually
 * been earned and recorded via RevenueShareAccrual — this reads the
 * Investment row's own aggregate, which is itself only ever updated by
 * AttributionRevenueEngine/refund.ts, so a payout can't outrun real
 * accrued revenue.
 */
export async function runPayoutForInvestment(investmentId: string): Promise<{ paid: number } | null> {
  const investment = await prisma.investment.findUniqueOrThrow({ where: { id: investmentId } });
  const owed = round2(Number(investment.investorRevenueEarned) - Number(investment.amountPaidToInvestor));
  if (owed <= 0) return null;

  const paymentProvider = getPaymentProvider();
  const payout = await paymentProvider.createPayout({ investorId: investment.investorId, amount: owed, currency: "USD" });
  if (payout.status !== "SUCCEEDED") return null;

  await prisma.$transaction(async (tx) => {
    await tx.payout.create({
      data: {
        investorId: investment.investorId,
        investmentId: investment.id,
        amount: owed,
        status: "PAID",
        externalPayoutId: payout.externalPayoutId,
        isMock: paymentProvider.providerName === "Mock",
        paidAt: new Date(),
      },
    });
    await tx.investment.update({
      where: { id: investment.id },
      data: { amountPaidToInvestor: { increment: owed } },
    });
    await recordLedgerEntry(tx, {
      type: "INVESTOR_PAYOUT",
      amount: owed,
      investmentId: investment.id,
      description: "Investor payout",
      metadata: { externalPayoutId: payout.externalPayoutId },
    });
  }, { timeout: 30_000, maxWait: 10_000 });

  return { paid: owed };
}

/**
 * Pays out a marketer's currently-owed balance on a CPA campaign — the
 * sum of net payouts across every verified CampaignConversion, minus
 * whatever's already been paid out. Same shape as runPayoutForInvestment,
 * but there's no cached running total on MarketingCampaign the way
 * Investment.investorRevenueEarned works, so both sides are summed live
 * from CampaignConversion/Payout — acceptable at this volume (per
 * verified subscriber, not per transaction).
 */
export async function runPayoutForCampaign(campaignId: string): Promise<{ paid: number } | null> {
  const campaign = await prisma.marketingCampaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (!campaign.marketerId) return null;

  const [earnedAgg, paidAgg] = await Promise.all([
    prisma.campaignConversion.aggregate({
      where: { campaignId, reversedAt: null },
      _sum: { netPayout: true },
    }),
    prisma.payout.aggregate({
      where: { campaignId },
      _sum: { amount: true },
    }),
  ]);
  const owed = round2(Number(earnedAgg._sum.netPayout ?? 0) - Number(paidAgg._sum.amount ?? 0));
  if (owed <= 0) return null;

  const paymentProvider = getPaymentProvider();
  const payout = await paymentProvider.createPayout({ investorId: campaign.marketerId, amount: owed, currency: "USD" });
  if (payout.status !== "SUCCEEDED") return null;

  await prisma.$transaction(async (tx) => {
    await tx.payout.create({
      data: {
        investorId: campaign.marketerId!,
        campaignId: campaign.id,
        amount: owed,
        status: "PAID",
        externalPayoutId: payout.externalPayoutId,
        isMock: paymentProvider.providerName === "Mock",
        paidAt: new Date(),
      },
    });
    await recordLedgerEntry(tx, {
      type: "MARKETER_PAYOUT",
      amount: owed,
      campaignId: campaign.id,
      description: "Marketer payout",
      metadata: { externalPayoutId: payout.externalPayoutId },
    });
  }, { timeout: 30_000, maxWait: 10_000 });

  return { paid: owed };
}
