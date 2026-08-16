import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { IntegrationProvider } from "@/generated/prisma/client";

/**
 * Every webhook route must call this before doing anything with a payload.
 * Uniqueness is on (provider, externalEventId) — a redelivered event
 * (every provider's webhook system retries) is recognized and skipped
 * rather than double-processed. Never trust arbitrary incoming JSON:
 * routes must verify the provider's signature BEFORE calling this.
 */
export async function recordWebhookEvent(params: {
  provider: IntegrationProvider;
  externalEventId: string;
  rawBody: string;
  payload: unknown;
}): Promise<{ isDuplicate: boolean; id: string }> {
  const payloadHash = crypto.createHash("sha256").update(params.rawBody).digest("hex");

  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalEventId: { provider: params.provider, externalEventId: params.externalEventId } },
  });
  if (existing) {
    return { isDuplicate: true, id: existing.id };
  }

  const created = await prisma.webhookEvent.create({
    data: {
      provider: params.provider,
      externalEventId: params.externalEventId,
      payloadHash,
      payload: params.payload as never,
      status: "RECEIVED",
    },
  });
  return { isDuplicate: false, id: created.id };
}

export async function markWebhookProcessed(id: string, status: "PROCESSED" | "FAILED") {
  await prisma.webhookEvent.update({ where: { id }, data: { status, processedAt: new Date() } });
}
