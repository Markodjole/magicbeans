import { NextResponse } from "next/server";
import Stripe from "stripe";
import { recordWebhookEvent, markWebhookProcessed } from "@/lib/webhooks/idempotent-store";

/**
 * Stripe Connect webhook (TEST MODE only per project rules). Verifies the
 * signature with the official Stripe SDK before touching the payload —
 * this is the one webhook route where a well-known, stable verification
 * mechanism exists, so it's fully implemented rather than stubbed.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!secret || !signature) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 501 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { isDuplicate, id } = await recordWebhookEvent({
    provider: "STRIPE",
    externalEventId: event.id,
    rawBody,
    payload: event as unknown,
  });
  if (isDuplicate) return NextResponse.json({ received: true, duplicate: true });

  // Reconciliation logic (matching payment_intent.succeeded /
  // transfer.paid events back to Investment/Payout rows) is intentionally
  // not implemented — this prototype never runs with ENABLE_REAL_MONEY=true,
  // so no real Stripe event will ever reach this route. See INTEGRATIONS.md.
  await markWebhookProcessed(id, "PROCESSED");
  return NextResponse.json({ received: true });
}
