import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdvertisingProvider } from "@/lib/integrations/provider-factory";
import { MockTikTokAdvertisingProvider } from "@/lib/providers/advertising/mock-tiktok";
import { TikTokAdvertisingProvider } from "@/lib/providers/advertising/tiktok";
import type { IntegrationConnection } from "@/generated/prisma/client";

function connection(overrides: Partial<IntegrationConnection>): IntegrationConnection {
  return {
    id: "conn_1",
    appId: "app_1",
    category: "ADVERTISING",
    provider: "TIKTOK",
    mode: "MOCK",
    externalAccountId: null,
    credentialsEncrypted: null,
    lastError: null,
    connectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as IntegrationConnection;
}

describe("IntegrationMode resolution (LIVE/MOCK switching)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("MOCK mode always returns the mock adapter, regardless of credentials", async () => {
    const provider = await getAdvertisingProvider(connection({ mode: "MOCK" }));
    expect(provider).toBeInstanceOf(MockTikTokAdvertisingProvider);
  });

  it("LIVE mode without configured credentials falls back to MOCK automatically", async () => {
    vi.stubEnv("TIKTOK_APP_ID", "");
    vi.stubEnv("TIKTOK_APP_SECRET", "");
    vi.stubEnv("TIKTOK_REDIRECT_URI", "");
    const provider = await getAdvertisingProvider(connection({ mode: "LIVE" }));
    expect(provider).toBeInstanceOf(MockTikTokAdvertisingProvider);
  });

  it("LIVE mode with credentials configured resolves the real adapter", async () => {
    vi.stubEnv("TIKTOK_APP_ID", "test-app-id");
    vi.stubEnv("TIKTOK_APP_SECRET", "test-secret");
    vi.stubEnv("TIKTOK_REDIRECT_URI", "https://example.com/callback");
    const provider = await getAdvertisingProvider(connection({ mode: "LIVE" }));
    expect(provider).toBeInstanceOf(TikTokAdvertisingProvider);
  });

  it("DISCONNECTED mode returns the mock adapter (never silently LIVE)", async () => {
    const provider = await getAdvertisingProvider(connection({ mode: "DISCONNECTED" }));
    expect(provider).toBeInstanceOf(MockTikTokAdvertisingProvider);
  });

  it("ERROR mode falls back to the mock adapter rather than a real call that will fail again", async () => {
    const provider = await getAdvertisingProvider(connection({ mode: "ERROR" }));
    expect(provider).toBeInstanceOf(MockTikTokAdvertisingProvider);
  });
});
