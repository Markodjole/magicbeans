import { prisma } from "@/lib/prisma";
import { getAdvertisingProvider } from "@/lib/integrations/provider-factory";
import { recordLedgerEntry } from "@/lib/ledger/ledger";

/**
 * Pulls CampaignMetrics from an app's connected advertising provider(s)
 * and upserts CampaignDailyMetric rows with full provenance (provider,
 * externalId, syncedAt, sourceType, isMock). Also writes one AD_SPEND
 * ledger entry per newly-imported day, tagged to the app's current
 * standing funding terms (if any are OPEN), so ad spend is auditable
 * independent of any investment even before the app has investors — a
 * campaign isn't scoped to one specific opportunity anymore, so this
 * just uses whichever terms are currently accepting investment.
 */
export async function syncAdvertisingForApp(appId: string, start: Date, end: Date) {
  const connections = await prisma.integrationConnection.findMany({
    where: { appId, category: "ADVERTISING" },
  });

  const currentTerms = await prisma.investmentOpportunity.findFirst({ where: { appId, status: "OPEN" } });

  let recordsImported = 0;

  for (const connection of connections) {
    const syncJob = await prisma.syncJob.create({
      data: { integrationConnectionId: connection.id, jobType: "ADVERTISING", status: "RUNNING", lastAttemptedSync: new Date() },
    });

    try {
      const provider = await getAdvertisingProvider(connection);
      const campaigns = await prisma.marketingCampaign.findMany({
        where: { appId, provider: connection.provider },
      });

      for (const campaign of campaigns) {
        const metrics = await provider.getCampaignMetrics(campaign.id, start, end);
        for (const metric of metrics) {
          const date = new Date(metric.date);
          const existing = await prisma.campaignDailyMetric.findUnique({
            where: { campaignId_date: { campaignId: campaign.id, date } },
          });

          await prisma.campaignDailyMetric.upsert({
            where: { campaignId_date: { campaignId: campaign.id, date } },
            create: {
              campaignId: campaign.id,
              date,
              spend: metric.spend,
              impressions: metric.impressions,
              clicks: metric.clicks,
              conversions: metric.conversions,
              currency: metric.currency,
              provider: connection.provider,
              sourceType: connection.mode === "LIVE" ? "API" : "MOCK",
              isMock: connection.mode !== "LIVE",
            },
            update: {
              spend: metric.spend,
              impressions: metric.impressions,
              clicks: metric.clicks,
              conversions: metric.conversions,
              syncedAt: new Date(),
            },
          });

          if (!existing) {
            recordsImported++;
            await prisma.$transaction(async (tx) => {
              await recordLedgerEntry(tx, {
                type: "AD_SPEND",
                amount: metric.spend,
                opportunityId: currentTerms?.id,
                description: `${connection.provider} spend on ${campaign.name} for ${metric.date}`,
                metadata: { campaignId: campaign.id, date: metric.date, provider: connection.provider },
              });
            }, { timeout: 30_000, maxWait: 10_000 });
          }
        }
      }

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { status: "SUCCESS", lastSuccessfulSync: new Date(), recordsImported },
      });
    } catch (err) {
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
      });
      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { mode: connection.mode === "LIVE" ? "ERROR" : connection.mode, lastError: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  return { recordsImported };
}
