import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { RevenueCatProvider } from "@/lib/providers/revenue/revenuecat";
import { createTestFixture, deleteFixture } from "./helpers/fixtures";
import { prisma } from "@/lib/prisma";

/**
 * RevenueCat REST API v1 GET /subscribers/{app_user_id} response shape
 * confirmed against RevenueCat's own docs, 2026-08-15 — see the doc
 * comment in revenuecat.ts. Fixture values below are fabricated test
 * data, not real RevenueCat account data.
 */
function subscriberResponse(overrides: Partial<{ subscriptions: object; non_subscriptions: object }> = {}) {
  return {
    request_date: "2026-08-15T00:00:00Z",
    request_date_ms: 1755216000000,
    subscriber: {
      original_app_user_id: "test-user-0001",
      first_seen: "2026-08-01T00:00:00Z",
      subscriptions: {},
      non_subscriptions: {},
      entitlements: {},
      ...overrides,
    },
  };
}

function mockFetchResponses(byAppUserId: Record<string, { status: number; body?: unknown }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const match = decodeURIComponent(url).match(/subscribers\/(.+)$/);
      const appUserId = match?.[1] ?? "";
      const entry = byAppUserId[appUserId];
      if (!entry) return new Response("not found", { status: 404 });
      return new Response(entry.body ? JSON.stringify(entry.body) : undefined, { status: entry.status });
    })
  );
}

describe("RevenueCatProvider — real REST structure, fabricated test data", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;
  let runId: string;

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (fixture) await deleteFixture([fixture.developerUser.id, fixture.investorUser.id]);
  });

  async function setup() {
    runId = randomUUID().slice(0, 8);
    fixture = await createTestFixture(runId);
    return fixture;
  }

  it("reconciles only against known AttributedInstall externalUserIds (no bulk endpoint exists)", async () => {
    const { app } = await setup();
    const knownUserId = `known-${runId}`;
    await prisma.attributedInstall.create({
      data: {
        appId: app.id,
        externalUserId: knownUserId,
        installedAt: new Date(),
        mediaSource: "TikTok",
        attributionProvider: "APPSFLYER",
      },
    });

    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(subscriberResponse()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new RevenueCatProvider("test-key");
    await provider.getCustomers(app.id);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent(knownUserId));
  });

  it("maps a subscriber with an active subscription to a Customer", async () => {
    const { app } = await setup();
    const userId = `payer-${runId}`;
    await prisma.attributedInstall.create({
      data: { appId: app.id, externalUserId: userId, installedAt: new Date(), mediaSource: "TikTok", attributionProvider: "APPSFLYER" },
    });

    mockFetchResponses({
      [userId]: {
        status: 200,
        body: subscriberResponse({
          subscriptions: {
            monthly_subscription: {
              expires_date: "2026-09-15T00:00:00Z",
              purchase_date: "2026-08-15T00:00:00Z",
              store: "app_store",
              store_transaction_id: "1000000000000001",
            },
          },
        }),
      },
    });

    const provider = new RevenueCatProvider("test-key");
    const customers = await provider.getCustomers(app.id);

    expect(customers).toHaveLength(1);
    expect(customers[0].appUserId).toBe(userId);
  });

  it("skips subscribers with no purchases (404 or empty subscriptions)", async () => {
    const { app } = await setup();
    const noSuchUser = `ghost-${runId}`;
    const neverPaidUser = `neverpaid-${runId}`;
    await prisma.attributedInstall.createMany({
      data: [
        { appId: app.id, externalUserId: noSuchUser, installedAt: new Date(), mediaSource: "TikTok", attributionProvider: "APPSFLYER" },
        { appId: app.id, externalUserId: neverPaidUser, installedAt: new Date(), mediaSource: "TikTok", attributionProvider: "APPSFLYER" },
      ],
    });

    mockFetchResponses({
      [neverPaidUser]: { status: 200, body: subscriberResponse() },
    });

    const provider = new RevenueCatProvider("test-key");
    const customers = await provider.getCustomers(app.id);

    expect(customers).toEqual([]);
  });

  it("getTransactions approximates amount from the app's subscriptionPrice (REST response has no price field)", async () => {
    const { app } = await setup();
    const userId = `txn-${runId}`;
    await prisma.attributedInstall.create({
      data: { appId: app.id, externalUserId: userId, installedAt: new Date(), mediaSource: "TikTok", attributionProvider: "APPSFLYER" },
    });

    mockFetchResponses({
      [userId]: {
        status: 200,
        body: subscriberResponse({
          subscriptions: {
            monthly_subscription: {
              expires_date: "2026-09-15T00:00:00Z",
              purchase_date: "2026-08-15T00:00:00Z",
              store: "play_store",
              store_transaction_id: "GPA.1234-5678",
            },
          },
        }),
      },
    });

    const provider = new RevenueCatProvider("test-key");
    const transactions = await provider.getTransactions(app.id, new Date("2026-08-01"), new Date("2026-08-31"));

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      transactionId: "GPA.1234-5678",
      appUserId: userId,
      productId: "monthly_subscription",
      amount: 9.99, // app.subscriptionPrice from createTestFixture
      platform: "ANDROID",
    });
  });

  it("excludes purchases outside the requested date range", async () => {
    const { app } = await setup();
    const userId = `outside-range-${runId}`;
    await prisma.attributedInstall.create({
      data: { appId: app.id, externalUserId: userId, installedAt: new Date(), mediaSource: "TikTok", attributionProvider: "APPSFLYER" },
    });

    mockFetchResponses({
      [userId]: {
        status: 200,
        body: subscriberResponse({
          subscriptions: {
            monthly_subscription: {
              expires_date: "2026-02-15T00:00:00Z",
              purchase_date: "2026-01-15T00:00:00Z",
              store: "app_store",
              store_transaction_id: "old-txn",
            },
          },
        }),
      },
    });

    const provider = new RevenueCatProvider("test-key");
    const transactions = await provider.getTransactions(app.id, new Date("2026-08-01"), new Date("2026-08-31"));

    expect(transactions).toEqual([]);
  });

  it("throws with status and body on a non-2xx, non-404 response", async () => {
    const { app } = await setup();
    const userId = `error-${runId}`;
    await prisma.attributedInstall.create({
      data: { appId: app.id, externalUserId: userId, installedAt: new Date(), mediaSource: "TikTok", attributionProvider: "APPSFLYER" },
    });

    mockFetchResponses({ [userId]: { status: 401, body: { message: "invalid key" } } });

    const provider = new RevenueCatProvider("bad-key");
    await expect(provider.getCustomers(app.id)).rejects.toThrow(/401/);
  });
});
