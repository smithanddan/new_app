# Production Operations

This document describes the first production architecture for LabPrice OS: GitHub Actions coordinates CI, scheduled crawlers, and deploy triggering; Timeweb App Platform hosts the admin app; Supabase stores production data.

## Environments

Use GitHub Environments:
- `dev`: local development with `.env.local`.
- `staging`: dry-run and smoke checks.
- `prod`: Timeweb deploy trigger and scheduled crawler writes.

Required `prod` secrets:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TIMEWEB_DEPLOY_WEBHOOK_URL` after the Timeweb App Platform app is created.

Optional `prod` variables:
- `DNKOM_SYNC_LIMIT`
- `GEMOTEST_SYNC_LIMIT`

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code. The admin app must remain a closed/server-side admin surface until auth is added.

## Timeweb App Platform

Create the app once in the Timeweb panel.

Recommended settings:
- Repository: `smithanddan/new_app`
- Branch: `main`
- Type: frontend
- Framework: Next.js if available, otherwise React/Node.js
- Working directory: repository root `/`
- Port: `3000`
- Build command:

```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @web-monitor/admin build
```

- Run command:

```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm --filter @web-monitor/admin start
```

After creation, copy the deploy webhook URL into GitHub Environment `prod` as `TIMEWEB_DEPLOY_WEBHOOK_URL`. Prefer triggering deploy through GitHub Actions after CI rather than direct deploy-on-push, so a broken `main` build does not immediately replace production.

## CI/CD

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`:
- install with frozen lockfile;
- monorepo typecheck;
- lab crawler build;
- admin build;
- DNKOM fixture tests;
- Gemotest fixture tests.

`.github/workflows/deploy.yml` runs after successful `CI` on `main` and manual dispatch:
- uses GitHub Environment `prod`;
- triggers `TIMEWEB_DEPLOY_WEBHOOK_URL` when configured;
- exits safely with an instruction message if the Timeweb webhook is not configured yet.

## Scheduled Crawlers

`.github/workflows/crawler-schedule.yml` runs independently from deploy:
- DNKOM: every 6 hours, provider `dnkom`, region `moscow`, write mode, `run_source=scheduled`;
- Gemotest: daily at 02:30 UTC, provider `gemotest`, region `moskva`, write mode, `run_source=scheduled`;
- manual `workflow_dispatch` supports `provider`, `region`, `mode`, and `run_source`.

Manual backfill example:

```bash
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider dnkom --region moscow --write --run-source backfill
```

CI dry-run example:

```bash
pnpm --filter @labmind/lab-crawlers crawler:run -- --provider all --region Москва --dry-run --run-source ci
```

## Run Safety

Production ingestion has three safety mechanisms:
- `scraper_runs.run_source` separates `manual`, `scheduled`, `backfill`, and `ci` runs.
- `crawler_run_locks` prevents two write runs for the same provider and region from overlapping.
- `provider_test_prices.snapshot_on` plus a unique daily snapshot index makes repeated same-day price writes idempotent.

If a lock is already active, the run creates a cancelled `scraper_runs` row with `skippedReason: active crawler lock` and does not crawl or write prices.

If a price snapshot already exists for the same provider test, region, source URL, offer type, price values, and snapshot date, it is logged as a skipped item rather than an error.

## Observability

Use:
- GitHub Actions logs for CI, scheduled crawlers, and deploy trigger status.
- Timeweb App Platform build/deploy logs for app deploy failures.
- `scraper_runs` for run status, source, lock key, workflow id, and stats.
- `scraper_run_items` for item-level success, skipped, warning, and failed records.

Admin pages:
- `/runs` shows scraper run history.
- `/dashboard` shows coverage and quality metrics.
