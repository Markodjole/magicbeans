import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { GoogleAdvertisingProvider } from "@/lib/providers/advertising/google";
import { createTestFixture, deleteFixture } from "./helpers/fixtures";

/**
 * Google Ads API v25 response shapes confirmed against Google's own
 * docs/examples, 2026-08-16 — see the doc comment in google.ts. Fixture
 * values below are fabricated test data, not a real account's traffic.
 */
function mockFetchSequence(responses: { status: number; body: unknown }[]) {
  let call = 0;
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const r = responses[Math.min(call, responses.length - 1)];
    call++;
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function tokenResponse() {
  return { status: 200, body: { access_token: "test-access-token", expires_in: 3599, token_type: "Bearer" } };
}

describe("GoogleAdvertisingProvider — real API structure, fabricated test data", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (fixture) await deleteFixture([fixture.developerUser.id, fixture.investorUser.id]);
  });

  it("exchanges the refresh token via Google's standard OAuth2 endpoint before every call", async () => {
    const fetchMock = mockFetchSequence([tokenResponse(), { status: 200, body: { resourceNames: [] } }]);
    const provider = new GoogleAdvertisingProvider("test-refresh-token");

    await provider.listAccounts();

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(String(tokenInit.body)).toContain("refresh_token=test-refresh-token");

    const [adsUrl, adsInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(adsUrl).toContain("/customers:listAccessibleCustomers");
    const headers = adsInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-access-token");
    expect(headers["developer-token"]).toBeDefined();
  });

  it("listAccounts parses customer IDs out of resourceNames", async () => {
    mockFetchSequence([
      tokenResponse(),
      { status: 200, body: { resourceNames: ["customers/1234567890", "customers/9876543210"] } },
    ]);
    const provider = new GoogleAdvertisingProvider("test-refresh-token");

    const accounts = await provider.listAccounts();

    expect(accounts).toEqual([
      { externalAccountId: "1234567890", name: "customers/1234567890" },
      { externalAccountId: "9876543210", name: "customers/9876543210" },
    ]);
  });

  it("listCampaigns maps the real nested results shape and converts budget from micros", async () => {
    mockFetchSequence([
      tokenResponse(),
      {
        status: 200,
        body: {
          results: [
            {
              campaign: { id: "23456789", name: "StudySprint Search Intent Campaign", status: "ENABLED", startDate: "2026-06-01" },
              campaignBudget: { amountMicros: "130000000" },
            },
          ],
        },
      },
    ]);
    const provider = new GoogleAdvertisingProvider("test-refresh-token");

    const campaigns = await provider.listCampaigns("1234567890");

    expect(campaigns).toEqual([
      {
        externalCampaignId: "23456789",
        name: "StudySprint Search Intent Campaign",
        dailyBudget: 130,
        status: "ACTIVE",
        startDate: "2026-06-01",
      },
    ]);
  });

  it("maps status PAUSED and REMOVED correctly", async () => {
    mockFetchSequence([
      tokenResponse(),
      {
        status: 200,
        body: {
          results: [
            { campaign: { id: "1", name: "A", status: "PAUSED", startDate: "2026-01-01" } },
            { campaign: { id: "2", name: "B", status: "REMOVED", startDate: "2026-01-01" } },
          ],
        },
      },
    ]);
    const provider = new GoogleAdvertisingProvider("test-refresh-token");

    const campaigns = await provider.listCampaigns("1234567890");

    expect(campaigns[0].status).toBe("PAUSED");
    expect(campaigns[1].status).toBe("ENDED");
  });

  it("getCampaignMetrics maps segments.date + metrics and converts cost from micros", async () => {
    const runId = randomUUID().slice(0, 8);
    fixture = await createTestFixture(runId);

    mockFetchSequence([
      tokenResponse(),
      {
        status: 200,
        body: {
          results: [
            {
              segments: { date: "2026-08-15" },
              metrics: { impressions: "18700", clicks: "421", costMicros: "84200000", conversions: "12" },
            },
          ],
        },
      },
    ]);
    const provider = new GoogleAdvertisingProvider("test-refresh-token");

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

  it("returns an empty array when the internal campaignId doesn't exist (no API call made)", async () => {
    const fetchMock = mockFetchSequence([tokenResponse(), { status: 200, body: { results: [] } }]);
    const provider = new GoogleAdvertisingProvider("test-refresh-token");

    const metrics = await provider.getCampaignMetrics("nonexistent-id", new Date("2026-08-01"), new Date("2026-08-02"));

    expect(metrics).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws with Google's real error shape ({error: {status, message}})", async () => {
    mockFetchSequence([
      tokenResponse(),
      { status: 400, body: { error: { code: 400, status: "INVALID_ARGUMENT", message: "Invalid customer ID." } } },
    ]);
    const provider = new GoogleAdvertisingProvider("test-refresh-token");

    await expect(provider.listAccounts()).rejects.toThrow(/INVALID_ARGUMENT.*Invalid customer ID/);
  });

  it("throws a clear error when the OAuth token refresh itself fails", async () => {
    mockFetchSequence([{ status: 400, body: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }]);
    const provider = new GoogleAdvertisingProvider("revoked-token");

    await expect(provider.listAccounts()).rejects.toThrow(/Token has been expired or revoked/);
  });
});
