import { prisma } from "@/lib/prisma";
import { generateDailyMetrics } from "./mock-economics";
import type {
  AdvertisingAccount,
  AdvertisingProvider,
  Campaign,
  CampaignMetrics,
  ConnectionResult,
} from "./types";

/**
 * Shared behavior for every Mock*AdvertisingProvider. Real per-provider
 * classes only differ in providerName/display naming — the generated
 * numbers come from the shared deterministic economics model so an app's
 * story (winner vs loser) is consistent no matter which channel funded it.
 */
export abstract class MockAdvertisingProviderBase implements AdvertisingProvider {
  abstract readonly providerName: string;

  async connect(): Promise<ConnectionResult> {
    return { ok: true, externalAccountId: `mock-${this.providerName.toLowerCase()}-account` };
  }

  async listAccounts(): Promise<AdvertisingAccount[]> {
    return [
      {
        externalAccountId: `mock-${this.providerName.toLowerCase()}-account`,
        name: `${this.providerName} Demo Account`,
      },
    ];
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    const campaigns = await prisma.marketingCampaign.findMany({
      where: { advertisingAccount: { externalAccountId: accountId } },
    });
    return campaigns.map((c) => ({
      externalCampaignId: c.externalCampaignId,
      name: c.name,
      dailyBudget: Number(c.dailyBudget),
      status: c.status as Campaign["status"],
      startDate: c.startDate.toISOString().slice(0, 10),
    }));
  }

  async getCampaignMetrics(campaignId: string, start: Date, end: Date): Promise<CampaignMetrics[]> {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: { app: true },
    });
    if (!campaign) return [];

    const results: CampaignMetrics[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      results.push(
        generateDailyMetrics({
          appName: campaign.app.name,
          campaignId: campaign.id,
          campaignName: campaign.name,
          date: cursor,
        })
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    return results;
  }
}
