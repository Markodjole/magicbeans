# Compliance notes

This is engineering-facing documentation of what this prototype does and does not resolve. The
in-app `/compliance` page is the user-facing version of the same content. Neither this file nor
that page is a substitute for actual legal review — that review is a prerequisite for a real-money
launch, not something application code can complete on its own.

## What this product is

A marketplace where an investor funds a specific, verifiable marketing campaign in exchange for a
contractually agreed share of that campaign's **attributable revenue**, for a bounded duration, up
to a return cap. The investor never acquires equity, ownership, or a fixed-interest debt
instrument.

## What keeps real money off by default

- `ENABLE_REAL_MONEY` (`src/lib/config.ts`) defaults to `false`. Every investment/payout in this
  codebase currently runs through `MockPaymentProvider` regardless of this flag, because
  `StripePaymentProvider`'s actual HTTP calls are not implemented (see INTEGRATIONS.md) — but the
  flag is the intended, durable gate once they are.
- No code path flips `ENABLE_REAL_MONEY` automatically. It is an environment variable a human sets.
- `StripePaymentProvider` is explicitly documented as TEST MODE only.

## What a real-money launch would require — before any code changes

- **Securities law** — whether a revenue-share investment contract shaped like this one is a
  security in each relevant jurisdiction, and what registration or exemption would apply.
- **Lending / consumer credit law** — whether the structure could be construed as a loan, and what
  disclosure or licensing that triggers.
- **Revenue-sharing / marketplace regulation** — rules specific to platforms intermediating
  revenue-sharing agreements between two commercial parties.
- **Payments regulation** — money transmission licensing for any entity that custodies or moves
  investor/developer funds (Stripe Connect does not, by itself, resolve this).
- **KYC/AML** — identity verification and anti-money-laundering obligations for investors and
  developers.
- **Investor eligibility** — accreditation, suitability, or investment-limit rules that may apply
  depending on jurisdiction and final structure.

## UI copy constraints (enforced by convention, not by code)

- Never use "guaranteed returns," "risk-free," or "guaranteed income."
- Always label projections "Projection — not guaranteed."
- Always label simulated data "SIMULATED," never "Verified by X."
- Never use equity/ownership language ("shares," "stock," "buy into") — use "campaign funding,"
  "revenue share," "campaign return," "attributable revenue," "capital deployed."

## Data handling

- Integration credentials (OAuth tokens, API keys) are encrypted at rest
  (`src/lib/integrations/credential-service.ts`, AES-256-GCM).
- API secrets are never sent to the client — all third-party calls happen server-side.
- Logging must never include API secrets, access tokens, customer payment details, or private
  keys — review any new logging against this before merging.
- Financial records are never deleted or overwritten; corrections are new, explicitly-signed
  reversal rows (see `src/lib/engine/refund.ts`), so the full history stays auditable.
