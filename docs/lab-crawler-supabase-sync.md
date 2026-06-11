# Lab crawler Supabase sync

## Environment

`sync:dnkom -- --dry-run` does not require Supabase credentials.

`sync:dnkom -- --write` requires a server-only Supabase service role key:

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code or `NEXT_PUBLIC_*` variables.

## Commands

```bash
pnpm --filter @labmind/lab-crawlers sync:dnkom -- --dry-run
pnpm --filter @labmind/lab-crawlers sync:dnkom -- --write
```

Dry-run performs the live ДНКОМ scrape and prints the write plan without touching Supabase.

Write mode persists:

- `provider_tests`
- `provider_test_prices`
- `lab_promotions`
- `lab_promotion_items`
- `scraper_runs`
- `scraper_run_items`

## Write rules

- `provider_tests` are upserted by `provider_id + external_code` when the provider test code exists.
- If no code exists, `provider_tests` fallback matching uses `provider_id + normalized_name + source_url`.
- `provider_test_prices` are append-only; every sync can create a new row with its own `fetched_at`.
- The sync command deduplicates prices only inside one `scraper_run`.
- `lab_promotions` are upserted by `provider_id + lab_region_id + title + starts_on + ends_on + source_url`.
- `lab_promotion_items` are upserted by `promotion_id + provider_test_code` when a code exists.
- All prices are rubles: `regular_price_rub`, `promo_price_rub`, `effective_price_rub`, `biomaterial_price_rub`.
