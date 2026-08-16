# Architecture

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, React 19, Tailwind v4, hand-built shadcn-style UI
primitives (`src/components/ui/`), PostgreSQL + Prisma, Auth.js v5 (Credentials provider, JWT
sessions), Recharts, Zod, Vitest.

## The one rule everything else follows

**The rest of the application must never know whether a number came from a real API or a mock
one.** Every external integration (advertising, attribution, revenue, payments) is defined as a
TypeScript interface in `src/lib/providers/<kind>/types.ts`, with a `Mock*` implementation and a
real implementation living side by side. Code that needs data resolves an adapter through
`src/lib/integrations/provider-factory.ts`, which is the **only** module allowed to import a
specific provider class. Everything downstream is typed only as `AdvertisingProvider` /
`AttributionProvider` / `RevenueProvider` / `PaymentProvider`.

```
src/lib/providers/
  advertising/   types.ts, mock-*.ts, tiktok.ts, meta.ts, google.ts
  attribution/   types.ts, mock-*.ts, appsflyer.ts, adjust.ts
  revenue/       types.ts, mock-*.ts, revenuecat.ts, apple.ts, google-play.ts
  payment/       types.ts, mock-payment.ts, stripe.ts
```

## Provable money flow: the pipeline

```
src/lib/sync/advertising-sync.ts   → CampaignDailyMetric  (spend/impressions/clicks/conversions)
src/lib/sync/attribution-sync.ts   → AttributedInstall / AttributedEvent
src/lib/sync/revenue-sync.ts       → AppCustomer / AppTransaction
src/lib/engine/attribution-revenue-engine.ts
                                    → RevenueAttribution (with a confidence level)
                                    → RevenueShareAccrual + LedgerEntry rows
                                    → updates Investment's aggregate fields
src/lib/engine/capital-deployment.ts → CapitalAllocation + LedgerEntry rows
```

`src/lib/sync/run-sync.ts` runs all of the above, in that order, for one app. This exact function
is called from three places — the seed script, the admin "trigger sync now" button, and
`/api/cron/sync` — so seeded demo data and a real deployment always go through identical logic.

Nothing about a financial number is ever computed only in a page component. Pages
(`src/app/**`) read through `src/lib/queries/*.ts`, which only ever reads what the engine already
persisted.

## Attribution confidence

`src/lib/engine/attribution-revenue-engine.ts` assigns one of `HIGH` / `MEDIUM` / `LOW` /
`UNATTRIBUTED` to every transaction it processes, based on whether (and how long after) an
install with a known campaign preceded it. Only `HIGH` and `MEDIUM` count toward investor revenue
share by default — see `ELIGIBLE_ATTRIBUTION_CONFIDENCES` in `src/lib/config.ts`, which is the one
place this is configured.

## Revenue share + return cap

All revenue-share math lives in `src/lib/engine/revenue-share.ts` as small, pure, dependency-free
functions — no Prisma calls, fully unit-testable, and the only place this arithmetic exists in the
codebase. The canonical entry point is `applyRevenueWaterfall`, which composes two rules in order:

1. **Recoup principal first.** 100% of a transaction's revenue attributable to an investment goes
   to the investor until their own `principalAmount` has been fully repaid — no split, no
   developer cut, during this phase. `investorRevenueEarnedSoFar` already tracks both the
   recoupment and profit-share portions paid to date, so "how much principal is still
   outstanding" is just `principal - investorRevenueEarnedSoFar` — no separate field needed.
2. **Split only the profit above that.** Once principal is recouped (which can happen mid-way
   through a single transaction), further revenue splits `investorSharePercent` /
   `developerSharePercent` via `splitRevenueShare`.

