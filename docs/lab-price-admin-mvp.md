# Lab Price Admin MVP

## 1. SQL Migration

Migration:

- `supabase/migrations/20260611131132_lab_price_admin_mvp.sql`

Core tables:

- `lab_providers` — existing provider table, extended with `display_name`, `website_url`, `is_active`, `raw_payload`.
- `lab_regions` — provider-specific cities/regions.
- `canonical_tests` — LabMind unified catalog.
- `provider_tests` — provider catalog items as published by each lab.
- `provider_test_prices` — append-only regional price snapshots in rubles.
- `lab_promotions` — provider promotions.
- `lab_promotion_items` — tests/services inside promotions.
- `test_indicators` — indicators inside a canonical test.
- `provider_scraper_configs` — scraper settings.
- `scraper_runs` — scraper run history.
- `scraper_run_items` — item-level results and errors.

Important rules:

- Store all prices in rubles.
- Never overwrite historical prices; insert new `provider_test_prices` rows.
- Keep `source_url`, `fetched_at`, and `raw_payload` on every collected entity.
- Store regular price, promo price, effective price, and biomaterial collection price separately.
- Match provider tests to canonical tests through `match_status`, `match_confidence`, `matched_by`, and `matched_at`.

## 2. Seed Data

Seeded providers:

- `invitro`
- `gemotest`
- `dnkom`

Seeded Moscow regions:

- INVITRO: `moscow`, URL prefix `/moscow`
- Гемотест: `moskva`, URL prefix `/moskva`
- ДНКОМ: `moscow`, region state requires Playwright probe

Seeded canonical tests:

- `CBC` — Общий анализ крови
- `UA` — Общий анализ мочи
- `FER` — Ферритин
- `TSH` — ТТГ
- `GLU` — Глюкоза
- `CHOL` — Холестерин общий
- `VITD` — Витамин D
- `CREA` — Креатинин

## 3. TypeScript Types

Types live in:

- `packages/lab-crawlers/src/catalog-types.ts`
- `packages/lab-crawlers/src/provider-scraper.ts`

Main types:

- `LabProviderRecord`
- `LabRegionRecord`
- `CanonicalTestRecord`
- `ProviderTestRecord`
- `ProviderTestPriceRecord`
- `LabPromotionRecord`
- `LabPromotionItemRecord`
- `ProviderRegionProbeResult`

## 4. ProviderScraper Interface

```ts
export interface ProviderScraper {
  providerCode: ProviderCode;
  syncCatalog(context: ScraperContext): Promise<CatalogSyncResult>;
  syncPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]>;
  syncPromotions(context: ScraperContext): Promise<PromotionSyncResult>;
  probeRegion?(context: ScraperContext): Promise<ProviderRegionProbeResult>;
}
```

Implementations:

- `InvitroScraper`
- `GemotestScraper`
- `DnkomScraper`

Current implementations are mock/partial and intentionally preserve the architecture for real Playwright adapters.

## 5. Provider Pseudocode

### INVITRO

```ts
open https://www.invitro.ru/{regionPrefix}/analizes/for-doctors/
collect category links
for each category:
  collect test cards
  extract external code, name, price, biomaterial price, turnaround time, detail url
  save provider_tests as-is
  save provider_test_prices as append-only snapshot

open https://www.invitro.ru/{regionPrefix}/ak/
collect promotion cards
for each promotion:
  open detail page
  extract title, dates, region scope, promo price, linked tests when visible
  save lab_promotions and lab_promotion_items
```

### Гемотест

```ts
open https://gemotest.ru/{regionPrefix}/catalog/
collect catalog sections
for each section:
  collect service/test cards
  extract external id/code, name, regular price, biomaterial price, detail url
  save provider_tests and provider_test_prices

open actions/promotions entry points when mapped
extract promo title, valid dates, affected services, promo prices
save lab_promotions and lab_promotion_items
```

### ДНКОМ

```ts
open https://dnkom.ru/
before city selection:
  capture cookies
  capture localStorage
  start network listener

choose Moscow in UI
after city selection:
  capture cookies again
  capture localStorage again
  capture network requests containing city/region/price identifiers
  store probe result in scraper_runs.raw_payload

use discovered region mechanism:
  if cookie: replay cookie in browser context
  if localStorage: set key before navigation
  if network city id: call discovered endpoint or configure browser state

then sync catalog, prices, and promotions through the same ProviderScraper interface
```

## 6. Admin Pages

1. Providers
   - Provider list, active flag, website, scraper strategy.
2. Regions
   - Provider-specific cities, URL prefix, provider city id, active flag.
3. Provider Catalog
   - Raw provider tests, source URL, fetched_at, raw payload preview.
4. Canonical Tests
   - Unified tests, aliases, category, kind.
5. Test Matching
   - Unmatched provider tests, suggested canonical matches, manual confirm/ignore.
6. Prices
   - Latest prices by provider/region/test plus history drawer.
7. Promotions
   - Promotions, validity dates, region scope, linked promotion items.
8. Scraper History
   - Runs, statuses, stats, errors, item-level failures.

## 7. MVP Flow

1. Admin chooses provider and region.
2. Admin runs `sync_catalog`.
3. System creates or updates `provider_tests`.
4. System inserts new `provider_test_prices` rows.
5. System collects `lab_promotions` and `lab_promotion_items`.
6. System tries auto-match by exact aliases/name normalization.
7. Unmatched rows appear on Test Matching page.
8. After matching, comparison by canonical test and city becomes available.

## 8. Backlog

### P0

- Database: providers, regions, canonical tests, provider tests, prices, promotions.
- Seed INVITRO, Гемотест, ДНКОМ.
- Moscow as first region.
- Manual JSON import.
- Manual matching.
- Price comparison screen.
- Price history screen.

### P1

- Real Гемотест parser.
- Real ДНКОМ parser.
- Real INVITRO parser.
- Auto matching by aliases.
- Promotions with dates and regions.
- Separate biomaterial collection price.
- Detailed test cards.

### P2

- Multiple cities.
- Price change chart.
- Notifications: price dropped, promo appeared.
- AI name normalization.
- AI comparison for a bundle of tests.
- Basket: user selects tests, system calculates cheapest provider/region.
