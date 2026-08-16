# Integrations

Every integration follows the same pattern: a `types.ts` interface, a `Mock*` class that always
works, and a real class that throws a clear "not yet implemented" error unless it's actually
wired up. `IntegrationConnection.mode` (`LIVE` / `MOCK` / `DISCONNECTED` / `ERROR`) is stored per
`(app, category, provider)` in the database — see `src/lib/integrations/provider-factory.ts` for
the resolution rule: **LIVE only if credentials are configured AND the connection is explicitly
set to LIVE; otherwise MOCK, automatically, always.** Nothing ever silently mixes simulated
numbers into a LIVE data source.

## Status summary

| Integration | Adapter interface | Mock implementation | Real implementation | Required env vars |
|---|---|---|---|---|
| TikTok Ads | ✅ | ✅ full | ✅ full (reporting/campaigns; OAuth `connect()` still stub — sandbox tokens don't need it, 2026-08-16) | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`, `TIKTOK_REDIRECT_URI` |
| Meta Ads | ✅ | ✅ full | ✅ full (reporting/campaigns; OAuth `connect()` still stub — sandbox tokens don't need it, 2026-08-16) | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` |
| Google Ads | ✅ | ✅ full | 🚧 stub | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REFRESH_TOKEN` |
| AppsFlyer | ✅ | ✅ full | ✅ full (verified live 2026-08-15) | `APPSFLYER_API_TOKEN`, `APPSFLYER_APP_ID` |
| Adjust | ✅ | ✅ full | 🚧 stub | `ADJUST_API_TOKEN`, `ADJUST_APP_TOKEN` |
| RevenueCat | ✅ | ✅ full | ✅ full (REST reconciliation + webhook, 2026-08-15) | `REVENUECAT_API_KEY` |
| Apple App Store | ✅ | ✅ (shares RevenueCat's mock generator) | 🚧 stub | `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_BUNDLE_ID` |
| Google Play | ✅ | ✅ (shares RevenueCat's mock generator) | 🚧 stub | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME` |
| Stripe Connect | ✅ | ✅ full (`MockPaymentProvider`) | 🚧 stub (webhook signature verification IS implemented) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` |

"🚧 stub" means: the class exists, implements the full interface, correctly reports
`isConfigured()`, and throws a clear `"<Provider> LIVE adapter not yet implemented — see
INTEGRATIONS.md"` error if somehow invoked. This is intentional, per this project's rule to never
fabricate an API endpoint or response shape without verifying it against the provider's current
official documentation first — something this build did not have live access to do. The
architecture is real and ready; only the actual HTTP calls are missing.

## Normalized data shapes

Every advertising provider normalizes into:

```ts
type CampaignMetrics = {
  campaignId: string; campaignName: string; date: string;
  spend: number; impressions: number; clicks: number; conversions: number;
  currency: string;
};
```

Every attribution provider normalizes into:

```ts
type AttributedInstall = {
  externalUserId: string; installedAt: Date; mediaSource: string;
  campaignId?: string; campaignName?: string; adGroupId?: string; adId?: string; country?: string;
};
type AttributedEvent = {
  externalUserId: string; eventName: string; eventTime: Date;
  revenue?: number; currency?: string; campaignId?: string;
};
```

Every revenue provider normalizes into:

```ts
type AppTransaction = {
  transactionId: string; appUserId: string; productId: string;
  amount: number; currency: string; purchasedAt: Date; refundedAt?: Date;
  platform: "IOS" | "ANDROID" | "WEB";
};
```

## What it would take to go LIVE, per provider

**TikTok** — done (2026-08-16) for the reporting/read path. `src/lib/providers/advertising/tiktok.ts`
calls the real Business API (`business-api.tiktok.com/open_api/v1.3`, or
`sandbox-ads.tiktok.com/open_api/v1.3` for sandbox testing via `TIKTOK_API_BASE_URL`), authenticated
with a custom `Access-Token` header (not `Authorization: Bearer` — a real quirk of this API).
`listAccounts()`/`listCampaigns()`/`getCampaignMetrics()` are wired to real endpoints; `connect()`
(the production OAuth code-exchange) is still a stub since TikTok's Sandbox issues tokens directly
from the developer portal without it. Some field names (`campaign/get/`'s exact schema, the
`filtering` JSON syntax, `advertiser/info/`'s display-name fields) weren't independently confirmed —
flagged in the file's doc comment rather than guessed; verify against one real sandbox response
before trusting beyond testing.

**Meta** — done (2026-08-16) for the reporting/read path. `src/lib/providers/advertising/meta.ts`
calls the real Graph API (`graph.facebook.com/v25.0`), `access_token` as a query param.
`listAccounts()`/`listCampaigns()`/`getCampaignMetrics()` wired to real endpoints; `connect()`
(production OAuth) is still a stub since Sandbox Ad Account tokens are generated directly in the
developer console. One real unresolved conflict worth resolving before trusting dollar amounts:
sources disagreed on whether `daily_budget`/`spend`/`action_values` are in whole currency units or
minor-unit cents — one concrete documented example showed a decimal spend value inconsistent with
raw cents, so this file currently does NOT divide by 100, but that needs confirming against one
real sandbox insights response with a known budget. Also unverified: exact `me/adaccounts` shape,
and which `actions[].action_type` represents "conversions" for a given campaign's actual objective
(`mobile_app_install` is used as the likely candidate).

**Google Ads** — implement OAuth connect flows and the reporting API calls in
`src/lib/providers/advertising/google.ts`. Currently documents its base API surface in a comment;
verify current endpoint paths, required scopes, and response schemas against Google's official Ads
API docs (versioned, changes on deprecation schedules — do not trust this file's comments as a
source of truth by the time you read this).

**AppsFlyer / Adjust** — implement the Pull API (or equivalent reporting endpoint) calls in
`src/lib/providers/attribution/{appsflyer,adjust}.ts`.

**RevenueCat** — done (2026-08-15). `src/lib/providers/revenue/revenuecat.ts` calls the real REST
API v1 `GET /subscribers/{app_user_id}` (Bearer auth) for reconciliation — RevenueCat has no bulk
"all transactions in a range" endpoint, so this reconciles against every known
`AttributedInstall.externalUserId` for the app rather than listing customers directly.
`/api/webhooks/revenuecat` is the PRIMARY path for transaction amounts (the REST subscriber
response doesn't include price/currency at all — confirmed against RevenueCat's own docs; only the
webhook payload does), and triggers `runAttributionRevenueEngineForApp` immediately on each
purchase event so revenue shows up without waiting for the next scheduled sync.

Handled webhook event types: `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE`,
`UNCANCELLATION`, `PRODUCT_CHANGE`, `SUBSCRIPTION_EXTENDED` (creates/updates a transaction),
`BILLING_ISSUE` (no-op — failed charge, no money moved). **Not yet handled**:
`CANCELLATION`/`EXPIRATION` don't trigger `handleTransactionRefund` — RevenueCat's own docs
describe `CANCELLATION` as firing for "canceled OR refunded" without a single unambiguous field
distinguishing which; flagged rather than guessed. Confirm the exact distinguishing field against
a live RevenueCat account (or their support) before wiring that reversal path.

### Identity bridge (AppsFlyer <-> RevenueCat) — read this before connecting a real app

`AppCustomer.appUserId` is the shared join key the whole attribution chain depends on
(`campaign -> AttributedInstall.externalUserId -> AppCustomer.appUserId -> AppTransaction ->
RevenueAttribution`). It only works if **the app passes the exact same string** as:
- AppsFlyer's `customer_user_id` (`setCustomerUserId()` / `AFSDK.customerUserId`), and
- RevenueCat's `$appUserID` (`Purchases.configure(apiKey, appUserID:)` / `Purchases.logIn()`)

at the same point in the user's session (e.g. your own backend user ID, set on both SDKs right
after login/signup). If the two SDKs are ever configured with different IDs for the same real
person, `syncRevenueForApp`/the webhook will create a SEPARATE `AppCustomer` row with no linked
`AttributedInstall`, and every one of that person's transactions will attribute as
`UNATTRIBUTED` (no install record) rather than to the campaign that actually acquired them. There
is no reconciliation path for this after the fact — RevenueCat's own aliasing only merges
identities *it* knows about, not a mismatch against AppsFlyer's separate ID space. Get this right
at the SDK-integration stage, not after.

**Apple App Store** — implement JWT-signed App Store Server API calls in
`src/lib/providers/revenue/apple.ts`, and implement JWS signature-chain verification in
`/api/webhooks/apple` for App Store Server Notifications V2.

**Google Play** — implement calls against the current `purchases.subscriptionsv2`
(`SubscriptionPurchaseV2`) resource in `src/lib/providers/revenue/google-play.ts` — not the
deprecated `purchases.subscriptions` resource. Implement Pub/Sub push JWT verification in
`/api/webhooks/google-play` for Real-time Developer Notifications.

**Stripe** — implement `createDeposit`/`createPayout` in
`src/lib/providers/payment/stripe.ts` against Stripe Connect, test mode. The webhook route
(`/api/webhooks/stripe`) already verifies signatures correctly via the official `stripe` SDK; it
just needs the actual event-to-Investment/Payout reconciliation logic. **Do not** set
`ENABLE_REAL_MONEY=true` without completing the legal review in COMPLIANCE_NOTES.md first.

## Switching modes

Admins can flip any `IntegrationConnection` between `LIVE`/`MOCK`/`DISCONNECTED` from `/admin`
(`setIntegrationMode` in `src/lib/actions/admin-actions.ts`). Developers connect a MOCK
integration via the "Use Demo Data" buttons in `/developer/apps/[id]` (`connectDemoIntegration` in
`src/lib/actions/developer-actions.ts`), which is what the seed script itself drives under the
hood.
