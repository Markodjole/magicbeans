import { NextResponse } from "next/server";

/**
 * Apple App Store Server Notifications V2. Apple sends a signed JWT
 * (`signedPayload`) whose signature chains up to an Apple root
 * certificate — verifying it properly requires validating that
 * certificate chain, not just decoding the JWT. That verification is
 * intentionally NOT implemented here (it's real, non-trivial crypto that
 * would be irresponsible to fabricate without testing against Apple's
 * actual notification service) — see INTEGRATIONS.md for what's needed
 * before this can accept real Apple traffic. The idempotency + storage
 * architecture below is real and ready for it.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!process.env.APPLE_BUNDLE_ID) {
    return NextResponse.json({ error: "Apple integration not configured" }, { status: 501 });
  }

  let body: { signedPayload?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.signedPayload) {
    return NextResponse.json({ error: "Missing signedPayload" }, { status: 400 });
  }

  // TODO before going live: verify the JWS signature chain against
  // Apple's root CA, then decode the notification + transaction/renewal
  // info payloads per the App Store Server Notifications V2 schema, and
  // call recordWebhookEvent({ provider: "APPLE", ... }) /
  // markWebhookProcessed exactly as the other webhook routes do.
  return NextResponse.json(
    { error: "Apple signature verification not implemented — see INTEGRATIONS.md" },
    { status: 501 }
  );
}
