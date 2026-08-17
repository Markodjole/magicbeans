"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { runFullSyncForApp } from "@/lib/sync/run-sync";
import { syncRevenueForApp } from "@/lib/sync/revenue-sync";
import { runAttributionRevenueEngineForApp } from "@/lib/engine/attribution-revenue-engine";
import type { IntegrationMode, Prisma } from "@/generated/prisma/client";

async function logAudit(action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
  const admin = await requireRole("ADMIN");
  await prisma.auditEvent.create({
    data: { actorUserId: admin.id, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue | undefined },
  });
}

export async function approveDeveloper(developerProfileId: string) {
  await requireRole("ADMIN");
  await prisma.developerProfile.update({ where: { id: developerProfileId }, data: { approved: true } });
  await logAudit("APPROVE_DEVELOPER", "DeveloperProfile", developerProfileId);
  revalidatePath("/admin");
}

export async function approveApp(appId: string) {
  await requireRole("ADMIN");
  await prisma.app.update({ where: { id: appId }, data: { approved: true } });
  await logAudit("APPROVE_APP", "App", appId);
  revalidatePath("/admin");
}

export async function approveOpportunity(opportunityId: string) {
  await requireRole("ADMIN");
  await prisma.investmentOpportunity.update({ where: { id: opportunityId }, data: { status: "OPEN" } });
  await logAudit("APPROVE_OPPORTUNITY", "InvestmentOpportunity", opportunityId);
  revalidatePath("/admin");
  revalidatePath("/opportunities");
}

export async function approveOffer(offerId: string) {
  await requireRole("ADMIN");
  await prisma.performanceOffer.update({ where: { id: offerId }, data: { status: "OPEN" } });
  await logAudit("APPROVE_OFFER", "PerformanceOffer", offerId);
  revalidatePath("/admin");
  revalidatePath("/offers");
}

export async function pauseCampaign(campaignId: string) {
  await requireRole("ADMIN");
  await prisma.marketingCampaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  await logAudit("PAUSE_CAMPAIGN", "MarketingCampaign", campaignId);
  revalidatePath("/admin");
}

export async function flagSuspicious(entityType: string, entityId: string, reason: string) {
  await requireRole("ADMIN");
  await logAudit("FLAG_SUSPICIOUS", entityType, entityId, { reason });
  revalidatePath("/admin");
}

export async function setIntegrationMode(connectionId: string, mode: IntegrationMode) {
  await requireRole("ADMIN");
  await prisma.integrationConnection.update({ where: { id: connectionId }, data: { mode, lastError: null } });
  await logAudit("SET_INTEGRATION_MODE", "IntegrationConnection", connectionId, { mode });
  revalidatePath("/admin");
}

export async function triggerManualSync(appId: string, days = 7) {
  await requireRole("ADMIN");
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const result = await runFullSyncForApp(appId, start, end);
  await logAudit("MANUAL_SYNC", "App", appId, result);
  revalidatePath("/admin");
  return result;
}

/**
 * Integration-test screen only: inserts ONE clearly-labeled test
 * AttributedInstall (isMock: true, mediaSource "Test (manual)") so the
 * AppsFlyer <-> RevenueCat identity-bridge chain has something to link a
 * real RevenueCat Test Store purchase to. This does NOT call AppsFlyer —
 * generating a genuine AppsFlyer install requires their SDK running on a
 * real device/simulator (appsflyer_id can't be synthesized server-side).
 * Use the SAME externalUserId as the app_user_id you configure in
 * RevenueCat's Test Store purchase.
 */
export async function createTestAppsFlyerInstall(appId: string, externalUserId: string) {
  await requireRole("ADMIN");
  if (!externalUserId.trim()) throw new Error("externalUserId is required");

  const campaign = await prisma.marketingCampaign.findFirst({ where: { appId } });
  if (!campaign) throw new Error("This app has no marketing campaign to attribute the test install to.");

  const appCustomer = await prisma.appCustomer.upsert({
    where: { appId_appUserId: { appId, appUserId: externalUserId } },
    create: { appId, appUserId: externalUserId, externalUserId },
    update: {},
  });

  await prisma.attributedInstall.upsert({
    where: { appId_externalUserId: { appId, externalUserId } },
    create: {
      appId,
      campaignId: campaign.id,
      externalUserId,
      installedAt: new Date(),
      mediaSource: "Test (manual)",
      campaignName: campaign.name,
      attributionProvider: "APPSFLYER",
      isMock: true,
      appCustomerId: appCustomer.id,
    },
    update: {},
  });

  await logAudit("CREATE_TEST_APPSFLYER_INSTALL", "App", appId, { externalUserId, campaignId: campaign.id });
  revalidatePath("/admin/integration-test");
}

/**
 * Integration-test screen only: pulls this app's RevenueCat data via the
 * REST reconciliation path (syncRevenueForApp) and runs the attribution
 * engine — the same two steps the webhook triggers automatically per
 * event, exposed here as an on-demand button for verifying a Test Store
 * purchase without waiting on/re-sending a webhook.
 */
export async function runRevenueCatReconciliation(appId: string) {
  await requireRole("ADMIN");
  const end = new Date();
  const start = new Date(0);
  const revenue = await syncRevenueForApp(appId, start, end);
  const engine = await runAttributionRevenueEngineForApp(appId);
  await logAudit("REVENUECAT_RECONCILIATION", "App", appId, { revenue, engine });
  revalidatePath("/admin/integration-test");
  return { revenue, engine };
}
