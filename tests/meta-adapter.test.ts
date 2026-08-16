import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { MetaAdvertisingProvider } from "@/lib/providers/advertising/meta";
import { createTestFixture, deleteFixture } from "./helpers/fixtures";

/**
 * Meta Graph API v25.0 response shapes confirmed against Meta's own docs,
 * 2026-08-16 — see the doc comment in meta.ts. Fixture values below are
 * fabricated test data, not a real ad account's traffic.
 */
function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MetaAdvertisingProvider — real API structure, fabricated test data", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (fixture) await deleteFixture([fixture.developerUser.id, fixture.investorUser.id]);
  });

  it("sends access_token as a query parameter", async () => {
    const fetchMock = mockFetchOnce(200, { data: [] });
    const provider = new MetaAdvertisingProvider("test-access-token");

    await provider.listAccounts();

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("access_token")).toBe("test-access-token");
    expect(calledUrl.hostname).toBe("graph.facebook.com");
  });

  it("listAccounts maps me/adaccounts' real fields", async () => {
    mockFetchOnce(200, { data: [{ id: "act_1234567890", name: "GrowthFund Test Account" }] });
    const provider = new MetaAdvertisingProvider("test-access-token");

    const accounts = await provider.listAccounts();

    expect(accounts).toEqual([{ externalAccountId: "act_1234567890", name: "GrowthFund Test Account" }]);
  });

  it("listAccounts falls back to the id when name is missing", async () => {
    mockFetchOnce(200, { data: [{ id: "act_1234567890" }] });
    const provider = new MetaAdvertisingProvider("test-access-token");

    const accounts = await provider.listAccounts();

    expect(accounts).toEqual([{ externalAccountId: "act_1234567890", name: "act_1234567890" }]);
  });

  it("listCampaigns maps the real campaign object fields", async () => {
    mockFetchOnce(200, {
      data: [
        {
          id: "120210000000001",
          name: "StudySprint US Install Campaign",
          daily_budget: "130",
          effective_status: "ACTIVE",
          created_time: "2026-06-01T10:30:00+0000",
        },
      ],
    });
    const provider = new MetaAdvertisingProvider("test-access-token");

    const campaigns = await provider.listCampaigns("act_1234567890");

    expect(campaigns).toEqual([
      {
        externalCampaignId: "120210000000001",
        name: "StudySprint US Install Campaign",
        dailyBudget: 130,
        status: "ACTIVE",
        startDate: "2026-06-01",
      },
    ]);
  });

  it("maps effective_status PAUSED and anything else to ENDED", async () => {
    mockFetchOnce(200, {
      data: [
        { id: "1", name: "A", effective_status: "PAUSED", created_time: "2026-01-01T00:00:00+0000" },
        { id: "2", name: "B", effective_status: "ARCHIVED", created_time: "2026-01-01T00:00:00+0000" },
      ],
    });
    const provider = new MetaAdvertisingProvider("test-access-token");

    const campaigns = await provider.listCampaigns("act_1234567890");

    expect(campaigns[0].status).toBe("PAUSED");
    expect(campaigns[1].status).toBe("ENDED");
  });

  it("getCampaignMetrics maps insights rows and sums mobile_app_install actions", async () => {
    const runId = randomUUID().slice(0, 8);
    fixture = await createTestFixture(runId);

    mockFetchOnce(200, {
      data: [
        {
          date_start: "2026-08-15",
          date_stop: "2026-08-15",
          impressions: "18700",
          clicks: "421",
          spend: "84.20",
          actions: [
            { action_type: "mobile_app_install", value: "12" },
            { action_type: "link_click", value: "421" },
          ],
        },
      ],
    });
    const provider = new MetaAdvertisingProvider("test-access-token");

    const metrics = await provider.getCampaignMetrics(fixture.campaign.id, new Date("2026-08-15"), new Date("2026-08-15"));

    expect(metrics).toEqual([
      {
        campaignId: fixture.campaign.id,
        campaignName: "Test Campaign",
        date: "2026-08-15",
        spend: 84.2,
        impressions: 18700,
        clicks: 421,
        conversions: 12,
        currency: "USD",
      },
    ]);
  });

  it("returns 0 conversions when there's no matching action (e.g. no purchases yet)", async () => {
    const runId = randomUUID().slice(0, 8);
    fixture = await createTestFixture(runId);

    mockFetchOnce(200, {
      data: [{ date_start: "2026-08-15", date_stop: "2026-08-15", impressions: "100", clicks: "5", spend: "1.00" }],
    });
    const provider = new MetaAdvertisingProvider("test-access-token");

    const metrics = await provider.getCampaignMetrics(fixture.campaign.id, new Date("2026-08-15"), new Date("2026-08-15"));

    expect(metrics[0].conversions).toBe(0);
  });

  it("returns an empty array when the internal campaignId doesn't exist (no API call made)", async () => {
    const fetchMock = mockFetchOnce(200, { data: [] });
    const provider = new MetaAdvertisingProvider("test-access-token");

    const metrics = await provider.getCampaignMetrics("nonexistent-id", new Date("2026-08-01"), new Date("2026-08-02"));

    expect(metrics).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws with Meta's real error shape ({error: {type, message}}) even on HTTP 200", async () => {
    mockFetchOnce(200, { error: { type: "OAuthException", message: "Invalid OAuth access token." } });
    const provider = new MetaAdvertisingProvider("bad-token");

    await expect(provider.listAccounts()).rejects.toThrow(/OAuthException.*Invalid OAuth access token/);
  });

  it("throws on a non-2xx HTTP response", async () => {
    mockFetchOnce(401, { error: { type: "OAuthException", message: "expired token" } });
    const provider = new MetaAdvertisingProvider("bad-token");

    await expect(provider.listAccounts()).rejects.toThrow(/401/);
  });
});
