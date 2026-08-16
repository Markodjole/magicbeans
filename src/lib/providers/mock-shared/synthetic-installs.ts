import { prisma } from "@/lib/prisma";
import { SeededRandom } from "@/lib/seeded-random";
import type { AttributedInstall } from "@/lib/providers/attribution/types";

/**
 * Single source of truth for "what installs happened, for which campaign,
 * on which day" used by BOTH the mock attribution providers (AppsFlyer /
 * Adjust) and the mock revenue provider (RevenueCat) — they must agree on
 * the same externalUserId/appUserId per install for the attribution chain
 * (campaign -> install -> user -> transaction) to actually link up, the
 * same way a real app passes one stable user id to both SDKs.
 */
export async function syntheticInstallsForApp(
  appId: string,
  start: Date,
  end: Date
): Promise<AttributedInstall[]> {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { appId },
    include: { dailyMetrics: { where: { date: { gte: start, lte: end } } } },
  });

  const countries = ["US", "US", "US", "GB", "CA", "AU", "DE"];
  const installs: AttributedInstall[] = [];
  for (const campaign of campaigns) {
    for (const metric of campaign.dailyMetrics) {
      const dateStr = metric.date.toISOString().slice(0, 10);
      for (let i = 0; i < metric.conversions; i++) {
        const rand = new SeededRandom(campaign.id, dateStr, "install", i);
        const installedAt = new Date(metric.date);
        installedAt.setHours(rand.int(0, 23), rand.int(0, 59), rand.int(0, 59));
        installs.push({
          externalUserId: `u_${campaign.id}_${dateStr}_${i}`,
          installedAt,
          mediaSource: campaign.provider,
          campaignId: campaign.id,
          campaignName: campaign.name,
          adGroupId: `${campaign.id}-adgroup-1`,
          adId: `${campaign.id}-ad-${rand.int(1, 3)}`,
          country: rand.pick(countries),
        });
      }
    }
  }
  return installs;
}
