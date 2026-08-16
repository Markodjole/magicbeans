import { NextResponse } from "next/server";

/**
 * Google Play Real-time Developer Notifications arrive via a Cloud
 * Pub/Sub push subscription, authenticated by a bearer JWT that Pub/Sub
 * signs (verifiable against Google's public keys) — a different
 * mechanism from a simple shared secret or HMAC. That verification is
 * intentionally not implemented here rather than guessed; see
 * INTEGRATIONS.md for what's needed before this can accept real traffic.
 * Uses the current SubscriptionPurchaseV2 model, not the deprecated
 * `purchases.subscriptions` resource, once implemented.
 */
export async function POST(request: Request) {
  if (!process.env.GOOGLE_PLAY_PACKAGE_NAME) {
    return NextResponse.json({ error: "Google Play integration not configured" }, { status: 501 });
  }

  await request.text();

  // TODO before going live: verify the Pub/Sub push JWT against Google's
  // public keys, decode the base64 Pub/Sub message data (a
  // DeveloperNotification JSON payload), then call recordWebhookEvent({
  // provider: "GOOGLE_PLAY", ... }) / markWebhookProcessed as the other
  // webhook routes do.
  return NextResponse.json(
    { error: "Google Play signature verification not implemented — see INTEGRATIONS.md" },
    { status: 501 }
  );
}
