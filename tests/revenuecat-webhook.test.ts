import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { POST } from "@/app/api/webhooks/revenuecat/route";
import { createTestFixture, deleteFixture } from "./helpers/fixtures";
import { prisma } from "@/lib/prisma";

const AUTH_HEADER_VALUE = "test-shared-secret";

/**
 * RevenueCat webhook payload shape ({ api_version, event: {...} }, all
 * fields under `event`) confirmed against RevenueCat's own docs,
 * 2026-08-15 — see the doc comment in route.ts. Values below are
 * fabricated test data, not a real RevenueCat account's traffic.
 */
function webhookPayload(overrides: Record<string, unknown> = {}) {
  return {
    api_version: "1.0",
    event: {
      id: `evt_${randomUUID()}`,
      type: "INITIAL_PURCHASE",
      app_id: "rc-app-id-test",
      app_user_id: "test-user-0001",
      product_id: "monthly_subscription",
      transaction_id: `txn_${randomUUID()}`,
      purchased_at_ms: Date.parse("2026-08-15T00:00:00Z"),
      price: 9.99,
      currency: "USD",
      store: "APP_STORE",
      country_code: "US",
      ...overrides,
    },
  };
}

function postWebhook(body: unknown, authHeader = AUTH_HEADER_VALUE) {
  return POST(
    new Request("http://localhost/api/webhooks/revenuecat", {
      method: "POST",
      headers: { "content-type": "application/json", ...(authHeader ? { authorization: authHeader } : {}) },
      body: JSON.stringify(body),
    })
  );
}

describe("RevenueCat webhook — real payload structure, fabricated test data", () => {
  let fixture: Awaited<ReturnType<typeof createTestFixture>>;

  beforeEach(() => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTH_HEADER", AUTH_HEADER_VALUE);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (fixture) await deleteFixture([fixture.developerUser.id, fixture.investorUser.id]);
  });

  async function setupConnectedApp(runId: string) {
    fixture = await createTestFixture(runId);
    await prisma.integrationConnection.create({
      data: { appId: fixture.app.id, category: "REVENUE", provider: "REVENUECAT", mode: "LIVE", externalAccountId: "rc-app-id-test" },
    });
    return fixture;
  }

  it("rejects a request with a missing/wrong authorization header", async () => {
    const res = await postWebhook(webhookPayload(), "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("returns 501 when the webhook isn't configured", async () => {
    // vi.unstubAllEnvs() only removes vi.stubEnv() overrides — it can't
    // erase a real value already loaded into process.env from .env, so
    // explicitly stub it empty rather than relying on "unset".
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTH_HEADER", "");
    const res = await postWebhook(webhookPayload());
    expect(res.status).toBe(501);
  });

  it("creates an AppTransaction and attributes revenue for a real-shaped INITIAL_PURCHASE event", async () => {
    const runId = randomUUID().slice(0, 8);
    const { app, campaign } = await setupConnectedApp(runId);
    const userId = `bridged-${runId}`;
    // The identity bridge: AppCustomer.appUserId must match what the
    // webhook will look up by — see INTEGRATIONS.md's "Identity bridge" note.
    const appCustomer = await prisma.appCustomer.create({
      data: { appId: app.id, appUserId: userId, externalUserId: userId },
    });
    await prisma.attributedInstall.create({
      data: {
        appId: app.id,
        campaignId: campaign.id,
        externalUserId: userId,
        installedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        mediaSource: "TikTok",
        attributionProvider: "APPSFLYER",
        appCustomerId: appCustomer.id,
      },
    });

    const res = await postWebhook(webhookPayload({ app_user_id: userId, price: 14.5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);

    const transaction = await prisma.appTransaction.findFirst({ where: { appId: app.id } });
    expect(transaction).toMatchObject({ amount: expect.anything(), productId: "monthly_subscription", platform: "IOS" });
    expect(Number(transaction!.amount)).toBe(14.5);

    const attribution = await prisma.revenueAttribution.findFirst({ where: { campaignId: campaign.id } });
    expect(attribution).toBeTruthy();
    expect(attribution!.confidence).toBe("HIGH");
  });

  it("does not create a transaction for BILLING_ISSUE (failed charge, no money moved)", async () => {
    const runId = randomUUID().slice(0, 8);
    const { app } = await setupConnectedApp(runId);

    const res = await postWebhook(webhookPayload({ app_user_id: `billing-${runId}`, type: "BILLING_ISSUE" }));
    expect(res.status).toBe(200);

    const transaction = await prisma.appTransaction.findFirst({ where: { appId: app.id } });
    expect(transaction).toBeNull();
  });

  it("is idempotent on redelivery of the same event id", async () => {
    const runId = randomUUID().slice(0, 8);
    const { app } = await setupConnectedApp(runId);
    const payload = webhookPayload({ app_user_id: `dup-${runId}` });

    const first = await postWebhook(payload);
    const second = await postWebhook(payload);

    expect((await first.json()).duplicate).toBeUndefined();
    expect((await second.json()).duplicate).toBe(true);

    const count = await prisma.appTransaction.count({ where: { appId: app.id } });
    expect(count).toBe(1);
  });

  it("fails clearly when the RevenueCat app_id has no matching IntegrationConnection", async () => {
    const runId = randomUUID().slice(0, 8);
    fixture = await createTestFixture(runId); // no IntegrationConnection created

    const res = await postWebhook(webhookPayload({ app_id: "unregistered-rc-app" }));
    expect(res.status).toBe(500);
  });
});
