import { SeededRandom } from "@/lib/seeded-random";
import { syntheticInstallsForApp } from "@/lib/providers/mock-shared/synthetic-installs";
import type { AttributedEvent, AttributedInstall, AttributionProvider } from "./types";

export abstract class MockAttributionProviderBase implements AttributionProvider {
  abstract readonly providerName: string;

  async getInstalls(appId: string, start: Date, end: Date): Promise<AttributedInstall[]> {
    return syntheticInstallsForApp(appId, start, end);
  }

  async getEvents(appId: string, start: Date, end: Date): Promise<AttributedEvent[]> {
    // Informational supplementary event stream (trial/purchase signals as
    // AppsFlyer/Adjust would report them). The authoritative revenue
    // record is RevenueProvider's AppTransaction; AttributionRevenueEngine
    // matches on externalUserId, not on this event stream.
    const installs = await syntheticInstallsForApp(appId, start, end);
    const events: AttributedEvent[] = [];
    for (const install of installs) {
      const rand = new SeededRandom(install.externalUserId, "event");
      if (rand.bool(0.22)) {
        const trialAt = new Date(install.installedAt);
        trialAt.setDate(trialAt.getDate() + rand.int(0, 2));
        events.push({
          externalUserId: install.externalUserId,
          eventName: "trial_started",
          eventTime: trialAt,
          campaignId: install.campaignId,
        });
      }
    }
    return events.filter((e) => e.eventTime >= start && e.eventTime <= end);
  }
}
