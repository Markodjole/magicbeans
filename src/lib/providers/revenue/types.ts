export type Customer = {
  appUserId: string;
  firstSeenAt: Date;
  country?: string;
};

export type AppTransaction = {
  transactionId: string;
  appUserId: string;
  productId: string;
  amount: number;
  currency: string;
  purchasedAt: Date;
  refundedAt?: Date;
  platform: "IOS" | "ANDROID" | "WEB";
};

/**
 * RevenueCat is the primary revenue source for the MVP; Apple/Google Play
 * adapters implement this same interface directly for developers who
 * don't use RevenueCat. Whatever the source, the rest of the app only
 * ever sees normalized AppTransaction rows.
 */
export interface RevenueProvider {
  readonly providerName: string;

  getCustomers(appId: string): Promise<Customer[]>;
  getTransactions(appId: string, start: Date, end: Date): Promise<AppTransaction[]>;
}
