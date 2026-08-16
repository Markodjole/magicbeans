import type { AppTransaction, Customer, RevenueProvider } from "./types";

/**
 * Real Apple App Store Server API adapter. Optional/not required for
 * MVP — a developer can use this directly instead of RevenueCat.
 *
 * Required env vars: APPLE_ISSUER_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY,
 * APPLE_BUNDLE_ID. Also see /api/webhooks/apple for App Store Server
 * Notifications V2 (real-time transaction lifecycle events) — that
 * webhook plus this REST adapter together are how live Apple revenue
 * data should ultimately flow in. Verify current endpoint paths and JWT
 * signing requirements against Apple's official App Store Server API
 * docs before implementing.
 */
export class AppleRevenueProvider implements RevenueProvider {
  readonly providerName = "Apple";

  static isConfigured(): boolean {
    return Boolean(
      process.env.APPLE_ISSUER_ID &&
        process.env.APPLE_KEY_ID &&
        process.env.APPLE_PRIVATE_KEY &&
        process.env.APPLE_BUNDLE_ID
    );
  }

  async getCustomers(_appId: string): Promise<Customer[]> {
    throw new Error("Apple LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }

  async getTransactions(_appId: string, _start: Date, _end: Date): Promise<AppTransaction[]> {
    throw new Error("Apple LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }
}
