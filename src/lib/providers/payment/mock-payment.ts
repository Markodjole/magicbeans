import type { DepositResult, PaymentProvider, PayoutResult } from "./types";

/**
 * Simulated money movement — every investment/payout in this prototype
 * goes through this provider. Always "succeeds" instantly since there's
 * no real payment rail behind it; ENABLE_REAL_MONEY gates ever swapping
 * this out for StripePaymentProvider.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly providerName = "Mock";

  async createDeposit(params: { investorId: string; amount: number; currency: string }): Promise<DepositResult> {
    return { externalPaymentId: `mock_deposit_${params.investorId}_${Date.now()}`, status: "SUCCEEDED" };
  }

  async createPayout(params: { investorId: string; amount: number; currency: string }): Promise<PayoutResult> {
    return { externalPayoutId: `mock_payout_${params.investorId}_${Date.now()}`, status: "SUCCEEDED" };
  }
}
