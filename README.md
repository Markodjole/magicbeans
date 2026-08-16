# GrowthFund

A working prototype of a marketplace where mobile app developers set standing **revenue-share
terms** for future marketing investment (no funding target, no campaign-specific raise — the
terms apply to any marketing move until changed), investors fund under those terms, and investors
earn their agreed share of the **attributable revenue** those apps produce, after their principal
is recouped first.

This is **not** an equity marketplace. Investors never purchase ownership in an app or company.

See also: [ARCHITECTURE.md](ARCHITECTURE.md) · [INTEGRATIONS.md](INTEGRATIONS.md) ·
[DATA_MODEL.md](DATA_MODEL.md) · [COMPLIANCE_NOTES.md](COMPLIANCE_NOTES.md)

## The core idea

```
Investor capital
    ↓
Verified advertising spend (TikTok / Meta / Google Ads)
    ↓
Attributed installs (AppsFlyer / Adjust)
    ↓
App users
    ↓
Transactions (RevenueCat / Apple / Google Play)
    ↓
Attributed revenue
    ↓
Investor's agreed % share
```

Every step above is a persisted, auditable record — never a number computed only in the UI. See
any investment's **audit trail** (`/investor/investments/[id]/audit`) to see this chain for real
data.

## Local setup

### Prerequisites

- Node.js 20.9+
- Docker (for local Postgres) — or point `DATABASE_URL` at any Postgres 14+ instance

### 1. Install dependencies

```bash
npm install
```

### 2. Start Postgres

```bash
docker compose up -d
```

This starts a local Postgres on `localhost:5433` (see `docker-compose.yml`). If you already have
Postgres running elsewhere, skip this and point `DATABASE_URL` at it instead.

### 3. Configure environment

```bash
cp .env.example .env
```

The defaults work as-is against the Docker Postgres above. Every third-party integration
(TikTok, Meta, Google Ads, AppsFlyer, Adjust, RevenueCat, Apple, Google Play, Stripe) runs in
**MOCK mode automatically** when its credentials are blank — you do not need any real API keys to
run the full product.

### 4. Run migrations + seed demo data

```bash
npx prisma migrate deploy
npm run db:seed
```

Seeding creates 5 developers, 8 fictional apps, 12 funding opportunities, 50 investors, dozens of
investments, and 180 days of campaign/attribution/revenue history — by driving the same sync +
attribution-engine code a real deployment would use, not by faking pre-computed numbers. It takes
several minutes.

Demo login (all accounts use password `password123`):

| Role      | Email                                  |
| --------- | --------------------------------------- |
| Admin     | `admin@growthfund.dev`                  |
| Developer | `dev1@growthfund.dev` .. `dev5@growthfund.dev` |
| Investor  | `investor1@growthfund.dev` .. `investor50@growthfund.dev` |

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev          # start the dev server
npm run build         # production build
npm run type-check    # tsc --noEmit
npm run lint          # eslint
npm test              # vitest run (unit + integration tests against the DB above)
npm run db:seed       # re-run the demo data seed (safe to re-run against a fresh DB)
```

## Demonstrating the MVP scenario end to end

1. Log in as `dev1@growthfund.dev`, go to `/developer`, open an app, and walk through connecting
   revenue/attribution/advertising via **Use Demo Data**, then set that app's standing funding
   terms (a revenue-share % and return cap — no funding target, applies to any campaign the app
   runs).
2. Log in as any `investorN@growthfund.dev`, go to `/opportunities`, open one, and fund it.
3. Trigger a sync as `admin@growthfund.dev` from `/admin` (or wait for the next scheduled run of
   `/api/cron/sync`).
4. Back on the investor's dashboard, watch capital deployed / attributed revenue / your share
   populate — then open the investment's **audit trail** to see every underlying ledger entry and
   provider ID behind those numbers.

## What's LIVE vs MOCK right now

Every provider adapter runs in **MOCK mode automatically** unless real credentials are configured
in `.env` AND the connection is explicitly switched to LIVE from `/admin`. TikTok Ads, AppsFlyer,
and RevenueCat have real, working LIVE implementations (see [INTEGRATIONS.md](INTEGRATIONS.md) for
exactly what each covers and its known gaps); Meta, Google Ads, Adjust, Apple App Store, Google
Play, and Stripe are still stubs. Real money moves are additionally gated by
`ENABLE_REAL_MONEY=false` regardless of Stripe configuration.
