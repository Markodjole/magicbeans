import { SeededRandom } from "@/lib/seeded-random";
import type { CampaignMetrics } from "./types";

/**
 * Deterministic per-app economics profile. This is what makes some demo
 * apps winners and some losers (per spec: "Investors need to see both
 * successes and failures").
 *
 * cpiUsd and conversionRate are calibrated against real, published 2026
 * mobile UA benchmarks (Admiral Media / Segwise mobile marketing
 * benchmarks; RevenueCat "State of Subscription Apps"), not picked to hit
 * a target ROAS — targetROAS is a DERIVED label (conversionRate * price *
 * expected-payments-per-payer / cpi), used only as a display fallback when
 * a real synced-data ROAS isn't available yet. See mock-base.ts.
 *
 * Benchmark basis:
 *  - CPI: casual games $1.50-3.00, Health & Fitness $4.30-5.50, Education
 *    ~$4.70 (source-confirmed); Entertainment/Lifestyle/Productivity/Photo
 *    & Video/Finance have no single published figure, estimated within the
 *    broader $1-5 (and $4-15 for competitive verticals like finance)
 *    general benchmark range.
 *  - conversionRate (install -> paying customer): freemium median is
 *    2-5% "good", top quartile reaches 8-10%, bottom quartile under 2.5%.
 */
export type EconomicsProfile = {
  targetROAS: number; // derived display fallback — see comment above
  conversionRate: number; // fraction of installs that become paying customers (realistic band: 0.01-0.09)
  volatility: number; // 0..1, daily noise around the target
  baseDailySpend: number;
  cpiUsd: number; // cost per install, drives impressions/clicks/conversions
};

const MONTHLY_RETENTION = 0.65; // must match mock-base.ts
const EXPECTED_PAYMENTS_PER_PAYER = 1 / (1 - MONTHLY_RETENTION);

function derivedROAS(conversionRate: number, price: number, cpiUsd: number): number {
  return Math.round(((conversionRate * price * EXPECTED_PAYMENTS_PER_PAYER) / cpiUsd) * 100) / 100;
}

type RawProfile = { conversionRate: number; volatility: number; baseDailySpend: number; cpiUsd: number; price: number };

const RAW_ECONOMICS: Record<string, RawProfile> = {
  // Productivity — no published CPI benchmark; estimated within the general $1-5 band. Strong, near top-quartile conversion.
  FocusFlow: { conversionRate: 0.06, volatility: 0.12, baseDailySpend: 110, cpiUsd: 3.2, price: 9.99 },
  // Health & Fitness — CPI benchmark $4.30-5.50. "Good" freemium conversion band (3-5%).
  MacroMate: { conversionRate: 0.04, volatility: 0.28, baseDailySpend: 90, cpiUsd: 4.8, price: 12.99 },
  // Games (casual) — CPI benchmark $1.50-3.00. Mid conversion; low price is typical of casual game subscriptions.
  BlockBurst: { conversionRate: 0.03, volatility: 0.3, baseDailySpend: 120, cpiUsd: 2.2, price: 4.99 },
  // Entertainment — no published CPI benchmark; estimated. Short-form/drama content retains well, so mid-high conversion.
  DramaLoop: { conversionRate: 0.045, volatility: 0.2, baseDailySpend: 130, cpiUsd: 3.8, price: 9.99 },
  // Finance — competitive-vertical CPI benchmark runs $4-15; estimated at the higher end. Low conversion keeps this a risky app in the marketplace, by design.
  ReceiptFox: { conversionRate: 0.02, volatility: 0.3, baseDailySpend: 60, cpiUsd: 8.0, price: 7.99 },
  // Lifestyle — no published CPI benchmark; estimated within the general $1-5 band.
  PlantPal: { conversionRate: 0.03, volatility: 0.18, baseDailySpend: 50, cpiUsd: 2.9, price: 6.99 },
  // Education — CPI benchmark ~$4.70 (source-confirmed). Top-quartile conversion (cited 10-15% band; kept conservative at 8%).
  StudySprint: { conversionRate: 0.08, volatility: 0.25, baseDailySpend: 130, cpiUsd: 4.7, price: 5.99 },
  // Photo & Video — no published CPI benchmark; estimated at the higher/competitive end. Bottom-quartile conversion (cited under-2.5% band) — the deliberate underperformer.
  PhotoGlow: { conversionRate: 0.015, volatility: 0.25, baseDailySpend: 100, cpiUsd: 5.5, price: 4.99 },
};

export const APP_ECONOMICS: Record<string, EconomicsProfile> = Object.fromEntries(
  Object.entries(RAW_ECONOMICS).map(([name, raw]) => [
    name,
    {
      targetROAS: derivedROAS(raw.conversionRate, raw.price, raw.cpiUsd),
      conversionRate: raw.conversionRate,
      volatility: raw.volatility,
      baseDailySpend: raw.baseDailySpend,
      cpiUsd: raw.cpiUsd,
    },
  ])
);

export const DEFAULT_ECONOMICS: EconomicsProfile = {
  targetROAS: derivedROAS(0.03, 9.99, 4.0),
  conversionRate: 0.03,
  volatility: 0.2,
  baseDailySpend: 80,
  cpiUsd: 4.0,
};

/**
 * Generates one day's CampaignMetrics for a campaign, seeded so the same
 * (campaignId, date) always yields the same numbers. Shared by all mock
 * advertising adapters (TikTok/Meta/Google) so their numbers stay
 * internally consistent per app.
 */
export function generateDailyMetrics(params: {
  appName: string;
  campaignId: string;
  campaignName: string;
  date: Date;
  currency?: string;
}): CampaignMetrics {
  const { appName, campaignId, campaignName, date, currency = "USD" } = params;
  const dateStr = date.toISOString().slice(0, 10);
  const rand = new SeededRandom(campaignId, dateStr);
  const profile = APP_ECONOMICS[appName] ?? DEFAULT_ECONOMICS;

  const spend = Math.max(
    5,
    rand.normal(profile.baseDailySpend, profile.baseDailySpend * profile.volatility, profile.baseDailySpend * 0.2)
  );

  const cpi = Math.max(0.5, rand.normal(profile.cpiUsd, profile.cpiUsd * 0.15));
  const conversions = Math.max(0, Math.round(spend / cpi));

  // Realistic-ish funnel: CVR from click -> install roughly 8-20%, CTR roughly 1-3%.
  const cvr = rand.float(0.08, 0.2);
  const clicks = Math.max(conversions, Math.round(conversions / Math.max(cvr, 0.01)));
  const ctr = rand.float(0.01, 0.03);
  const impressions = Math.max(clicks, Math.round(clicks / ctr));

  return {
    campaignId,
    campaignName,
    date: dateStr,
    spend: Math.round(spend * 100) / 100,
    impressions,
    clicks,
    conversions,
    currency,
  };
}
