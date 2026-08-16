export type AttributedInstall = {
  externalUserId: string;
  installedAt: Date;
  mediaSource: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adId?: string;
  country?: string;
};

export type AttributedEvent = {
  externalUserId: string;
  eventName: string;
  eventTime: Date;
  revenue?: number;
  currency?: string;
  campaignId?: string;
};

/**
 * Answers "which users came from that advertising?" — the second link in
 * the campaign -> install -> user -> transaction -> attributed revenue
 * chain that AttributionRevenueEngine assembles. Implemented by
 * AppsFlyer/Adjust (mock + real). Only one attribution provider should be
 * active per app unless explicitly configured otherwise (see App's
 * IntegrationConnection rows, unique per (appId, category, provider)).
 */
export interface AttributionProvider {
  readonly providerName: string;

  getInstalls(appId: string, start: Date, end: Date): Promise<AttributedInstall[]>;
  getEvents(appId: string, start: Date, end: Date): Promise<AttributedEvent[]>;
}
