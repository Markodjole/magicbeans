import type { AttributedEvent, AttributedInstall, AttributionProvider } from "./types";

/**
 * Real Adjust adapter. Adjust is an optional alternative to AppsFlyer —
 * a developer picks one attribution provider per app (see App onboarding
 * step 4: "AppsFlyer / Adjust / Other").
 *
 * Required env vars: ADJUST_API_TOKEN, ADJUST_APP_TOKEN.
 * Adjust exposes reporting via its own reporting/analytics API surface —
 * verify current endpoint paths and auth against Adjust's official docs
 * before implementing.
 *
 * Falls back to MockAdjustProvider automatically when unconfigured.
 */
export class AdjustProvider implements AttributionProvider {
  readonly providerName = "Adjust";

  constructor(private readonly apiToken: string) {}

  static isConfigured(): boolean {
    return Boolean(process.env.ADJUST_API_TOKEN && process.env.ADJUST_APP_TOKEN);
  }

  async getInstalls(_appId: string, _start: Date, _end: Date): Promise<AttributedInstall[]> {
    throw new Error("Adjust LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }

  async getEvents(_appId: string, _start: Date, _end: Date): Promise<AttributedEvent[]> {
    throw new Error("Adjust LIVE adapter not yet implemented — see INTEGRATIONS.md");
  }
}
