import { prisma } from "@/lib/prisma";
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
 * GOOGLE_ADS_DEVELOPER_TOKEN, plus a per-connection refresh token
 * (constructor param).
 *
 * Confirmed real against Google's own docs/examples, 2026-08-16:
 *  - Base URL: https://googleads.googleapis.com/v25 (on Google's regular
 *    deprecation schedule — re-verify periodically).
 *  - Auth: OAuth2 refresh-token exchange (POST oauth2.googleapis.com/token,
 *    standard Google OAuth2, not Ads-specific) for a short-lived access
 *    token, sent as `Authorization: Bearer`, PLUS a `developer-token`
 *    header on every Ads API call (separate from the OAuth token).
 *  - Reporting: POST /customers/{customer_id}/googleAds:search with a
 *    GAQL query body `{ query: "..." }`. Response shape confirmed real:
 *    `{ results: [{ campaign: {...}, metrics: {...}, segments: {...} }] }`
 *    — JSON fields are camelCase (`costMicros`) even though GAQL query
 *    syntax is snake_case (`metrics.cost_micros`). Monetary fields are in
 *    MICROS (divide by 1,000,000 for the actual currency amount) —
 *    confirmed from a real documented example, not guessed.
 *  - Listing accounts: GET /customers:listAccessibleCustomers ->
 *    { resourceNames: ["customers/1234567890", ...] }.
 *  - Error shape: standard Google API `{ error: { code, message,
 *    status } }`.
 *
 * NOT independently confirmed from a live response this session (high
 * confidence from general Ads API knowledge, but flagged per project
 * convention rather than asserted as verified):
 *  - `campaign_budget.amount_micros` -> JSON `campaignBudget.amountMicros`
 *  - `campaign.status` enum values (ENABLED/PAUSED/REMOVED, not ACTIVE)
 *  - `campaign.start_date` -> JSON `campaign.startDate`
 *
 * Falls back to MockGoogleAdvertisingProvider automatically when
 * unconfigured — see getAdvertisingProvider() in
 * src/lib/integrations/provider-factory.ts.
 */
const API_VERSION = "v25";
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
const MICROS_PER_UNIT = 1_000_000;

type GoogleAdsCampaignRow = {
  campaign: { id: string; name: string; status: string; startDate?: string };
  campaignBudget?: { amountMicros?: string };
};

type GoogleAdsMetricsRow = {
  segments: { date: string };
  metrics: { impressions?: string; clicks?: string; costMicros?: string; conversions?: string };
};

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

  private async getAccessToken(): Promise<string> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(`Google OAuth token refresh failed: ${res.status} ${body.error_description ?? body.error}`);
    }
    return body.access_token as string;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.getAccessToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const body = await res.json();
    if (!res.ok || body.error) {
      const message = body.error ? `${body.error.status}: ${body.error.message}` : await res.text();
      throw new Error(`Google Ads ${path} failed: ${res.status} ${message}`);
    }
    return body as T;
  }

  private async search<T>(customerId: string, gaql: string): Promise<T[]> {
    const body = await this.request<{ results?: T[] }>(`/customers/${customerId}/googleAds:search`, {
      method: "POST",
      body: JSON.stringify({ query: gaql }),
    });
    return body.results ?? [];
  }

  async connect(): Promise<ConnectionResult> {
    return {
      ok: false,
      error: "Google Ads OAuth connect flow not yet implemented — see INTEGRATIONS.md.",
    };
  }

  async listAccounts(): Promise<AdvertisingAccount[]> {
    const data = await this.request<{ resourceNames: string[] }>("/customers:listAccessibleCustomers");
    return data.resourceNames.map((rn) => {
      const id = rn.split("/")[1];
      return { externalAccountId: id, name: rn };
    });
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    const rows = await this.search<GoogleAdsCampaignRow>(
      accountId,
      "SELECT campaign.id, campaign.name, campaign.status, campaign.start_date, campaign_budget.amount_micros FROM campaign"
    );
    return rows.map((r) => ({
      externalCampaignId: r.campaign.id,
      name: r.campaign.name,
      dailyBudget: Number(r.campaignBudget?.amountMicros ?? 0) / MICROS_PER_UNIT,
      status: mapStatus(r.campaign.status),
      startDate: r.campaign.startDate ?? new Date().toISOString().slice(0, 10),
    }));
  }

  async getCampaignMetrics(campaignId: string, start: Date, end: Date): Promise<CampaignMetrics[]> {
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: { advertisingAccount: true },
    });
    if (!campaign) return [];

    const gaql = `SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.id = ${campaign.externalCampaignId}
      AND segments.date BETWEEN '${formatDate(start)}' AND '${formatDate(end)}'`;

    const rows = await this.search<GoogleAdsMetricsRow>(campaign.advertisingAccount.externalAccountId, gaql);

    return rows.map((row) => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      date: row.segments.date,
      spend: Number(row.metrics.costMicros ?? 0) / MICROS_PER_UNIT,
      impressions: Number(row.metrics.impressions ?? 0),
      clicks: Number(row.metrics.clicks ?? 0),
      conversions: Number(row.metrics.conversions ?? 0),
      // Not present per-row — tied to the account's billing currency, not fetched here.
      currency: "USD",
    }));
  }
}

function mapStatus(status: string): Campaign["status"] {
  if (status === "ENABLED") return "ACTIVE";
  if (status === "PAUSED") return "PAUSED";
  return "ENDED";
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
