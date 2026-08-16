import type {
  AdvertisingAccount,
  AdvertisingProvider,
  Campaign,
  CampaignMetrics,
  ConnectionResult,
} from "./types";

/**
 * Real Google Ads API adapter.
 *
 * Required env vars: GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
 * GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_REFRESH_TOKEN.
 * Uses Google Ads API (GAQL reporting queries over gRPC/REST) — verify
 * the current API version and GAQL query shape against Google's official
 * Google Ads API docs before implementing; developer token approval tier
 * also affects which accounts are queryable.
 *
 * Falls back to MockGoogleAdvertisingProvider automatically when
 * unconfigured — see getAdvertisingProvider() in
 * src/lib/integrations/provider-factory.ts.
 */
export class GoogleAdvertisingProvider implements AdvertisingProvider {
  readonly providerName = "Google";

  constructor(private readonly refreshToken: string) {}

  static isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_ADS_CLIENT_ID &&
        process.env.GOOGLE_ADS_CLIENT_SECRET &&
        process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
        process.env.GOOGLE_ADS_REFRESH_TOKEN
    );
  }

  async connect(): Promise<ConnectionResult> {
    return { ok: false, error: "Google Ads LIVE adapter not yet implemented — see INTEGRATIONS.md" };
  }

  async listAccounts(): Promise<AdvertisingAccount[]> {
    throw new Error("Google Ads LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }

  async listCampaigns(_accountId: string): Promise<Campaign[]> {
    throw new Error("Google Ads LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }

  async getCampaignMetrics(_campaignId: string, _start: Date, _end: Date): Promise<CampaignMetrics[]> {
    throw new Error("Google Ads LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }
}
