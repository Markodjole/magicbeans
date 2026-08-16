import type { AppTransaction, Customer, RevenueProvider } from "./types";

/**
 * Real Google Play Developer API adapter. Optional/not required for MVP.
 *
 * Required env vars: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, GOOGLE_PLAY_PACKAGE_NAME.
 * Use the current `purchases.subscriptionsv2` (SubscriptionPurchaseV2)
 * resource for subscription status — the older `purchases.subscriptions`
 * resource is deprecated and should not be designed around. Verify exact
 * fields against Google's official Play Developer API docs before
 * implementing. See /api/webhooks/google-play for Real-time Developer
 * Notifications.
 */
export class GooglePlayRevenueProvider implements RevenueProvider {
  readonly providerName = "GooglePlay";

  static isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_PLAY_PACKAGE_NAME);
  }

  async getCustomers(_appId: string): Promise<Customer[]> {
    throw new Error("Google Play LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }

  async getTransactions(_appId: string, _start: Date, _end: Date): Promise<AppTransaction[]> {
    throw new Error("Google Play LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }
}
