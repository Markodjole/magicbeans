import { prisma } from "@/lib/prisma";
import type { IntegrationConnection } from "@/generated/prisma/client";
import type { AdvertisingProvider } from "@/lib/providers/advertising/types";
import { MockTikTokAdvertisingProvider } from "@/lib/providers/advertising/mock-tiktok";
import { MockMetaAdvertisingProvider } from "@/lib/providers/advertising/mock-meta";
import { MockGoogleAdvertisingProvider } from "@/lib/providers/advertising/mock-google";
import { TikTokAdvertisingProvider } from "@/lib/providers/advertising/tiktok";
import { MetaAdvertisingProvider } from "@/lib/providers/advertising/meta";
import { GoogleAdvertisingProvider } from "@/lib/providers/advertising/google";
import type { AttributionProvider } from "@/lib/providers/attribution/types";
import { MockAppsFlyerProvider } from "@/lib/providers/attribution/mock-appsflyer";
import { MockAdjustProvider } from "@/lib/providers/attribution/mock-adjust";
import { AppsFlyerProvider } from "@/lib/providers/attribution/appsflyer";
import { AdjustProvider } from "@/lib/providers/attribution/adjust";
import type { RevenueProvider } from "@/lib/providers/revenue/types";
import { MockRevenueCatProvider } from "@/lib/providers/revenue/mock-revenuecat";
import { RevenueCatProvider } from "@/lib/providers/revenue/revenuecat";
import { AppleRevenueProvider } from "@/lib/providers/revenue/apple";
import { GooglePlayRevenueProvider } from "@/lib/providers/revenue/google-play";
import type { PaymentProvider } from "@/lib/providers/payment/types";
import { MockPaymentProvider } from "@/lib/providers/payment/mock-payment";
import { StripePaymentProvider } from "@/lib/providers/payment/stripe";
import { ENABLE_REAL_MONEY } from "@/lib/config";
import { decryptCredential } from "./credential-service";

/**
 * The ONLY place in the app allowed to know about a specific provider
 * class. Every caller (sync jobs, engine, UI data loaders) resolves an
 * adapter through one of the functions below and gets back something
 * typed only as AdvertisingProvider/AttributionProvider/RevenueProvider/
 * PaymentProvider — it cannot tell, and must not try to tell, whether the
 * data underneath is LIVE or MOCK.
 *
 * Mode resolution rule (per spec): if credentials exist AND the live
 * class reports itself configured, use LIVE; otherwise MOCK. A connection
 * explicitly set to MOCK (e.g. "Use Demo Data" in onboarding, or an admin
 * override) always stays MOCK regardless of credentials.
 */

async function resolveMode(connection: IntegrationConnection, liveConfigured: boolean): Promise<"LIVE" | "MOCK"> {
  if (connection.mode === "MOCK" || connection.mode === "DISCONNECTED") return "MOCK";
  if (connection.mode === "LIVE" && liveConfigured) return "LIVE";
  // ERROR, or LIVE requested but not actually configured -> fall back to MOCK
  // and let the sync layer flag the connection's mode/lastError.
  return "MOCK";
}

export async function getAdvertisingProvider(connection: IntegrationConnection): Promise<AdvertisingProvider> {
  const token = connection.credentialsEncrypted ? decryptCredential(connection.credentialsEncrypted) : "";

  switch (connection.provider) {
    case "TIKTOK": {
      const mode = await resolveMode(connection, TikTokAdvertisingProvider.isConfigured());
      return mode === "LIVE" ? new TikTokAdvertisingProvider(token) : new MockTikTokAdvertisingProvider();
    }
    case "META": {
      const mode = await resolveMode(connection, MetaAdvertisingProvider.isConfigured());
      return mode === "LIVE" ? new MetaAdvertisingProvider(token) : new MockMetaAdvertisingProvider();
    }
    case "GOOGLE_ADS": {
      const mode = await resolveMode(connection, GoogleAdvertisingProvider.isConfigured());
      return mode === "LIVE" ? new GoogleAdvertisingProvider(token) : new MockGoogleAdvertisingProvider();
    }
    default:
      return new MockTikTokAdvertisingProvider();
  }
}

export async function getAttributionProvider(connection: IntegrationConnection): Promise<AttributionProvider> {
  const token = connection.credentialsEncrypted ? decryptCredential(connection.credentialsEncrypted) : "";

  switch (connection.provider) {
    case "APPSFLYER": {
      const mode = await resolveMode(connection, AppsFlyerProvider.isConfigured());
      return mode === "LIVE" ? new AppsFlyerProvider(token) : new MockAppsFlyerProvider();
    }
    case "ADJUST": {
      const mode = await resolveMode(connection, AdjustProvider.isConfigured());
      return mode === "LIVE" ? new AdjustProvider(token) : new MockAdjustProvider();
    }
    default:
      return new MockAppsFlyerProvider();
  }
}

export async function getRevenueProvider(connection: IntegrationConnection): Promise<RevenueProvider> {
  const token = connection.credentialsEncrypted ? decryptCredential(connection.credentialsEncrypted) : "";

  switch (connection.provider) {
    case "REVENUECAT": {
      const mode = await resolveMode(connection, RevenueCatProvider.isConfigured());
      return mode === "LIVE" ? new RevenueCatProvider(token) : new MockRevenueCatProvider();
    }
    case "APPLE": {
      const mode = await resolveMode(connection, AppleRevenueProvider.isConfigured());
      return mode === "LIVE" ? new AppleRevenueProvider() : new MockRevenueCatProvider();
    }
    case "GOOGLE_PLAY": {
      const mode = await resolveMode(connection, GooglePlayRevenueProvider.isConfigured());
      return mode === "LIVE" ? new GooglePlayRevenueProvider() : new MockRevenueCatProvider();
    }
    default:
      return new MockRevenueCatProvider();
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (ENABLE_REAL_MONEY && StripePaymentProvider.isConfigured()) {
    return new StripePaymentProvider(process.env.STRIPE_SECRET_KEY as string);
  }
  return new MockPaymentProvider();
}

/**
 * Resolves (or lazily creates, in MOCK mode) the IntegrationConnection row
 * for an app + category + provider, so callers don't have to duplicate
 * this lookup. Used by sync jobs and onboarding's "Use Demo Data" buttons.
 */
export async function getOrCreateConnection(
  appId: string,
  category: "ADVERTISING" | "ATTRIBUTION" | "REVENUE" | "PAYMENT",
  provider: IntegrationConnection["provider"]
): Promise<IntegrationConnection> {
  const existing = await prisma.integrationConnection.findUnique({
    where: { appId_category_provider: { appId, category, provider } },
  });
  if (existing) return existing;

  return prisma.integrationConnection.create({
    data: { appId, category, provider, mode: "MOCK", connectedAt: new Date() },
  });
}
