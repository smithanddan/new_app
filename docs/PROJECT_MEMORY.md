# Project Memory: LabPrice OS

Use this file as the handoff context for new Codex/Claude/Cursor chats.

## One-Line Context

LabPrice OS is a Skyscanner-like decision engine for medical lab tests: it collects provider prices, normalizes tests, compares offers, optimizes baskets by price/geo, and is growing into SEO + B2C/B2B monetization.

## Current Repository

- Main working repo: `/Users/andreysviridov/Documents/ANALYZE`
- GitHub repo: `smithanddan/new_app`
- Current local branch seen recently: `codex/add-cmd-targeted-search-karyotype`
- Package manager: `pnpm`
- Main packages:
  - `packages/lab-crawlers` — scrapers, product logic, CLI, Supabase repositories.
  - `apps/admin` — Next.js app with public product pages, admin views, API routes.
  - `supabase/migrations` — database schema and seeds.

Important: there is also `/Users/andreysviridov/Documents/аналайз`, but the active LabPrice OS repo is `/Users/andreysviridov/Documents/ANALYZE`.

## Product Positioning

Working product name: **LabPrice OS**.

Technical name: **Medical Price Intelligence Engine**.

Core idea:

```text
not a scraper
not just ETL
but a decision engine:
"where is it cheaper and closer to do these lab tests?"
```

## Architecture Layers

```text
[Providers]
  -> [Data Ingestion]
  -> [Normalization / Matching]
  -> [Pricing Graph]
  -> [Geo Intelligence]
  -> [Basket Optimization]
  -> [Market Intelligence]
  -> [Product UX / API / SEO]
  -> [User Decision]
```

### 1. Data Ingestion

Implemented or partially implemented:

- `CrawlerRunner`
- provider adapters:
  - DNKOM live parser
  - Gemotest live/partial parser
  - CMD/Helix/KDL/Citilab expansion/probe/mock layer
  - INVITRO probe/API/snapshot/search tools, but ingestion is still cautious
- Supabase write layer:
  - `provider_tests`
  - `provider_test_prices`
  - `lab_promotions`
  - `lab_promotion_items`
  - `scraper_runs`
  - `scraper_run_items`

Rules:

- Prices are integer RUB, not cents/kopecks.
- `source_url` and `raw_payload` matter for debugging.
- Price history is append/idempotent, not blindly overwritten.
- Product/compare layers should not write price data.

### 2. Normalization / Matching

Main entities:

- `canonical_tests`
- `provider_tests`
- aliases
- `match:db`
- `match:manual`

Recent taxonomy work:

- `20260711190000_seed_popular_canonical_tests.sql` adds popular Moscow lab tests across biochemistry, thyroid, vitamins/minerals, lipids, hormones, inflammation, coagulation, and common panels.
- `DEFAULT_CANONICAL_TESTS` mirrors these popular canonical tests for offline/local matching.

Rules:

- Manual match wins.
- `analysis`, `panel`, and `complex` must be kept separate.
- Do not auto-match complexes/panels to single canonical analyses without review.

### 3. Pricing / Product Layer

Implemented product-facing commands:

```bash
pnpm --filter @labmind/lab-crawlers compare:matrix -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers compare:market -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers cheapest:basket -- --tests "Глюкоза,ТТГ,Ферритин" --city "Москва"
```

Pricing rows should carry not only RUB prices but also practical сдача conditions when available:

- `biomaterialPriceRub` and biomaterial service text;
- preparation notes;
- turnaround time;
- promo/regular/package offer type and validity dates;
- source URL and raw payload for audit/debug;
- provider flags such as urgent execution or home collection.

Basket optimizer v2 ideas:

- compare single-provider vs split-provider routes;
- dedupe biomaterial fee once per provider;
- apply provider route penalty;
- show final recommendation, not only cheapest row.

### 4. Geo Intelligence

Geo v1 exists conceptually and in code:

- `lab_locations`
- Haversine distance
- geo-aware compare/basket when `lat/lng` are passed
- no Yandex Maps dependency in core yet

Rule:

```text
Yandex/2GIS/maps APIs should be adapters, not core engine dependencies.
```

### 5. Referral / Direction Scanner

MVP direction:

- `/scan`
- photo/screenshot or pasted text
- local-first OCR via Tesseract.js planned/started
- handwritten referrals are out of MVP
- output goes to `/basket?tests=...`

Privacy rule:

- do not save referral photos in Supabase in MVP;
- avoid sending medical documents to external AI by default.

### 6. Provider Discovery Engine

Latest implemented layer:

- migration: `supabase/migrations/20260623121000_provider_discovery_engine.sql`
- core: `packages/lab-crawlers/src/provider-discovery.ts`
- CLI: `packages/lab-crawlers/src/scripts/discovery-providers.ts`
- admin pages:
  - `/discovery/providers`
  - `/discovery/runs`
  - `/discovery/queries`

Purpose:

```text
demand/query -> provider candidates -> dedup -> review
```

MVP is safe:

- manual seed only;
- no real 2GIS/Wordstat API;
- no mass web crawling;
- candidates do not go directly to `lab_providers`;
- accept/reject is deferred to a later review step.

Useful smoke commands:

```bash
pnpm --filter @labmind/lab-crawlers discovery:providers -- --city "Долгопрудный" --query "лаборатория анализов" --dry-run
pnpm --filter @labmind/lab-crawlers discovery:providers -- --city "Москва" --query "сдать анализы" --dry-run
```

Known dry-run behavior:

