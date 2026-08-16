import type { DepositResult, PaymentProvider, PayoutResult } from "./types";

/**
 * Real Stripe Connect adapter, TEST MODE only. Stripe Connect is built
 * for platforms that collect money from one party (investors) and pay
 * out to another (developers) — required env vars: STRIPE_SECRET_KEY,
 * STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET. See /api/webhooks/stripe
 * for the payment-intent/transfer event handling this adapter depends on.
 *
 * IMPORTANT: this class must never run unless ENABLE_REAL_MONEY=true AND
 * a Stripe secret key is configured. Stripe alone does not make the
 * underlying revenue-share business model legally compliant — see
 * COMPLIANCE_NOTES.md. Verify current API version/params against
 * Stripe's official Connect docs before implementing the calls below.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly providerName = "Stripe";

  constructor(private readonly secretKey: string) {}

  static isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  }

  async createDeposit(_params: { investorId: string; amount: number; currency: string }): Promise<DepositResult> {
    throw new Error("Stripe LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }

  async createPayout(_params: { investorId: string; amount: number; currency: string }): Promise<PayoutResult> {
    throw new Error("Stripe LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }
}
