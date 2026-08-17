import type { Prisma } from "@/generated/prisma/client";
import { recordLedgerEntry } from "@/lib/ledger/ledger";
import { round2 } from "./revenue-share";

type TxClient = Prisma.TransactionClient;

/**
 * CPA marketplace payout — NOT a revenue-share waterfall. A marketer's
 * campaign is owed a flat payoutPerConversion exactly once, the first
 * time one of the customers it acquired becomes a paying subscriber. This
 * is a one-time bounty for delivering a customer, not an ongoing share of
 * that person's future revenue — renewals/repeat purchases from the same
 * customer never create a second payout. The (campaignId, appCustomerId)
 * unique constraint on CampaignConversion is what actually enforces that
 * at the database level, not this function's own logic, so a retried
 * sync can never double-pay.
 */
export async function processCpaConversion(
  tx: TxClient,
  params: {
    campaignId: string;
    appCustomerId: string;
    revenueAttributionId: string;
    transactionLabel: string;
  }
): Promise<{ recorded: boolean }> {
  const alreadyConverted = await tx.campaignConversion.findUnique({
    where: { campaignId_appCustomerId: { campaignId: params.campaignId, appCustomerId: params.appCustomerId } },
  });
  if (alreadyConverted) return { recorded: false };

  const campaign = await tx.marketingCampaign.findUniqueOrThrow({
    where: { id: params.campaignId },
    include: { offer: true },
  });
  if (!campaign.offer) return { recorded: false };

  const grossPayout = Number(campaign.offer.payoutPerConversion);
  const feePercent = Number(campaign.offer.marketplaceFeePercent);
  const marketplaceFee = round2(grossPayout * (feePercent / 100));
  const netPayout = round2(grossPayout - marketplaceFee);

  await tx.campaignConversion.create({
    data: {
      campaignId: params.campaignId,
      appCustomerId: params.appCustomerId,
      revenueAttributionId: params.revenueAttributionId,
      grossPayout,
      marketplaceFee,
      netPayout,
    },
  });

  await recordLedgerEntry(tx, {
    type: "CONVERSION_PAYOUT_OWED",
    amount: grossPayout,
    campaignId: params.campaignId,
    description: `Verified subscriber acquired via ${params.transactionLabel}`,
    metadata: { appCustomerId: params.appCustomerId, revenueAttributionId: params.revenueAttributionId },
  });
  await recordLedgerEntry(tx, {
    type: "MARKETPLACE_FEE",
    amount: marketplaceFee,
    campaignId: params.campaignId,
    description: "MagicBeans marketplace fee on verified subscriber",
    metadata: { appCustomerId: params.appCustomerId, revenueAttributionId: params.revenueAttributionId },
  });

  return { recorded: true };
}