- Moscow returns known networks as duplicates: CMD, INVITRO, Gemotest, DNKOM, Helix, KDL.
- Dolgoprudny returns review candidates such as Niksor Clinic and MCDOL.

## Admin / Public UI

Current Next app is both public MVP and internal admin until auth is added.

Public/product routes:

- `/search`
- `/scan`
- `/compare`
- `/basket`
- `/checkout`
- `/test/[slug]`
- `/compare/[slug]`
- `/city/moscow/[testSlug]-price`
- `/basket/[slug]`
- `/api-docs`
- `/pricing`

Internal/admin routes:

- `/match`
- `/runs`
- `/dashboard`
- `/sources`
- `/seo-demand`
- `/discovery/providers`
- `/discovery/runs`
- `/discovery/queries`

Security note:

- Until auth is added, deploy in a closed/internal environment or make sure admin routes are not publicly exposed.
- Supabase service-role keys must stay server-side only.

## Monetization Direction

Three product lines:

1. B2C service:
   - SEO traffic;
   - compare/basket;
   - affiliate clicks via `/checkout`.
2. B2B API:
   - compare;
   - basket optimization;
   - market stats;
   - cheapest offer.
3. B2B dashboard:
   - market monitoring;
   - competitor prices;
   - promo tracking;
   - regional insights.

Implemented v1 monetization pieces:

- `/checkout` tracking redirect
- `monetization_events`
- API key gate via `LABPRICE_API_KEYS`
- API routes:
  - `/api/v1/compare`
  - `/api/v1/basket-optimize`
  - `/api/v1/market-stats`
  - `/api/v1/cheapest`
  - `/api/v1/leads`

## Production / Deployment

Target hosting discussed: Timeweb App Platform.

The project has:

- `Dockerfile`
- `Dockerfile.timeweb`
- `.timeweb/`
- docs:
  - `docs/PRODUCTION.md`
  - `docs/TIMEWEB.md`

Supabase note:

- User said Supabase project may be paused temporarily.
- Work should continue in dry-run/local-demo mode when Supabase is unavailable.
- See `docs/OFFLINE.md` for the exact no-Supabase workflow and recovery checklist.

## Environment Variables

Common:

```bash
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE_KEY="..."
LABPRICE_API_KEYS="optional-key-1,optional-key-2"
LABPRICE_DATA_SOURCE="local" # optional local demo mode
```

Discovery future:

```bash
TWOGIS_API_KEY="..." # placeholder only, disabled in MVP
```

Crawler limits:

```bash
DNKOM_SYNC_LIMIT=200
GEMOTEST_SYNC_LIMIT=100
```

Never commit service-role keys.

## Useful Commands

Quality:

```bash
pnpm --filter @labmind/lab-crawlers typecheck
pnpm --filter @labmind/lab-crawlers build
pnpm --filter @web-monitor/admin typecheck
pnpm --filter @web-monitor/admin build
pnpm -r typecheck
```

Crawler:

```bash
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider dnkom --region moscow --dry-run
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider gemotest --region moskva --dry-run
pnpm --filter @labmind/lab-crawlers sync:dnkom -- --dry-run
```

Compare/product:

```bash
pnpm --filter @labmind/lab-crawlers compare:matrix -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers compare:market -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers cheapest:basket -- --tests "Глюкоза,ТТГ,Ферритин" --city "Москва"
```

Matching:

```bash
pnpm --filter @labmind/lab-crawlers match:db -- --provider dnkom --city "Москва"
pnpm --filter @labmind/lab-crawlers match:manual -- --provider gemotest --provider-test-code "10.369" --canonical "Ферритин" --matched-by "local-admin" --write
```

Discovery:

```bash
pnpm --filter @labmind/lab-crawlers discovery:providers -- --city "Москва" --query "сдать анализы" --dry-run
pnpm --filter @labmind/lab-crawlers discovery:providers -- --city "Долгопрудный" --query "анализ крови" --dry-run
```

## Known Current State / Caveats

- The local worktree has many uncommitted changes across SEO/search/Timeweb/discovery areas.
- Do not blindly reset or checkout files.
- Supabase may be paused; use local demo/dry-run where possible.
- A recent `@web-monitor/admin typecheck` passed.
- A recent `@labmind/lab-crawlers typecheck` passed.
- A recent `@labmind/lab-crawlers build` passed.
- A recent `@web-monitor/admin build` hung at `Creating an optimized production build ...` and was manually interrupted; investigate before relying on production deploy.
- Provider Discovery MVP dry-runs passed.

## Recommended Next Steps

1. Apply the latest Supabase migrations when the Supabase project is active again:
   - production run safety migrations if not applied;
   - monetization events;
   - geo locations;
   - provider discovery engine.
2. Investigate why `pnpm --filter @web-monitor/admin build` hangs.
3. Add auth/protection for internal admin routes before public deployment.
4. Add provider discovery accept/reject flow:
   - first CLI;
   - later UI write action with audit log.
5. Continue growth/product work:
   - SEO route polish;
   - referral scanner quality;
   - basket optimizer UX;
   - local-demo robustness while Supabase is paused.

## Short Prompt For A New Chat

```text
Read /Users/andreysviridov/Documents/ANALYZE/docs/PROJECT_MEMORY.md first.
We are building LabPrice OS, a medical lab price decision engine.
Do not treat it as a generic scraper.
Preserve existing uncommitted work.
Supabase may be paused, so prefer dry-run/local-demo paths unless I say env is active.
```
