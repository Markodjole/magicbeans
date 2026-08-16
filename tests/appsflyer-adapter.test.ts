import { afterEach, describe, expect, it, vi } from "vitest";
import { AppsFlyerProvider } from "@/lib/providers/attribution/appsflyer";

/**
 * Column header confirmed live against a real AppsFlyer account (2026-08-15) — see
 * appsflyer.ts. Row values below are fabricated test fixtures, not real user data;
 * the real account has zero installs so there's no genuine populated row to use.
 */
const REAL_HEADER =
  "Attributed Touch Type,Attributed Touch Time,Install Time,Event Time,Event Name,Event Value,Event Revenue,Event Revenue Currency,Event Revenue USD,Event Source,Is Receipt Validated,Partner,Media Source,Channel,Keywords,Campaign,Campaign ID,Adset,Adset ID,Ad,Ad ID,Ad Type,Site ID,Sub Site ID,Sub Param 1,Sub Param 2,Sub Param 3,Sub Param 4,Sub Param 5,Cost Model,Cost Value,Cost Currency,Contributor 1 Partner,Contributor 1 Media Source,Contributor 1 Campaign,Contributor 1 Touch Type,Contributor 1 Touch Time,Contributor 2 Partner,Contributor 2 Media Source,Contributor 2 Campaign,Contributor 2 Touch Type,Contributor 2 Touch Time,Contributor 3 Partner,Contributor 3 Media Source,Contributor 3 Campaign,Contributor 3 Touch Type,Contributor 3 Touch Time,Region,Country Code,State,City,Postal Code,DMA,IP,WIFI,Operator,Carrier,Language,AppsFlyer ID,Advertising ID,IDFA,Android ID,Customer User ID,IMEI,IDFV,Platform,Device Type,OS Version,App Version,SDK Version,App ID,App Name,Bundle ID,Is Retargeting,Retargeting Conversion Type,Attribution Lookback,Reengagement Window,Is Primary Attribution,User Agent,HTTP Referrer,Original URL";

function fakeInstallRow(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    "Attributed Touch Type": "click",
    "Attributed Touch Time": "2026-08-10 09:00:00",
    "Install Time": "2026-08-10 09:05:00",
    "Media Source": "facebook_ads_int",
    Campaign: "Test Campaign",
    "Campaign ID": "camp_test_1",
    "Adset ID": "adset_test_1",
    "Ad ID": "ad_test_1",
    "Country Code": "US",
    "AppsFlyer ID": "test-af-id-0001",
    "Customer User ID": "test-user-0001",
  };
  return { ...base, ...overrides };
}

function fakeEventRow(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    "Event Time": "2026-08-11 14:30:00",
    "Event Name": "af_purchase",
    "Event Revenue USD": "9.99",
    "Event Revenue Currency": "USD",
    "Campaign ID": "camp_test_1",
    "AppsFlyer ID": "test-af-id-0001",
    "Customer User ID": "test-user-0001",
  };
  return { ...base, ...overrides };
}

function csvFrom(rows: Record<string, string>[]): string {
  const columns = REAL_HEADER.split(",");
  const lines = rows.map((row) => columns.map((col) => row[col] ?? "").join(","));
  return [REAL_HEADER, ...lines].join("\n");
}

function mockAppsFlyerResponse(csv: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(csv, { status: 200 })),
  );
}

describe("AppsFlyerProvider — real column structure, fabricated test rows", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a populated installs_report row to AttributedInstall", async () => {
    mockAppsFlyerResponse(csvFrom([fakeInstallRow()]));
    const provider = new AppsFlyerProvider("test-token");

    const installs = await provider.getInstalls("id9123456781", new Date("2026-08-01"), new Date("2026-08-15"));

    expect(installs).toHaveLength(1);
    expect(installs[0]).toEqual({
      externalUserId: "test-user-0001",
      installedAt: new Date("2026-08-10T09:05:00Z"),
      mediaSource: "facebook_ads_int",
      campaignId: "camp_test_1",
      campaignName: "Test Campaign",
      adGroupId: "adset_test_1",
      adId: "ad_test_1",
      country: "US",
    });
  });

  it("maps a populated in_app_events_report row to AttributedEvent", async () => {
    mockAppsFlyerResponse(csvFrom([fakeEventRow()]));
    const provider = new AppsFlyerProvider("test-token");

    const events = await provider.getEvents("id9123456781", new Date("2026-08-01"), new Date("2026-08-15"));

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      externalUserId: "test-user-0001",
      eventName: "af_purchase",
      eventTime: new Date("2026-08-11T14:30:00Z"),
      revenue: 9.99,
      currency: "USD",
      campaignId: "camp_test_1",
    });
  });

  it("falls back to AppsFlyer ID when Customer User ID is blank", async () => {
    mockAppsFlyerResponse(csvFrom([fakeInstallRow({ "Customer User ID": "" })]));
    const provider = new AppsFlyerProvider("test-token");

    const installs = await provider.getInstalls("id9123456781", new Date("2026-08-01"), new Date("2026-08-15"));

    expect(installs[0].externalUserId).toBe("test-af-id-0001");
  });

  it("handles quoted fields containing commas (e.g. User Agent)", async () => {
    const columns = REAL_HEADER.split(",");
    const row = fakeInstallRow();
    const line = columns
      .map((col) => (col === "User Agent" ? '"Mozilla/5.0 (Test, Fixture)"' : (row[col] ?? "")))
      .join(",");
    mockAppsFlyerResponse([REAL_HEADER, line].join("\n"));
    const provider = new AppsFlyerProvider("test-token");

    const installs = await provider.getInstalls("id9123456781", new Date("2026-08-01"), new Date("2026-08-15"));

    expect(installs).toHaveLength(1);
    expect(installs[0].mediaSource).toBe("facebook_ads_int");
  });

  it("returns an empty array for an empty report (real behavior confirmed against the live account)", async () => {
    mockAppsFlyerResponse(REAL_HEADER);
    const provider = new AppsFlyerProvider("test-token");

    const installs = await provider.getInstalls("id9123456781", new Date("2026-08-01"), new Date("2026-08-15"));

    expect(installs).toEqual([]);
  });

  it("throws with status and body when AppsFlyer returns a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response('{"error": "Authentication error"}', { status: 401 })),
    );
    const provider = new AppsFlyerProvider("bad-token");

    await expect(
      provider.getInstalls("id9123456781", new Date("2026-08-01"), new Date("2026-08-15")),
    ).rejects.toThrow(/401/);
  });
});
