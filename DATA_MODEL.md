# Data model

Full source of truth is `prisma/schema.prisma`. This is a guided tour of how the models connect,
grouped the same way the schema file is.

## Identity

- **User** — one row per login, `role` is `INVESTOR` / `DEVELOPER` / `ADMIN`.
- **InvestorProfile** / **DeveloperProfile** — 1:1 with `User`, created at registration. Only one
  of the two exists per user (admins have neither).

## Apps & integrations

- **App** — belongs to a `DeveloperProfile`. `approved` gates marketplace visibility. An app can
  run any number of `MarketingCampaign`s across any number of channels at once — investment is
  scoped to the app as a whole, not to one specific campaign (see "Investment marketplace" below).
- **IntegrationConnection** — one row per `(App, category, provider)` — e.g. FocusFlow's
  `ADVERTISING`/`TIKTOK` connection is a separate row from its `ATTRIBUTION`/`APPSFLYER`
  connection. Carries `mode` (`LIVE`/`MOCK`/`DISCONNECTED`/`ERROR`) and encrypted credentials.
- **AdvertisingAccount** — an ad platform account under one `IntegrationConnection`.
- **MarketingCampaign** — a specific campaign under one `AdvertisingAccount`.
- **CampaignDailyMetric** — one row per `(campaign, day)`: spend/impressions/clicks/conversions,
  with provenance (`provider`, `sourceType`, `isMock`, `syncedAt`).

## Attribution & revenue — the core data asset

- **AttributedInstall** — one row per install the attribution provider reports, linked to a
  `MarketingCampaign` (when the attribution provider could identify one) and to an `AppCustomer`.
- **AttributedEvent** — supplementary event stream (trial-started, etc.) from the attribution
  provider. Informational; **not** what revenue attribution is computed from.
- **AppCustomer** — one row per `(App, appUserId)`. `appUserId` is the revenue provider's
  identifier; `externalUserId` is the attribution provider's — in this system they're the same
  string, matching how a real app would pass one stable user id to both SDKs.
- **AppTransaction** — one row per purchase/renewal, from the revenue provider. `refundedAt` is
  set when refunded — but the row is never deleted (see `RevenueAttribution` below).
- **RevenueAttribution** — **the central record.** Persisted, not recomputed on page load, by
  `AttributionRevenueEngine`. Links an `AppTransaction` to a `MarketingCampaign`, with a
  `confidence` (`HIGH`/`MEDIUM`/`LOW`/`UNATTRIBUTED`) and an `attributionMethod` explaining why. A
  refund creates a **new** `RevenueAttribution` row (negative `attributedAmount`,
  `reversalOfId` pointing at the original) rather than touching the original.

## Investment marketplace

- **InvestmentOpportunity** — a developer's *standing revenue-share terms* for an app, not a
  per-campaign fundraising round. No funding target, no threshold: the moment an investor
  contributes, their money starts backing whichever campaigns the app runs, on any channel, and
  revenue share accrues immediately. Carries the terms: revenue-share percentages,
  `returnCapMultiple`, `minimumInvestment`. Changing terms never edits this row — the current
  `OPEN` row is marked `SUPERSEDED` (`endDate` set) and a new row is created; every existing
  `Investment` keeps pointing at whichever row it was made under, so past investors keep exactly
  what they signed up for. Multiple rows can be economically "live" at once: a `SUPERSEDED` row's
  investments keep accruing under their original terms until each individually hits its own
  return cap.
- **Investment** — one investor's stake in one specific terms-vintage (`InvestmentOpportunity`
  row). `principalAmount` never changes after creation; `capitalDeployed`, `attributableRevenue`,
  `investorRevenueEarned`, `developerRevenueEarned`, `amountPaidToInvestor`,
  `currentReturnMultiple`, and `status` are all aggregate fields kept in sync by the engine — never
  edited directly from a page. Revenue is pooled across *every* active investment for an app
  (across every terms-vintage) proportionally to principal, then each investment's own carved-out
  slice is split using whichever terms it was individually made under — see
  `attribution-revenue-engine.ts`.
- **CapitalAllocation** — one row per increment of an investment's principal actually "deployed"
  into real ad spend, across any of the app's campaigns (see `capital-deployment.ts`).
- **RevenueShareAccrual** — one row per `(Investment, RevenueAttribution)` pair: how much of that
  attribution event went to this specific investor vs. the developer. This is the per-investment
  breakdown that lets revenue from one transaction split correctly across many investors — even
  across different terms-vintages of the same app.
- **Payout** — an actual (simulated, unless `ENABLE_REAL_MONEY=true`) money movement to an
  investor.

## Ledger

- **LedgerEntry** — append-only. `type` is one of `INVESTMENT_DEPOSIT` / `CAMPAIGN_ALLOCATION` /
  `AD_SPEND` / `ATTRIBUTED_REVENUE` / `INVESTOR_REVENUE_SHARE` / `DEVELOPER_REVENUE_SHARE` /
  `PLATFORM_FEE` / `INVESTOR_PAYOUT` / `REFUND` / `REVERSAL`. Tagged with `investmentId` and/or
  `opportunityId` (both nullable — an entry can be opportunity-level, like `ATTRIBUTED_REVENUE`
  before it's split across investors, or investment-level, like `INVESTOR_REVENUE_SHARE`), plus a
  free-form `metadata` JSON blob carrying the underlying provider/record IDs. This is what every
  investment's audit-trail page reads.

## Risk, projections, sync, audit

- **RiskAssessment** — 1:1 with `InvestmentOpportunity`, computed app-wide (across every campaign
  the app runs). `score` (0-100) + `grade` (`A+`..`D`) + `positives`/`negatives` string arrays,
  all deterministically computed (`risk-score.ts`) — never an LLM call.
- Bear/base/bull projections are computed live, per proposed investment amount, by
  `src/lib/engine/projection-math.ts` (`estimateInvestorReturn`) — not a persisted model. It needs
  no target amount, so it works directly off whatever number an investor types into the invest
  form; see the "Projection — not guaranteed" panel on `/opportunities/[id]`.
- **SyncJob** — one row per sync attempt per `IntegrationConnection`: status, timestamps,
  `recordsImported`, `error`.
- **WebhookEvent** — idempotency ledger for inbound webhooks, unique on
  `(provider, externalEventId)`.
- **AuditEvent** — admin action log (approvals, mode switches, manual syncs, flags).

## Provenance fields

Every imported record carries where it came from: `provider`, `syncedAt`/`connectedAt`,
`isMock`/`sourceType`. The UI's `DataSourceBadge` component reads these directly — a number is
only ever labeled "Verified by X" when `isMock` is false on its underlying record; otherwise it's
labeled "SIMULATED".
