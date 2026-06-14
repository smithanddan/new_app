# LabPrice OS

LabPrice OS is a medical price intelligence engine for laboratory tests. It collects provider catalogs and prices, normalizes provider-specific test names into a canonical medical model, compares offers, and optimizes where a person should submit a basket of tests.

Working product framing:
- **LabPrice OS** for the product surface.
- **Medical Price Intelligence Engine** for the technical system.

The repository started as a generic web-monitor starter, but the current direction is specific: Skyscanner-like decision intelligence for lab tests.

## What It Does

- Collects raw lab market data from providers such as DNKOM and Gemotest.
- Stores provider tests, prices, promotions, run history, source URLs, and raw payloads.
- Matches provider tests to canonical tests with automatic and manual workflows.
- Compares provider offers for one analysis.
- Optimizes baskets across single-provider and split-provider routes.
- Shows market intelligence: min, max, median, average, promo ratio, and provider distribution.
- Keeps INVITRO in safe probe mode until ingestion is reliable.

## Main Layers

```text
[ Providers ]
      |
[ Ingestion ]
      |
[ Normalization ]
      |
[ Pricing Graph ]
      |
[ Basket Optimization ]
      |
[ Market Intelligence ]
      |
[ Product CLI / Admin UI ]
      |
[ User Decision ]
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture.
See [docs/PRODUCTION.md](docs/PRODUCTION.md) for CI/CD, Timeweb deploy, scheduled crawlers, and run safety.
See [docs/MONETIZATION.md](docs/MONETIZATION.md) for the B2C funnel and B2B API packaging.

## Key CLI Commands

```bash
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider dnkom --region moscow --dry-run
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider dnkom --region moscow --write --run-source scheduled
pnpm --filter @labmind/lab-crawlers compare:matrix -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers cheapest:basket -- --tests "Глюкоза,ТТГ,Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers compare:market -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers match:db -- --provider dnkom --city "Москва"
pnpm --filter @labmind/lab-crawlers match:manual -- --provider gemotest --provider-test-code "10.369" --canonical "Ферритин" --matched-by "local-admin" --write
pnpm --filter @labmind/lab-crawlers invitro:probe -- --city moscow
```

## Admin UI

The Next app now contains a lightweight public service layer plus the closed/internal admin views.

Public service routes:
- `/search` — entry point for one test or a basket;
- `/compare` — public-friendly decision table for one analysis;
- `/basket` — basket optimization view with provider checkout links;
- `/checkout` — server-side tracking redirect to the laboratory source URL.

Admin/internal routes:
- `/compare` — decision table for one analysis;
- `/basket` — basket route optimization;
- `/match` — matching control plane;
- `/runs` — scraper run history;
- `/dashboard` — coverage and quality overview.

Until authentication is added, deploy the app in a closed environment and avoid exposing service-role server configuration to client code.

## B2B API Skeleton

The API is read-only over the existing pricing engine. Successful requests log `api_request` monetization events server-side.

Examples:

```bash
curl "https://your-domain.example/api/v1/compare?test=Ферритин&city=Москва"
curl "https://your-domain.example/api/v1/basket-optimize?tests=Глюкоза,ТТГ,Ферритин&city=Москва"
curl "https://your-domain.example/api/v1/market-stats?test=Ферритин&city=Москва"
curl "https://your-domain.example/api/v1/cheapest?test=Ферритин&city=Москва"
```

Optional API key gate:

```bash
export LABPRICE_API_KEYS="key-1,key-2"
curl -H "x-api-key: key-1" "https://your-domain.example/api/v1/cheapest?test=Ферритин&city=Москва"
```

If `LABPRICE_API_KEYS` is unset, the API is open for local/dev smoke testing.

## Stack

- Next.js App Router
- TypeScript
- Supabase/Postgres
- Playwright for live provider flows where needed
- Tailwind
- pnpm workspaces

## Quick Start

```bash
pnpm install
cp .env.example .env
```

For Supabase-backed commands, set:

```bash
export SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."
export LABPRICE_API_KEYS="optional-api-key"
```

Do not commit service-role keys.
