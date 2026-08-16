import type { AttributedEvent, AttributedInstall, AttributionProvider } from "./types";

/**
 * Real AppsFlyer adapter — the preferred/default attribution provider.
 *
 * Required env vars: APPSFLYER_API_TOKEN, APPSFLYER_APP_ID.
 *
 * Uses the Pull API raw-data export (hq1.appsflyer.com/api/raw-data/export/app/{app-id}/...),
 * auth via `Authorization: Bearer <API v2 token>`. The endpoint 302-redirects to a
 * one-time signed CSV URL on rawdata.appsflyer.com — confirmed live against a real
 * AppsFlyer account on 2026-08-15. installs_report/v5 and in_app_events_report/v5
 * return the same 78-column schema (an install is just an event row where
 * Event Name is empty/"install"); only the columns actually consumed are listed below.
 *
 * Falls back to MockAppsFlyerProvider automatically when unconfigured —
 * see getAttributionProvider() in src/lib/integrations/provider-factory.ts.
 */
export class AppsFlyerProvider implements AttributionProvider {
  readonly providerName = "AppsFlyer";

  constructor(private readonly apiToken: string) {}

  static isConfigured(): boolean {
    return Boolean(process.env.APPSFLYER_API_TOKEN && process.env.APPSFLYER_APP_ID);
  }

  async getInstalls(appId: string, start: Date, end: Date): Promise<AttributedInstall[]> {
    const rows = await this.fetchReport(appId, "installs_report", start, end);
    return rows.map((row) => ({
      externalUserId: row["Customer User ID"] || row["AppsFlyer ID"],
      installedAt: parseAppsFlyerDate(row["Install Time"]),
      mediaSource: row["Media Source"],
      campaignId: row["Campaign ID"] || undefined,
      campaignName: row["Campaign"] || undefined,
      adGroupId: row["Adset ID"] || undefined,
      adId: row["Ad ID"] || undefined,
      country: row["Country Code"] || undefined,
    }));
  }

  async getEvents(appId: string, start: Date, end: Date): Promise<AttributedEvent[]> {
    const rows = await this.fetchReport(appId, "in_app_events_report", start, end);
    return rows.map((row) => ({
      externalUserId: row["Customer User ID"] || row["AppsFlyer ID"],
      eventName: row["Event Name"],
      eventTime: parseAppsFlyerDate(row["Event Time"]),
      revenue: row["Event Revenue USD"] ? Number(row["Event Revenue USD"]) : undefined,
      currency: row["Event Revenue Currency"] || undefined,
      campaignId: row["Campaign ID"] || undefined,
    }));
  }

  private async fetchReport(
    appId: string,
    endpoint: "installs_report" | "in_app_events_report",
    start: Date,
    end: Date,
  ): Promise<Record<string, string>[]> {
    const from = formatDate(start);
    const to = formatDate(end);
    const url = `https://hq1.appsflyer.com/api/raw-data/export/app/${appId}/${endpoint}/v5?from=${from}&to=${to}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });

    if (!res.ok) {
      throw new Error(`AppsFlyer ${endpoint} failed: ${res.status} ${await res.text()}`);
    }

    return parseCsv(await res.text());
  }
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseAppsFlyerDate(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

/** Minimal RFC4180 CSV parser — AppsFlyer's export quotes fields containing commas (e.g. User Agent). */
function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, "").trim();
  if (!clean) return [];

  const lines = parseCsvLines(clean);
  const [header, ...dataLines] = lines;
  return dataLines.map((fields) =>
    Object.fromEntries(header.map((key, i) => [key, fields[i] ?? ""])),
  );
}

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
