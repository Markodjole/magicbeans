import { syncAdvertisingForApp } from "./advertising-sync";
import { syncAttributionForApp } from "./attribution-sync";
import { syncRevenueForApp } from "./revenue-sync";
import { runAttributionRevenueEngineForApp } from "@/lib/engine/attribution-revenue-engine";
import { runCapitalDeploymentForApp } from "@/lib/engine/capital-deployment";

/**
 * The full pipeline in the order the spec's chain requires: ad spend,
 * then who installed because of it, then what they paid, then match
 * revenue back to campaigns/investments, then update how much of each
 * investor's capital has actually been deployed. Used by the admin
 * "manually trigger synchronization" button, the (would-be) hourly cron,
 * and the seed script — one code path for all three, so seeded demo data
 * is produced by exactly the same logic a real sync would run.
 */
export async function runFullSyncForApp(appId: string, start: Date, end: Date) {
  const advertising = await syncAdvertisingForApp(appId, start, end);
  const attribution = await syncAttributionForApp(appId, start, end);
  const revenue = await syncRevenueForApp(appId, start, end);
  const engine = await runAttributionRevenueEngineForApp(appId);
  await runCapitalDeploymentForApp(appId);

  return { advertising, attribution, revenue, engine };
}
