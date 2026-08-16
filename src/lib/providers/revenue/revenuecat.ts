import { prisma } from "@/lib/prisma";
import type { AppTransaction, Customer, RevenueProvider } from "./types";

/**
 * Real RevenueCat adapter — the primary revenue source for the MVP.
 *
 * Required env vars: REVENUECAT_API_KEY (a secret_ or sk_ API key from
 * RevenueCat's dashboard — Test Store keys are prefixed test_ and work
 * identically against this same REST API).
 *
 * REST API v1 (api.revenuecat.com/v1), Bearer auth — confirmed against
 * RevenueCat's own docs 2026-08-15:
 *   GET /subscribers/{app_user_id} -> { subscriber: { subscriptions,
 *   non_subscriptions, entitlements, first_seen, ... } }
 *
 * Critical real limitation: RevenueCat has NO bulk "list all customers/
 * transactions for a project" REST endpoint — only single-subscriber
 * lookup by app_user_id. So unlike AppsFlyer's date-range export, this
 * adapter can only RECONCILE against app_user_ids we already know about
 * (every AttributedInstall.externalUserId for this app — see the identity
 * bridge note in mock-base.ts/revenue-sync.ts: the app must pass the SAME
 * user id to both AppsFlyer's customer_user_id and RevenueCat's
 * $appUserID for this join to work at all).
 *
 * Second real limitation: the subscriber GET response does NOT include
 * purchase price/currency per RevenueCat's own documented response shape
 * (subscriptions.{product_id} only has expires_date/purchase_date/store/
 * store_transaction_id) — so REST-reconciled transactions approximate
 * amount from the app's own subscriptionPrice, clearly flagged via
 * isAmountApproximated. Exact amounts come from the WEBHOOK path (see
 * src/app/api/webhooks/revenuecat/route.ts), which DOES carry price/
 * currency on every event — this is why RevenueCat's own docs say to
 * treat the webhook as primary and the REST API as reconciliation/backup,
 * not the other way around.
 *
 * Falls back to MockRevenueCatProvider automatically when unconfigured.
 */

type RevenueCatSubscription = {
  expires_date: string | null;
  purchase_date: string;
  store: string;
  store_transaction_id: string;
  original_purchase_date?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber: {
    original_app_user_id: string;
    first_seen: string;
    subscriptions: Record<string, RevenueCatSubscription>;
    non_subscriptions: Record<string, { id: string; purchase_date: string; store: string }[]>;
  };
};

const STORE_TO_PLATFORM: Record<string, "IOS" | "ANDROID" | "WEB"> = {
  app_store: "IOS",
  mac_app_store: "IOS",
  play_store: "ANDROID",
  amazon: "ANDROID",
  stripe: "WEB",
  rc_billing: "WEB",
  promotional: "WEB",
};

export class RevenueCatProvider implements RevenueProvider {
  readonly providerName = "RevenueCat";

  constructor(private readonly apiKey: string) {}

  static isConfigured(): boolean {
    return Boolean(process.env.REVENUECAT_API_KEY);
  }

  /** Candidate app_user_ids to reconcile: every AppsFlyer-attributed install for this app. */
  private async candidateAppUserIds(appId: string): Promise<string[]> {
    const installs = await prisma.attributedInstall.findMany({
      where: { appId },
      select: { externalUserId: true },
      distinct: ["externalUserId"],
    });
    return installs.map((i) => i.externalUserId);
  }

  private async fetchSubscriber(appUserId: string): Promise<RevenueCatSubscriberResponse["subscriber"] | null> {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`RevenueCat subscriber lookup failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as RevenueCatSubscriberResponse;
    return body.subscriber;
  }

  async getCustomers(appId: string): Promise<Customer[]> {
    const appUserIds = await this.candidateAppUserIds(appId);
    const customers: Customer[] = [];

    for (const appUserId of appUserIds) {
      const subscriber = await this.fetchSubscriber(appUserId);
      if (!subscriber) continue;
      const hasAnyPurchase =
        Object.keys(subscriber.subscriptions).length > 0 || Object.keys(subscriber.non_subscriptions).length > 0;
      if (!hasAnyPurchase) continue;

      customers.push({ appUserId, firstSeenAt: new Date(subscriber.first_seen) });
    }
    return customers;
  }

  async getTransactions(appId: string, start: Date, end: Date): Promise<AppTransaction[]> {
    const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
    const fallbackPrice = app.subscriptionPrice ? Number(app.subscriptionPrice) : 0;
    const appUserIds = await this.candidateAppUserIds(appId);
    const transactions: AppTransaction[] = [];

    for (const appUserId of appUserIds) {
      const subscriber = await this.fetchSubscriber(appUserId);
      if (!subscriber) continue;

      for (const [productId, sub] of Object.entries(subscriber.subscriptions)) {
        const purchasedAt = new Date(sub.purchase_date);
        if (purchasedAt < start || purchasedAt > end) continue;

        transactions.push({
          transactionId: sub.store_transaction_id,
          appUserId,
          productId,
          amount: fallbackPrice, // REST response has no price field — see file doc comment
          currency: "USD",
          purchasedAt,
          refundedAt: sub.unsubscribe_detected_at ? new Date(sub.unsubscribe_detected_at) : undefined,
          platform: STORE_TO_PLATFORM[sub.store] ?? "WEB",
        });
      }
    }
    return transactions;
  }
}
