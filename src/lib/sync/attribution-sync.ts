import { prisma } from "@/lib/prisma";
import { getAttributionProvider } from "@/lib/integrations/provider-factory";

/**
 * Pulls installs + events from an app's attribution provider and upserts
 * AttributedInstall/AttributedEvent rows. Also creates a placeholder
 * AppCustomer per install (appUserId = the attribution provider's
 * externalUserId) so an install always has somewhere to attach a later
 * RevenueCat customer record to — this is the first link in the
 * campaign -> install -> user -> transaction chain.
 */
export async function syncAttributionForApp(appId: string, start: Date, end: Date) {
  const connections = await prisma.integrationConnection.findMany({
    where: { appId, category: "ATTRIBUTION" },
  });

  let recordsImported = 0;

  for (const connection of connections) {
    const syncJob = await prisma.syncJob.create({
      data: { integrationConnectionId: connection.id, jobType: "ATTRIBUTION", status: "RUNNING", lastAttemptedSync: new Date() },
    });

    try {
      const provider = await getAttributionProvider(connection);
      const installs = await provider.getInstalls(appId, start, end);

      for (const install of installs) {
        const appCustomer = await prisma.appCustomer.upsert({
          where: { appId_appUserId: { appId, appUserId: install.externalUserId } },
          create: { appId, appUserId: install.externalUserId, externalUserId: install.externalUserId, country: install.country, firstSeenAt: install.installedAt },
          update: {},
        });

        const existing = await prisma.attributedInstall.findUnique({
          where: { appId_externalUserId: { appId, externalUserId: install.externalUserId } },
        });

        await prisma.attributedInstall.upsert({
          where: { appId_externalUserId: { appId, externalUserId: install.externalUserId } },
          create: {
            appId,
            campaignId: install.campaignId,
            externalUserId: install.externalUserId,
            installedAt: install.installedAt,
            mediaSource: install.mediaSource,
            campaignName: install.campaignName,
            adGroupId: install.adGroupId,
            adId: install.adId,
            country: install.country,
            attributionProvider: connection.provider,
            isMock: connection.mode !== "LIVE",
            appCustomerId: appCustomer.id,
          },
          update: {},
        });

        if (!existing) recordsImported++;
      }

      const events = await provider.getEvents(appId, start, end);
      for (const event of events) {
        await prisma.attributedEvent.upsert({
          where: {
            appId_externalUserId_eventName_eventTime: {
              appId,
              externalUserId: event.externalUserId,
              eventName: event.eventName,
              eventTime: event.eventTime,
            },
          },
          create: {
            appId,
            campaignId: event.campaignId,
            externalUserId: event.externalUserId,
            eventName: event.eventName,
            eventTime: event.eventTime,
            revenue: event.revenue,
            currency: event.currency,
            attributionProvider: connection.provider,
            isMock: connection.mode !== "LIVE",
          },
          update: {},
        });
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
