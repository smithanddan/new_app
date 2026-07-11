# Offline Mode: Work While Supabase Is Paused

Use this mode when the Supabase project is paused or service-role env is unavailable.

## What Works Offline

- Next.js product/admin UI with local demo data.
- Fixture tests for DNKOM, Gemotest, CMD, INVITRO, and referral scanner.
- INVITRO probe/API probe/search without database writes.
- Provider discovery dry-runs.
- Local compare and basket CLI over fixtures/snapshots.
- Prices plus special conditions from fixtures/snapshots: biomaterial fee, biomaterial text, turnaround time, promo type/date when available, and provider-specific flags such as urgent/home collection.

## What Does Not Work Offline

- `sync:* -- --write`
- `crawler:run -- --write`
- `compare:db`
- `match:db --write`
- `match:manual --write`
- scheduled crawler writes
- monetization event writes

## Local UI

```bash
export LABPRICE_DATA_SOURCE=local
pnpm --filter @web-monitor/admin dev
```

Smoke pages:

```text
/search
/compare?test=Ферритин&city=Москва
/basket?tests=Глюкоза,ТТГ,Ферритин&city=Москва
/scan
/discovery/providers
/api-docs
/test/ferritin
```

Build in offline mode:

```bash
LABPRICE_DATA_SOURCE=local NEXT_TELEMETRY_DISABLED=1 pnpm --filter @web-monitor/admin build
```

## Local Product CLI

```bash
pnpm --filter @labmind/lab-crawlers compare:local -- --test "Ферритин"
pnpm --filter @labmind/lab-crawlers basket:local -- --tests "Глюкоза,ТТГ,Ферритин"
```

## Fixture And Probe Checks

```bash
pnpm --filter @labmind/lab-crawlers test:dnkom-fixtures
pnpm --filter @labmind/lab-crawlers test:gemotest-fixtures
pnpm --filter @labmind/lab-crawlers test:cmd-fixtures
pnpm --filter @labmind/lab-crawlers test:invitro-fixtures
pnpm --filter @labmind/lab-crawlers test:referral-scanner
pnpm --filter @labmind/lab-crawlers discovery:providers -- --city "Москва" --query "сдать анализы" --dry-run
pnpm --filter @labmind/lab-crawlers invitro:probe -- --city moscow --format json
pnpm --filter @labmind/lab-crawlers invitro:api-probe -- --city moscow --format json
pnpm --filter @labmind/lab-crawlers invitro:search -- --query "ферритин" --city moscow --format json --limit 5
```

`invitro:probe` and `invitro:api-probe` can refresh fixture files. They still do not write to Supabase.

## Current Offline Evidence

Known good local checks from the offline sprint:

- DNKOM fixtures: 25 catalog items, 8 promotions.
- Gemotest fixtures: 11 catalog items.
- CMD fixtures: 30 catalog items and karyotype match.
- INVITRO fixtures/API: popular tests, first catalog page, complexes, promotions.
- Referral scanner: matches `Витамин D`, `Глюкоза`, `ОАК`, `ТТГ`, `Ферритин`.
- `compare:local -- --test "Ферритин"` returns Gemotest and INVITRO offers.
- `basket:local -- --tests "Глюкоза,ТТГ,Ферритин"` returns a complete Gemotest route.
- `compare:local` includes a human-readable `Условия` column where parser data has biomaterial, collection fee, turnaround time, promo, urgent, or home-collection metadata.

## Supabase Recovery Checklist

When Supabase is active again:

1. Confirm env:

```bash
node -e 'console.log({ SUPABASE_URL: !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== "...", SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== "..." })'
```

2. Apply pending migrations if needed:

```text
20260613212522_production_run_safety.sql
20260614202150_monetization_events.sql
20260614213146_geo_intelligence_locations.sql
20260615164230_provider_expansion_moscow.sql
20260619184036_seed_karyotype_canonical_test.sql
20260623121000_provider_discovery_engine.sql
20260711190000_seed_popular_canonical_tests.sql
```

3. Start with dry-runs:

```bash
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider dnkom --region moscow --dry-run --run-source ci
pnpm --filter @labmind/lab-crawlers discovery:providers -- --city "Москва" --query "сдать анализы" --dry-run
```

4. Then write one provider:

```bash
pnpm --filter @labmind/lab-crawlers sync:dnkom -- --write
```

5. Verify DB product layer:

```bash
pnpm --filter @labmind/lab-crawlers compare:db -- --test "Ферритин" --city "Москва"
pnpm --filter @labmind/lab-crawlers match:db -- --provider dnkom --city "Москва"
pnpm --filter @labmind/lab-crawlers discovery:providers -- --city "Долгопрудный" --query "анализ крови" --write
```
