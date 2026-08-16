import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { markWebhookProcessed, recordWebhookEvent } from "@/lib/webhooks/idempotent-store";

const externalEventId = `evt_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { externalEventId } });
  await prisma.$disconnect();
});

describe("Webhook idempotent storage", () => {
  it("stores a new event once and recognizes a redelivery as a duplicate", async () => {
    const first = await recordWebhookEvent({
      provider: "STRIPE",
      externalEventId,
      rawBody: JSON.stringify({ id: externalEventId, type: "payment_intent.succeeded" }),
      payload: { id: externalEventId },
    });
    expect(first.isDuplicate).toBe(false);

    const second = await recordWebhookEvent({
      provider: "STRIPE",
      externalEventId,
      rawBody: JSON.stringify({ id: externalEventId, type: "payment_intent.succeeded" }),
      payload: { id: externalEventId },
    });
    expect(second.isDuplicate).toBe(true);
    expect(second.id).toBe(first.id);

    const rows = await prisma.webhookEvent.findMany({ where: { externalEventId } });
    expect(rows).toHaveLength(1);

    await markWebhookProcessed(first.id, "PROCESSED");
    const updated = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: first.id } });
    expect(updated.status).toBe("PROCESSED");
    expect(updated.processedAt).not.toBeNull();
  });

  it("treats the same externalEventId under a different provider as a distinct event", async () => {
    const stripeResult = await recordWebhookEvent({
      provider: "STRIPE",
      externalEventId: `${externalEventId}-cross-provider`,
      rawBody: "{}",
      payload: {},
    });
    const revenueCatResult = await recordWebhookEvent({
      provider: "REVENUECAT",
      externalEventId: `${externalEventId}-cross-provider`,
      rawBody: "{}",
      payload: {},
    });
    expect(stripeResult.isDuplicate).toBe(false);
    expect(revenueCatResult.isDuplicate).toBe(false);
    expect(stripeResult.id).not.toBe(revenueCatResult.id);

    await prisma.webhookEvent.deleteMany({ where: { externalEventId: `${externalEventId}-cross-provider` } });
  });
});
