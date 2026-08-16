import { prisma } from "@/lib/prisma";
import type {
  AdvertisingAccount,
  AdvertisingProvider,
  Campaign,
  CampaignMetrics,
  ConnectionResult,
} from "./types";

/**
 * Real Meta (Facebook/Instagram) Marketing API + Ads Insights API adapter.
 *
 * Required env vars: META_APP_ID, META_APP_SECRET, META_REDIRECT_URI,
 * plus a per-connection access token (constructor param).
 *
 * Confirmed real against Meta's own docs, 2026-08-16:
 *  - Base URL: https://graph.facebook.com/v25.0 (Graph API version — this
 *    is on Meta's regular deprecation schedule, re-verify periodically).
 *  - Auth: `access_token` query parameter on every request (Meta also
 *    accepts `Authorization: Bearer`, both documented as valid).
 *  - Campaigns: GET /act_{ad_account_id}/campaigns?fields=id,name,
 *    daily_budget,effective_status,created_time
 *  - Insights: GET /{campaign_id}/insights?fields=impressions,clicks,
 *    spend,actions&time_range={since,until}&time_increment=1&level=campaign
 *    — response shape { data: [{ date_start, date_stop, impressions,
 *    clicks, spend, actions: [{action_type, value}] }], paging }.
 *  - Meta's Sandbox Ad Account (created from Marketing API > Tools in the
 *    developer console) uses this SAME graph.facebook.com host and
 *    endpoints — no separate sandbox domain like TikTok's, it's just an
 *    ad account that accepts real read/write calls but never delivers
 *    real ads or spends real money.
 *
 * NOT independently confirmed — genuinely conflicting information found
 * across sources, flagged rather than guessed:
 *  - Whether `daily_budget` (campaign object field) and `spend`/
 *    `action_values` (insights fields) are in whole currency units or
 *    minor-unit cents. One real documented example showed spend as a
 *    decimal ("spend": 2352.45), which is inconsistent with raw-integer
 *    cents — but another source claimed both fields use cents
 *    consistently. VERIFY against one real sandbox insights response
 *    (a campaign with a KNOWN budget) before trusting these numbers for
 *    anything beyond structural testing — this file currently does NOT
 *    divide by 100 anywhere, trusting the concrete decimal example.
 *  - me/adaccounts as the exact account-listing endpoint (very standard,
 *    high confidence, but not fetched from a live response this session).
 *  - Which `actions[].action_type` value corresponds to "conversions" for
 *    an install campaign — mobile_app_install is used below as the most
 *    likely candidate; verify against a real campaign's actual action
 *    types, which vary by objective.
 *
 * Falls back to MockMetaAdvertisingProvider automatically when
 * unconfigured — see getAdvertisingProvider() in
 * src/lib/integrations/provider-factory.ts.
 */
const BASE_URL = "https://graph.facebook.com/v25.0";
const INSTALL_ACTION_TYPE = "mobile_app_install";

type MetaAction = { action_type: string; value: string };

type MetaCampaign = {
  id: string;
  name: string;
  daily_budget?: string;
  effective_status: string;
  created_time: string;
};

type MetaInsightRow = {
  date_start: string;
  date_stop: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: MetaAction[];
};

export class MetaAdvertisingProvider implements AdvertisingProvider {
  readonly providerName = "Meta";

  constructor(private readonly accessToken: string) {}

  static isConfigured(): boolean {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI);
  }

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("access_token", this.accessToken);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok || body.error) {
      const message = body.error ? `${body.error.type}: ${body.error.message}` : await res.text();
      throw new Error(`Meta ${path} failed: ${res.status} ${message}`);
    }
    return body as T;
  }

  async connect(): Promise<ConnectionResult> {
    return {
      ok: false,
      error:
        "Meta OAuth connect flow not yet implemented — a Sandbox Ad Account's access token is generated directly in the developer console and doesn't need it. See INTEGRATIONS.md.",
    };
  }

  async listAccounts(): Promise<AdvertisingAccount[]> {
    const data = await this.request<{ data: { id: string; name?: string }[] }>("/me/adaccounts", {
      fields: "id,name",
    });
    return data.data.map((a) => ({ externalAccountId: a.id, name: a.name ?? a.id }));
  }

  async listCampaigns(accountId: string): Promise<Campaign[]> {
    const data = await this.request<{ data: MetaCampaign[] }>(`/${accountId}/campaigns`, {
      fields: "id,name,daily_budget,effective_status,created_time",
    });
    return data.data.map((c) => ({
      externalCampaignId: c.id,
      name: c.name,
      dailyBudget: Number(c.daily_budget ?? 0),
      status: mapStatus(c.effective_status),
      startDate: c.created_time.slice(0, 10),
    }));
  }

  async getCampaignMetrics(campaignId: string, start: Date, end: Date): Promise<CampaignMetrics[]> {
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return [];

    const data = await this.request<{ data: MetaInsightRow[] }>(`/${campaign.externalCampaignId}/insights`, {
      fields: "impressions,clicks,spend,actions",
      time_range: JSON.stringify({ since: formatDate(start), until: formatDate(end) }),
      time_increment: "1",
      level: "campaign",
    });

    return data.data.map((row) => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      date: row.date_start,
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversions: sumAction(row.actions, INSTALL_ACTION_TYPE),
      // Not present per-row in the insights response — tied to the ad
      // account's billing currency instead, not fetched here.
      currency: "USD",
    }));
  }
}

function sumAction(actions: MetaAction[] | undefined, actionType: string): number {
  if (!actions) return 0;
  return actions.filter((a) => a.action_type === actionType).reduce((sum, a) => sum + Number(a.value ?? 0), 0);
}

function mapStatus(effectiveStatus: string): Campaign["status"] {
  if (effectiveStatus === "ACTIVE") return "ACTIVE";
  if (effectiveStatus === "PAUSED") return "PAUSED";
  return "ENDED";
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
