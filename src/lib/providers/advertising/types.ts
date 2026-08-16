export type CampaignMetrics = {
  campaignId: string;
  campaignName: string;
  date: string; // YYYY-MM-DD

  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;

  currency: string;
};

export type AdvertisingAccount = {
  externalAccountId: string;
  name: string;
};

export type Campaign = {
  externalCampaignId: string;
  name: string;
  dailyBudget: number;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  startDate: string;
};

export type ConnectionResult =
  | { ok: true; externalAccountId: string }
  | { ok: false; error: string };

/**
 * Every advertising integration (TikTok, Meta, Google Ads, ...) implements
 * this interface. Nothing outside src/lib/providers/advertising and
 * src/lib/integrations should ever import a specific provider class — code
 * that needs ad data resolves an AdvertisingProvider through
 * getAdvertisingProvider() and must not know or care whether it's LIVE or
 * MOCK underneath.
 */
export interface AdvertisingProvider {
  readonly providerName: string;

  connect(): Promise<ConnectionResult>;
  listAccounts(): Promise<AdvertisingAccount[]>;
  listCampaigns(accountId: string): Promise<Campaign[]>;
  getCampaignMetrics(
    campaignId: string,
    start: Date,
    end: Date
  ): Promise<CampaignMetrics[]>;
}
