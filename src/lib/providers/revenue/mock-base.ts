import { prisma } from "@/lib/prisma";
import { SeededRandom } from "@/lib/seeded-random";
import { syntheticInstallsForApp } from "@/lib/providers/mock-shared/synthetic-installs";
import { APP_ECONOMICS, DEFAULT_ECONOMICS } from "@/lib/providers/advertising/mock-economics";
import type { AppTransaction, Customer, RevenueProvider } from "./types";

const DEFAULT_SUBSCRIPTION_PRICE = 12.99;
const MONTHLY_RETENTION = 0.65; // ~35% monthly churn baseline

/**
 * Turns a fraction of an app's synthetic installs into paying customers
 * with recurring subscription payments, using each app's conversionRate
 * from mock-economics.ts directly (a realistic 1-9% freemium install-to-payer
 * rate, per published 2026 benchmarks) — this is what makes PhotoGlow a
 * real loser and StudySprint a real winner rather than every app looking
 * the same. ROAS is a downstream RESULT of conversionRate x price, not an
 * input — see the comment on EconomicsProfile in mock-economics.ts.
 */
export abstract class MockRevenueProviderBase implements RevenueProvider {
  abstract readonly providerName: string;

  async getCustomers(appId: string): Promise<Customer[]> {
    const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
    const start = new Date(0);
    const end = new Date();
    const installs = await syntheticInstallsForApp(appId, start, end);
    const profile = APP_ECONOMICS[app.name] ?? DEFAULT_ECONOMICS;

    const customers: Customer[] = [];
    for (const install of installs) {
      const rand = new SeededRandom(install.externalUserId, "pays");
      if (rand.bool(profile.conversionRate)) {
        customers.push({ appUserId: install.externalUserId, firstSeenAt: install.installedAt, country: install.country });
      }
    }
    return customers;
  }

  async getTransactions(appId: string, start: Date, end: Date): Promise<AppTransaction[]> {
    const app = await prisma.app.findUniqueOrThrow({ where: { id: appId } });
    const fullHistoryStart = new Date(0);
    const installs = await syntheticInstallsForApp(appId, fullHistoryStart, end);
    const price = app.subscriptionPrice ? Number(app.subscriptionPrice) : DEFAULT_SUBSCRIPTION_PRICE;
    const profile = APP_ECONOMICS[app.name] ?? DEFAULT_ECONOMICS;

    const transactions: AppTransaction[] = [];
    for (const install of installs) {
      const payRand = new SeededRandom(install.externalUserId, "pays");
      if (!payRand.bool(profile.conversionRate)) continue;

      const txRand = new SeededRandom(install.externalUserId, "transactions");
      const firstPurchase = new Date(install.installedAt);
      firstPurchase.setDate(firstPurchase.getDate() + txRand.int(3, 7)); // trial length

      let purchaseDate = firstPurchase;
      let seq = 0;
      // Geometric retention: keep renewing while a per-cycle roll survives.
      while (purchaseDate <= end && seq < 36) {
        if (purchaseDate >= start && purchaseDate <= end) {
          const refundRand = new SeededRandom(install.externalUserId, "refund", seq);
          const isRefunded = refundRand.bool(0.03);
          transactions.push({
            transactionId: `txn_${install.externalUserId}_${seq}`,
            appUserId: install.externalUserId,
            productId: app.pricingModel === "subscription" ? "monthly_subscription" : "one_time_purchase",
            amount: Math.round(price * 100) / 100,
            currency: "USD",
            purchasedAt: purchaseDate,
            refundedAt: isRefunded
              ? new Date(purchaseDate.getTime() + 1000 * 60 * 60 * 24 * refundRand.int(1, 5))
              : undefined,
            platform: txRand.pick(["IOS", "ANDROID"] as const),
          });
        }
        seq++;
        if (!txRand.bool(MONTHLY_RETENTION)) break;
        const next = new Date(purchaseDate);
        next.setDate(next.getDate() + 30);
        purchaseDate = next;
      }
    }
    return transactions;
  }
}
