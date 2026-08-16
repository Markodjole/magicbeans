import { prisma } from "@/lib/prisma";
import type {
  AdvertisingAccount,
  AdvertisingProvider,
  Campaign,
  CampaignMetrics,
  ConnectionResult,
} from "./types";

/**
 * Real TikTok Business/Marketing API adapter.
 *
 * Required env vars: TIKTOK_APP_ID, TIKTOK_APP_SECRET, TIKTOK_REDIRECT_URI,
 * plus a per-connection access token (constructor param).
 *
 * Confirmed real against TikTok's own SDK/docs, 2026-08-16:
 *  - Base URL: production https://business-api.tiktok.com/open_api/v1.3,
 *    sandbox https://sandbox-ads.tiktok.com/open_api/v1.3 — entirely
 *    separate credential spaces; a sandbox token will not authenticate
 *    against the production base URL. Set TIKTOK_API_BASE_URL to switch.
 *  - Auth: a custom `Access-Token` request header — NOT `Authorization:
 *    Bearer`. This is a distinctive quirk of TikTok's Business API.
 *  - Reporting endpoint GET /report/integrated/get/ response shape:
 *    { code, message, request_id, data: { list: [{ dimensions: {...},
 *    metrics: {...} }] } }.
 *  - Sandbox tokens are generated directly on the app's detail page in
 *    the TikTok for Business Developer Portal — no OAuth redirect needed
 *    for sandbox testing (only relevant for production access).
 *
 * NOT independently confirmed (best-effort field names — verify against
 * one real sandbox response before trusting for anything beyond testing):
 *  - /campaign/get/'s exact field names (budget, operation_status,
 *    create_time)
 *  - the exact `filtering` JSON syntax for scoping a report to one
 *    campaign_id
 *  - advertiser/info/'s response fields for account display names —
 *    listAccounts() falls back to using the advertiser_id itself as the
 *    name since this couldn't be confirmed
 */
const DEFAULT_BASE_URL = "https://business-api.tiktok.com/open_api/v1.3";

type TikTokEnvelope<T> = { code: number; message: string; data: T };

type TikTokCampaign = {
  campaign_id: string;
  campaign_name: string;
  budget?: number;
  operation_status: string;
  create_time?: string;
};

type TikTokReportRow = {
  dimensions: { campaign_id: string; stat_time_day: string };
  metrics: { spend?: string; impressions?: string; clicks?: string; conversion?: string };
};

export class TikTokAdvertisingProvider implements AdvertisingProvider {
  readonly providerName = "TikTok";
  private readonly baseUrl = process.env.TIKTOK_API_BASE_URL || DEFAULT_BASE_URL;

  constructor(private readonly accessToken: string) {}

  static isConfigured(): boolean {
    return Boolean(process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_REDIRECT_URI);
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const res = await fetch(url, {
      headers: { "Access-Token": this.accessToken, "Content-Type": "application/json" },
    });
    if (!res.ok) {
      throw new Error(`TikTok ${path} failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as TikTokEnvelope<T>;
    if (body.code !== 0) {
      throw new Error(`TikTok ${path} returned error ${body.code}: ${body.message}`);
    }
    return body.data;
  }

  async connect(): Promise<ConnectionResult> {
    return {
      ok: false,
      error:
        "TikTok OAuth connect flow not yet implemented — sandbox tokens are generated directly in the developer portal and don't need it. See INTEGRATIONS.md.",
    };
  }

  async listAccounts(): Promise<AdvertisingAccount[]> {
    const data = await this.request<{ advertiser_ids: string[] }>("/oauth2/advertiser/get/", {});
    return data.advertiser_ids.map((id) => ({ externalAccountId: id, name: id }));
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    const data = await this.request<{ list: TikTokCampaign[] }>("/campaign/get/", {
      advertiser_id: accountId,
    });
    return data.list.map((c) => ({
      externalCampaignId: c.campaign_id,
      name: c.campaign_name,
      dailyBudget: Number(c.budget ?? 0),
      status: mapStatus(c.operation_status),
      startDate: c.create_time?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    }));
  }

  async getCampaignMetrics(campaignId: string, start: Date, end: Date): Promise<CampaignMetrics[]> {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: { advertisingAccount: true },
    });
    if (!campaign) return [];

    const data = await this.request<{ list: TikTokReportRow[] }>("/report/integrated/get/", {
      advertiser_id: campaign.advertisingAccount.externalAccountId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
      metrics: JSON.stringify(["spend", "impressions", "clicks", "conversion"]),
      start_date: formatDate(start),
      end_date: formatDate(end),
      filtering: JSON.stringify([
        { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify([campaign.externalCampaignId]) },
      ]),
      page_size: "1000",
    });

    return data.list.map((row) => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      date: row.dimensions.stat_time_day.slice(0, 10),
      spend: Number(row.metrics.spend ?? 0),
      impressions: Number(row.metrics.impressions ?? 0),
      clicks: Number(row.metrics.clicks ?? 0),
      conversions: Number(row.metrics.conversion ?? 0),
      // Not present per-row in the reporting response — tied to the
      // advertiser account's billing currency instead, not fetched here.
      currency: "USD",
    }));
  }
}

function mapStatus(operationStatus: string): Campaign["status"] {
  if (operationStatus === "ENABLE") return "ACTIVE";
  if (operationStatus === "DISABLE") return "PAUSED";
  return "ENDED";
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
