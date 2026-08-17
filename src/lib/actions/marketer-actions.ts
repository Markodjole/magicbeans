"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireInvestorProfile } from "@/lib/authz";
import { getOrCreateConnection } from "@/lib/integrations/provider-factory";
import { runPayoutForCampaign } from "@/lib/engine/payout";

const LaunchCampaignSchema = z.object({
  offerId: z.string().min(1),
  creativeId: z.string().min(1),
  targetingTemplateId: z.string().min(1),
  declaredBudget: z.coerce.number().positive(),
  durationDays: z.coerce.number().int().min(1).max(90),
});

/**
 * A marketer accepts a performance offer: picks one approved creative and
 * one approved targeting template, declares a budget they're funding
 * directly with the ad platform, and launches. This is the pivot's core
 * transaction — a services gig, not an investment. Two things
 * deliberately differ from investInOpportunity:
 *
 * 1. No payment is processed for declaredBudget. MagicBeans never touches
 *    that money — the marketer pays the ad platform themselves. There's
 *    no equivalent of INVESTMENT_DEPOSIT here; declaredBudget is purely
 *    informational, for comparing against the ad platform's real
 *    imported spend once campaigns run.
 * 2. The campaign still executes through the app's own connected ad
 *    account (MagicBeans creates/manages it via the advertising API,
 *    same infra as a developer's own campaigns) — the marketer isn't
 *    required to bring their own ad account for this first version.
 */
export async function launchMarketerCampaign(_prevState: { error?: string; campaignId?: string }, formData: FormData) {
  const profile = await requireInvestorProfile();

  const parsed = LaunchCampaignSchema.safeParse({
    offerId: formData.get("offerId"),
    creativeId: formData.get("creativeId"),
    targetingTemplateId: formData.get("targetingTemplateId"),
    declaredBudget: formData.get("declaredBudget"),
    durationDays: formData.get("durationDays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const offer = await prisma.performanceOffer.findUniqueOrThrow({
    where: { id: parsed.data.offerId },
    include: { app: true },
  });
  if (offer.status !== "OPEN") return { error: "This offer is no longer accepting campaigns" };
  if (parsed.data.declaredBudget < Number(offer.minBudget)) {
    return { error: `Minimum budget for this offer is $${offer.minBudget}` };
  }

  const creative = await prisma.offerCreative.findFirstOrThrow({
    where: { id: parsed.data.creativeId, offerId: offer.id },
  });
  const targeting = await prisma.offerTargetingTemplate.findFirstOrThrow({
    where: { id: parsed.data.targetingTemplateId, offerId: offer.id },
  });

  const connection = await getOrCreateConnection(offer.appId, "ADVERTISING", creative.channel);
  const account =
    (await prisma.advertisingAccount.findFirst({ where: { appId: offer.appId, provider: creative.channel } })) ??
    (await prisma.advertisingAccount.create({
      data: {
        appId: offer.appId,
        integrationConnectionId: connection.id,
        provider: creative.channel,
        externalAccountId: `mock-${creative.channel.toLowerCase()}-${offer.appId}`,
        name: `${creative.channel} Demo Account`,
      },
    }));

  const campaign = await prisma.marketingCampaign.create({
    data: {
      appId: offer.appId,
      advertisingAccountId: account.id,
      provider: creative.channel,
      externalCampaignId: `marketer-campaign-${Date.now()}`,
      name: `${offer.app.name} — ${creative.name} / ${targeting.name}`,
      dailyBudget: Math.round((parsed.data.declaredBudget / parsed.data.durationDays) * 100) / 100,
      status: "ACTIVE",
      startDate: new Date(),
      isMock: true,
      marketerId: profile.id,
      offerId: offer.id,
      creativeId: creative.id,
      targetingTemplateId: targeting.id,
      declaredBudget: parsed.data.declaredBudget,
      durationDays: parsed.data.durationDays,
      launchedAt: new Date(),
    },
  });

  revalidatePath("/offers");
  revalidatePath("/investor");
  redirect(`/investor/campaigns/${campaign.id}`);
}

/**
 * Requests payout of whatever's currently owed on a campaign — sum of
 * net payouts across every verified conversion, minus what's already
 * been paid. See runPayoutForCampaign for why this can't overpay.
 */
export async function requestCampaignPayout(campaignId: string) {
  const profile = await requireInvestorProfile();
  const campaign = await prisma.marketingCampaign.findFirstOrThrow({ where: { id: campaignId, marketerId: profile.id } });
  const result = await runPayoutForCampaign(campaign.id);
  revalidatePath(`/investor/campaigns/${campaignId}`);
  return result;
}
