export type DepositResult = {
  externalPaymentId: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
};

export type PayoutResult = {
  externalPayoutId: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
};

/**
 * Moves money in (investor funding an opportunity) and out (investor
 * payouts). Real implementation is Stripe Connect in TEST MODE only —
 * see src/lib/config.ts's ENABLE_REAL_MONEY, which stays false until a
 * real launch review (COMPLIANCE_NOTES.md). MockPaymentProvider is what
 * actually runs for every demo transaction today.
 */
export interface PaymentProvider {
  readonly providerName: string;

  createDeposit(params: { investorId: string; amount: number; currency: string }): Promise<DepositResult>;
  createPayout(params: { investorId: string; amount: number; currency: string }): Promise<PayoutResult>;
}
