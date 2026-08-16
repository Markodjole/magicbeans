import type { IntegrationProvider } from "@/generated/prisma/client";

/**
 * Human-friendly display names for IntegrationProvider enum values, used
 * anywhere we show a provider to a developer (buttons, badges, selects).
 */
export const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  TIKTOK: "TikTok Ads",
  META: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  APPSFLYER: "AppsFlyer",
  ADJUST: "Adjust",
  REVENUECAT: "RevenueCat",
  APPLE: "Apple",
  GOOGLE_PLAY: "Google Play",
  STRIPE: "Stripe",
  DEMO: "Demo",
};
