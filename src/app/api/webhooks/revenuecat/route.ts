import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordWebhookEvent, markWebhookProcessed } from "@/lib/webhooks/idempotent-store";
import { runAttributionRevenueEngineForApp } from "@/lib/engine/attribution-revenue-engine";

/**
 * RevenueCat webhook. RevenueCat authenticates webhooks with a shared
 * "Authorization" header value you configure in the RevenueCat dashboard
 * (a static string, not a computed HMAC) — confirmed against RevenueCat's
 * own docs 2026-08-15. REVENUECAT_WEBHOOK_AUTH_HEADER must match exactly
 * what's configured as "Authorization Header Value" for the webhook
 * destination in RevenueCat's dashboard.
 *
 * Payload shape (confirmed real, 2026-08-15): { api_version, event: {...} }
 * — all fields live under `event`, not top-level.
 *
 * This is the PRIMARY path for transaction data (see revenuecat.ts's doc
 * comment) because it's the only path that carries actual price/currency —
 * the REST subscriber-lookup endpoint doesn't expose those fields at all.
 *
 * Handled event types (money received -> upsert a transaction, then run
 * attribution immediately so the chain is visible without waiting for the
 * next scheduled sync):
 *   INITIAL_PURCHASE, RENEWAL, NON_RENEWING_PURCHASE, UNCANCELLATION,
 *   PRODUCT_CHANGE, SUBSCRIPTION_EXTENDED
 *
 * BILLING_ISSUE: recorded (webhook_events table) but no transaction is
 * created — a failed charge attempt, no money changed hands.
 *
 * CANCELLATION / EXPIRATION: intentionally NOT auto-reversing revenue.
 * RevenueCat's own docs describe CANCELLATION as firing for "canceled OR
 * refunded" without a single unambiguous field distinguishing which —
 * flagging this rather than guessing wrong and incorrectly reversing
 * revenue that was never actually refunded. A real implementation needs
 * to confirm the exact distinguishing field against a live RevenueCat
 * account before wiring handleTransactionRefund here.
 */
export async function POST(request: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
  const authHeader = request.headers.get("authorization");
  const rawBody = await request.text();

  if (!expected) {
    return NextResponse.json({ error: "RevenueCat webhook not configured" }, { status: 501 });
  }
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Invalid authorization" }, { status: 401 });
  }

  let payload: RevenueCatWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event;
  if (!event?.id) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const { isDuplicate, id: webhookEventId } = await recordWebhookEvent({
    provider: "REVENUECAT",
    externalEventId: event.id,
    rawBody,
    payload,
  });
  if (isDuplicate) return NextResponse.json({ received: true, duplicate: true });

  try {
    await processEvent(event);
    await markWebhookProcessed(webhookEventId, "PROCESSED");
  } catch (err) {
    await markWebhookProcessed(webhookEventId, "FAILED");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

type RevenueCatWebhookPayload = {
  api_version: string;
  event?: RevenueCatEvent;
};

type RevenueCatEvent = {
  id: string;
  type: string;
  app_id: string;
  app_user_id: string;
  product_id?: string;
  transaction_id?: string;
  purchased_at_ms?: number;
  price?: number;
  currency?: string;
  store?: string;
  country_code?: string;
};

const PURCHASE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
]);

const STORE_TO_PLATFORM: Record<string, "IOS" | "ANDROID" | "WEB"> = {
  app_store: "IOS",
  mac_app_store: "IOS",
  play_store: "ANDROID",
  amazon: "ANDROID",
  stripe: "WEB",
  rc_billing: "WEB",
  promotional: "WEB",
};

async function processEvent(event: RevenueCatEvent) {
  const connection = await prisma.integrationConnection.findFirst({
    where: { category: "REVENUE", provider: "REVENUECAT", externalAccountId: event.app_id },
  });
  if (!connection) {
    throw new Error(`No RevenueCat integration connection found for RevenueCat app_id ${event.app_id}`);
  }
  const appId = connection.appId;

  const appCustomer = await prisma.appCustomer.upsert({
    where: { appId_appUserId: { appId, appUserId: event.app_user_id } },
    create: { appId, appUserId: event.app_user_id, externalUserId: event.app_user_id, country: event.country_code },
    update: {},
  });

  if (event.type === "BILLING_ISSUE") return; // failed charge attempt — no money changed hands
  if (!PURCHASE_EVENT_TYPES.has(event.type)) return; // CANCELLATION/EXPIRATION/other — see file doc comment

  if (!event.transaction_id || !event.product_id || event.price === undefined || !event.purchased_at_ms) {
    throw new Error(`Purchase event ${event.id} (${event.type}) missing required fields`);
  }

  await prisma.appTransaction.upsert({
    where: { transactionId: event.transaction_id },
    create: {
      appId,
      appCustomerId: appCustomer.id,
      transactionId: event.transaction_id,
      productId: event.product_id,
      amount: event.price,
      currency: event.currency ?? "USD",
      purchasedAt: new Date(event.purchased_at_ms),
      platform: STORE_TO_PLATFORM[(event.store ?? "").toLowerCase()] ?? "WEB",
      provider: "REVENUECAT",
      isMock: connection.mode !== "LIVE",
    },
    update: { syncedAt: new Date() },
  });

  await runAttributionRevenueEngineForApp(appId);
}
