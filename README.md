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

## Key CLI Commands

```bash
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider dnkom --region moscow --dry-run
pnpm --filter @labmind/lab-crawlers compare:matrix -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers cheapest:basket -- --tests "Глюкоза,ТТГ,Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers compare:market -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers match:db -- --provider dnkom --city "Москва"
pnpm --filter @labmind/lab-crawlers match:manual -- --provider gemotest --provider-test-code "10.369" --canonical "Ферритин" --matched-by "local-admin" --write
pnpm --filter @labmind/lab-crawlers invitro:probe -- --city moscow
```

## Admin UI

The admin app is a read-oriented product surface:
- `/compare` — decision table for one analysis;
- `/basket` — basket route optimization;
- `/match` — matching control plane;
- `/runs` — scraper run history;
- `/dashboard` — coverage and quality overview.

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
```

Do not commit service-role keys.
