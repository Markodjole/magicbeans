import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { TikTokAdvertisingProvider } from "@/lib/providers/advertising/tiktok";
import { createTestFixture, deleteFixture } from "./helpers/fixtures";

/**
 * TikTok Business API response envelope and reporting shape confirmed
 * against TikTok's own SDK docs/source, 2026-08-16 — see the doc comment
 * in tiktok.ts. Fixture values below are fabricated test data, not a real
 * advertiser account's traffic.
 */
function envelope<T>(data: T, code = 0, message = "OK") {
  return { code, message, request_id: `req_${randomUUID()}`, data };
}

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("TikTokAdvertisingProvider — real API structure, fabricated test data", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (fixture) await deleteFixture([fixture.developerUser.id, fixture.investorUser.id]);
  });

  it("sends the Access-Token header, not Authorization Bearer", async () => {
    const fetchMock = mockFetchOnce(200, envelope({ advertiser_ids: [] }));
    const provider = new TikTokAdvertisingProvider("test-access-token");

    await provider.listAccounts();

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers["Access-Token"]).toBe("test-access-token");
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("listAccounts maps oauth2/advertiser/get's advertiser_ids", async () => {
    mockFetchOnce(200, envelope({ advertiser_ids: ["7000000000000000001", "7000000000000000002"] }));
    const provider = new TikTokAdvertisingProvider("test-access-token");

    const accounts = await provider.listAccounts();

    expect(accounts).toEqual([
      { externalAccountId: "7000000000000000001", name: "7000000000000000001" },
      { externalAccountId: "7000000000000000002", name: "7000000000000000002" },
    ]);
  });

  it("listCampaigns maps campaign/get's real field names", async () => {
    mockFetchOnce(
      200,
      envelope({
        list: [
          {
            campaign_id: "1774149501261857",
            campaign_name: "StudySprint Growth Campaign",
            budget: 130,
            operation_status: "ENABLE",
            create_time: "2026-06-01 00:00:00",
          },
        ],
      })
    );
    const provider = new TikTokAdvertisingProvider("test-access-token");

    const campaigns = await provider.listCampaigns("7000000000000000001");

    expect(campaigns).toEqual([
      {
        externalCampaignId: "1774149501261857",
        name: "StudySprint Growth Campaign",
        dailyBudget: 130,
        status: "ACTIVE",
        startDate: "2026-06-01",
      },
    ]);
  });

  it("maps operation_status DISABLE to PAUSED and anything else to ENDED", async () => {
    mockFetchOnce(
      200,
      envelope({
        list: [
          { campaign_id: "1", campaign_name: "A", operation_status: "DISABLE" },
          { campaign_id: "2", campaign_name: "B", operation_status: "DELETE" },
        ],
      })
    );
    const provider = new TikTokAdvertisingProvider("test-access-token");

    const campaigns = await provider.listCampaigns("7000000000000000001");

    expect(campaigns[0].status).toBe("PAUSED");
    expect(campaigns[1].status).toBe("ENDED");
  });

  it("getCampaignMetrics maps report/integrated/get's real dimensions+metrics shape", async () => {
    const runId = randomUUID().slice(0, 8);
    fixture = await createTestFixture(runId);

    mockFetchOnce(
      200,
      envelope({
        list: [
          {
            dimensions: { campaign_id: "test-campaign-" + runId, stat_time_day: "2026-08-15 00:00:00" },
            metrics: { spend: "5.00", impressions: "635", clicks: "40", conversion: "3" },
          },
          {
            dimensions: { campaign_id: "test-campaign-" + runId, stat_time_day: "2026-08-16 00:00:00" },
            metrics: { spend: "6.25", impressions: "1004", clicks: "55", conversion: "5" },
          },
        ],
      })
    );
    const provider = new TikTokAdvertisingProvider("test-access-token");

    const metrics = await provider.getCampaignMetrics(fixture.campaign.id, new Date("2026-08-15"), new Date("2026-08-16"));

    expect(metrics).toEqual([
      {
        campaignId: fixture.campaign.id,
        campaignName: "Test Campaign",
        date: "2026-08-15",
        spend: 5,
        impressions: 635,
        clicks: 40,
        conversions: 3,
        currency: "USD",
      },
      {
        campaignId: fixture.campaign.id,
        campaignName: "Test Campaign",
        date: "2026-08-16",
        spend: 6.25,
        impressions: 1004,
        clicks: 55,
        conversions: 5,
        currency: "USD",
      },
    ]);
  });

  it("returns an empty array when the internal campaignId doesn't exist (no API call made)", async () => {
    const fetchMock = mockFetchOnce(200, envelope({ list: [] }));
    const provider = new TikTokAdvertisingProvider("test-access-token");

    const metrics = await provider.getCampaignMetrics("nonexistent-id", new Date("2026-08-01"), new Date("2026-08-02"));

    expect(metrics).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the HTTP response is non-2xx", async () => {
    mockFetchOnce(401, { message: "invalid access token" });
    const provider = new TikTokAdvertisingProvider("bad-token");

    await expect(provider.listAccounts()).rejects.toThrow(/401/);
  });

  it("throws when TikTok's envelope code is non-zero (API-level error, HTTP 200)", async () => {
    mockFetchOnce(200, envelope(null, 40100, "Invalid advertiser_id"));
    const provider = new TikTokAdvertisingProvider("test-access-token");

    await expect(provider.listAccounts()).rejects.toThrow(/40100.*Invalid advertiser_id/);
  });
});
