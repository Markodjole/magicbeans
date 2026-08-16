import { prisma } from "@/lib/prisma";
import { getRevenueProvider } from "@/lib/integrations/provider-factory";

/**
 * Pulls customers + transactions from an app's revenue provider
 * (RevenueCat/Apple/Google Play) and upserts AppCustomer/AppTransaction
 * rows. Does NOT run attribution matching itself — that's
 * AttributionRevenueEngine's job, run right after this by the caller
 * (admin manual sync, cron, or the seed script).
 */
export async function syncRevenueForApp(appId: string, start: Date, end: Date) {
  const connections = await prisma.integrationConnection.findMany({
    where: { appId, category: "REVENUE" },
  });

  let recordsImported = 0;

  for (const connection of connections) {
    const syncJob = await prisma.syncJob.create({
      data: { integrationConnectionId: connection.id, jobType: "REVENUE", status: "RUNNING", lastAttemptedSync: new Date() },
    });

    try {
      const provider = await getRevenueProvider(connection);
      const transactions = await provider.getTransactions(appId, start, end);

      for (const txn of transactions) {
        const appCustomer = await prisma.appCustomer.upsert({
          where: { appId_appUserId: { appId, appUserId: txn.appUserId } },
          create: { appId, appUserId: txn.appUserId, externalUserId: txn.appUserId },
          update: {},
        });

        const existing = await prisma.appTransaction.findUnique({ where: { transactionId: txn.transactionId } });

        await prisma.appTransaction.upsert({
          where: { transactionId: txn.transactionId },
          create: {
            appId,
            appCustomerId: appCustomer.id,
            transactionId: txn.transactionId,
            productId: txn.productId,
            amount: txn.amount,
            currency: txn.currency,
            purchasedAt: txn.purchasedAt,
            refundedAt: txn.refundedAt,
            platform: txn.platform,
            provider: connection.provider,
            isMock: connection.mode !== "LIVE",
          },
          update: { refundedAt: txn.refundedAt, syncedAt: new Date() },
        });

        if (!existing) recordsImported++;
      }

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { status: "SUCCESS", lastSuccessfulSync: new Date(), recordsImported },
      });
    } catch (err) {
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  return { recordsImported };
}
