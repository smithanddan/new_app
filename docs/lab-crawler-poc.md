# Lab Crawler POC

This is an early Milestone 10A proof of concept for lab price collection.

The goal is to test the product pipeline before connecting live lab websites:

1. Search provider catalogs.
2. Normalize provider-specific test names into LabMind canonical codes.
3. Produce comparable price offers.
4. Render SQL for `lab_tests` and `lab_price_snapshots`.

## Catalog Model

Use three separate layers:

1. `test_catalog_items` — the shared LabMind catalog: canonical test/profile/service names.
2. `lab_tests` — provider-specific services mapped to catalog items.
3. `lab_price_snapshots` — time-based provider offers for a city/region.

This keeps the same test separate from its provider listing and separate from its changing prices.

Example:

- shared item: `TSH` / `ТТГ`;
- provider service: Invitro page `INV-TSH`, Gemotest page `GEM-TSH`;
- offers: regular price, promo price, promo validity period, region.

## Current Scope

The current implementation uses fixture providers, not live scraping.

Fixture providers:

- `invitro`
- `gemotest`
- `helix`

Canonical tests currently covered:

- `GLU` — glucose
- `CHOL` — total cholesterol
- `HDL`
- `LDL`
- `TG`
- `ALT`
- `AST`
- `TSH`
- `FER`

## Example Usage

```ts
import {
  comparePrices,
  fixtureLabAdapters,
  renderPriceSnapshotSql,
  runCrawler,
} from '@labmind/lab-crawlers';

const queries = [
  { query: 'глюкоза', city: 'Москва' },
  { query: 'ттг', city: 'Москва' },
];

const runs = await Promise.all(
  fixtureLabAdapters.map((adapter) => runCrawler(adapter, queries)),
);

const tests = runs.flatMap((run) => run.tests);
const comparison = comparePrices(tests);
const sql = renderPriceSnapshotSql(tests);
```

## Expected Output Shape

`comparePrices()` returns rows grouped by canonical test code and city:

```ts
[
  {
    code: 'GLU',
    name: 'Глюкоза',
    city: 'Москва',
    offers: [
      { providerCode: 'gemotest', price: 320, currency: 'RUB', ... },
      { providerCode: 'helix', price: 350, currency: 'RUB', ... },
      { providerCode: 'invitro', price: 390, currency: 'RUB', ... },
    ],
    cheapest: { providerCode: 'gemotest', price: 320, currency: 'RUB' },
  },
]
```

For promo offers, `price` in comparison means the effective comparable price:

1. `effectivePrice`
2. `promoPrice`
3. `price`
4. `regularPrice`

The raw snapshot still stores `regularPrice`, `promoPrice`, `offerType`, `promotionTitle`, `validFrom`, and `validTo`.

## Database Persistence

`renderPriceSnapshotSql()` creates SQL that:

- finds the provider in `lab_providers`;
- upserts `lab_tests` by `(provider_id, external_test_id)`;
- inserts a new `lab_price_snapshots` row for each check.

The crawler should run server-side with the service role key. Do not expose crawler writes to the browser.

## Invitro Source Notes

Initial Invitro URLs to study:

- Promotions: `https://www.invitro.ru/moscow/ak/`
- Individual test catalog: `https://www.invitro.ru/analizes/for-doctors/`
- General analyses entry point: `https://www.invitro.ru/analizes`

Observed from search results:

- `for-doctors` pages expose individual laboratory tests and category/city URLs.
- `profi` pages are used for complex profiles/checkups.
- `/analizes` appears to be the general catalog entry point/navigation layer.

Direct CLI requests currently receive `403` from DDoS-Guard, so live adapters need extra legal/technical review before automated fetching.

## Live Website Adapter Checklist

Before replacing a fixture adapter with a live adapter:

- Check robots.txt, terms, and rate limits for the provider.
- Use a provider-specific user agent from `CRAWLER_USER_AGENT`.
- Add request throttling from `CRAWLER_RATE_LIMIT_MS`.
- Keep raw HTML out of logs unless sanitized.
- Store failures in `crawler_runs` / future `crawler_errors`.
- Treat prices as snapshots, not stable truth.

## Next Step

Pick one provider and implement a real adapter behind the same `LabCrawlerAdapter` interface. Start with search + detail page parsing for 2-3 tests in one city.
