-- Production run safety: run source metadata, crawler locks, and idempotent price snapshots.

alter table public.scraper_runs
  add column if not exists run_source text not null default 'manual'
    check (run_source in ('manual','scheduled','backfill','ci')),
  add column if not exists triggered_by text,
  add column if not exists workflow_run_id text,
  add column if not exists lock_key text;

alter table public.provider_test_prices
  add column if not exists snapshot_on date;

update public.provider_test_prices
set snapshot_on = (fetched_at at time zone 'UTC')::date
where snapshot_on is null;

alter table public.provider_test_prices
  alter column snapshot_on set default ((now() at time zone 'UTC')::date);

create unique index if not exists provider_test_prices_daily_snapshot_uidx
  on public.provider_test_prices(
    provider_test_id,
    lab_region_id,
    coalesce(source_url, ''),
    offer_type,
    coalesce(regular_price_rub, -1),
    coalesce(promo_price_rub, -1),
    coalesce(effective_price_rub, -1),
    coalesce(biomaterial_price_rub, -1),
    snapshot_on
  )
  where snapshot_on is not null;

create table if not exists public.crawler_run_locks (
  lock_key text primary key,
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  lab_region_id uuid not null references public.lab_regions(id) on delete cascade,
  owner_token text not null,
  run_source text not null check (run_source in ('manual','scheduled','backfill','ci')),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_crawler_run_locks_expires_at
  on public.crawler_run_locks(expires_at);

alter table public.crawler_run_locks enable row level security;

grant select, insert, update, delete on public.crawler_run_locks to service_role;
grant select, insert, update, delete on public.scraper_runs to service_role;
grant select, insert on public.scraper_run_items to service_role;
grant select, insert on public.provider_test_prices to service_role;