`applyReturnCap` then guarantees the investor is never paid more than `principal *
returnCapMultiple` in total across both phases combined; once reached, the investment's status
flips to `COMPLETED` and no further revenue is assigned to it (capital deployment continues
tracking spend, since that's a different concept from revenue earned). The developer's share is
never reduced by the investor's cap.

This is what makes a "bear case" scenario in the investor-facing calculator
(`estimateInvestorReturn` in `projection-math.ts`, which runs the exact same waterfall) mean
something honest: as long as attributed revenue for an investment reaches its principal, the
investor is at least whole — not already down 30-35% to a split that started from dollar one.

**`InvestmentOpportunity` is a developer's standing revenue-share terms for an app, not a
per-campaign fundraising round** — there's no funding target and no threshold to hit. Investing
starts earning the moment money comes in, and it backs whatever campaigns the app runs, on any
channel. When a developer changes terms, the current row is marked `SUPERSEDED` (not edited) and a
new row is opened; every existing `Investment` keeps pointing at whichever row it was made under,
so past investors keep exactly what they signed up for. `attribution-revenue-engine.ts` pools
*every* active investment for an app — across every terms-vintage at once — by principal, then
splits each investment's own carved-out slice using whichever percentages/cap it individually
locked in. `capital-deployment.ts` pools the same way for ad spend, across every campaign the app
runs.

## The ledger

`src/lib/ledger/ledger.ts` exports the single function (`recordLedgerEntry`) allowed to insert a
`LedgerEntry` row. Nothing is ever deleted or edited — a refund creates new, explicitly negative
`REFUND`/`REVERSAL` entries (see `src/lib/engine/refund.ts`) rather than touching the original
rows, so the full history stays auditable. Every entry carries a `metadata` JSON blob with the
underlying provider IDs it traces back to.

## Auth & authorization

Auth.js v5 with a Credentials provider and JWT sessions (`src/lib/auth.ts`). Role is baked into
the JWT/session. `src/proxy.ts` (Next.js 16's renamed `middleware.ts`) does an **optimistic**
route-level redirect for `/investor/*`, `/developer/*`, `/admin/*` based on session role — this is
UX only. Every server action and page additionally calls `requireRole` /
`requireInvestorProfile` / `requireDeveloperProfile` from `src/lib/authz.ts`, which is the actual
authorization boundary and also verifies record ownership (e.g. an investor can't view another
investor's investment by guessing its ID).

## Background jobs

Phase 1 of the "jobs abstraction that can initially run through server cron/API routes"
requirement: `/api/cron/sync` (`src/app/api/cron/sync/route.ts`) is a plain authenticated POST
route a scheduler hits on an interval, which calls `runFullSyncForApp` for every approved app.
Nothing about the sync logic depends on being invoked this way — swapping this route for
Trigger.dev/Inngest/Temporal later only touches this one file.

## Webhooks

`src/app/api/webhooks/{stripe,revenuecat,apple,google-play}/route.ts`. Every route stores incoming
events idempotently via `src/lib/webhooks/idempotent-store.ts` (`WebhookEvent`, unique on
`(provider, externalEventId)`) before doing anything else. Stripe's route has full signature
verification implemented (the official SDK makes this a well-known, stable mechanism). RevenueCat's
uses a shared-secret header. Apple's and Google Play's signature verification is real, non-trivial
cryptography (JWS certificate chains / Pub/Sub JWTs) that is intentionally left as a documented
`501 Not Implemented` rather than guessed at — see INTEGRATIONS.md.

## Mock data engine

`src/lib/seeded-random.ts` provides a `SeededRandom` class (mulberry32, seeded by a string hash of
whatever identifiers you pass in — e.g. `campaignId` + date). No mock code anywhere in the app
calls `Math.random()` directly; reloading a page or re-running the seed script against the same
data always produces the same historical numbers. Per-app economics profiles (target ROAS,
volatility, CPI) live in `src/lib/providers/advertising/mock-economics.ts` — this is what makes
some seeded apps genuine winners and some genuine losers.

## Credential storage

`src/lib/integrations/credential-service.ts` encrypts (`AES-256-GCM`) any stored OAuth
token/API key before it touches the database, keyed by `CREDENTIAL_ENCRYPTION_KEY`. All real
provider API calls happen server-side only; no secret is ever sent to the client.
