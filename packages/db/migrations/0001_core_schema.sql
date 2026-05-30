create extension if not exists pgcrypto;

create type source_kind as enum ('products', 'labs', 'services', 'competitors', 'custom');
create type extractor_type as enum ('css', 'llm', 'custom');
create type scrape_run_status as enum ('queued', 'running', 'success', 'failed', 'partial');
create type alert_severity as enum ('info', 'warning', 'error', 'critical');

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  kind source_kind not null default 'custom',
  base_url text,
  enabled boolean not null default true,
  schedule_cron text default '0 6 * * *',
  extractor_type extractor_type not null default 'css',
  extractor_config jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_pages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  url text not null,
  label text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source_id, url)
);

create table if not exists scrape_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete set null,
  status scrape_run_status not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  pages_total int not null default 0,
  pages_success int not null default 0,
  pages_failed int not null default 0,
  offers_extracted int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists raw_snapshots (
  id uuid primary key default gen_random_uuid(),
  scrape_run_id uuid references scrape_runs(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  source_page_id uuid references source_pages(id) on delete set null,
  url text not null,
  content_type text,
  body_text text,
  body_hash text generated always as (md5(coalesce(body_text, ''))) stored,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists extracted_offers (
  id uuid primary key default gen_random_uuid(),
  scrape_run_id uuid references scrape_runs(id) on delete cascade,
  raw_snapshot_id uuid references raw_snapshots(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  title text,
  brand text,
  sku text,
  category text,
  price_amount numeric(14,2),
  currency text,
  availability text,
  source_url text,
  city text,
  unit text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists canonical_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  kind source_kind not null default 'custom',
  category text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists item_matches (
  id uuid primary key default gen_random_uuid(),
  canonical_item_id uuid not null references canonical_items(id) on delete cascade,
  extracted_offer_id uuid not null references extracted_offers(id) on delete cascade,
  confidence numeric(5,4) not null default 0.5,
  strategy text not null default 'manual',
  created_at timestamptz not null default now(),
  unique(canonical_item_id, extracted_offer_id)
);

create table if not exists price_snapshots (
  id uuid primary key default gen_random_uuid(),
  canonical_item_id uuid references canonical_items(id) on delete set null,
  extracted_offer_id uuid references extracted_offers(id) on delete cascade,
  source_id uuid references sources(id) on delete cascade,
  price_amount numeric(14,2) not null,
  currency text not null default 'RUB',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  canonical_item_id uuid references canonical_items(id) on delete set null,
  severity alert_severity not null default 'info',
  type text not null,
  title text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sources_project on sources(project_id);
create index if not exists idx_source_pages_source on source_pages(source_id);
create index if not exists idx_scrape_runs_source_created on scrape_runs(source_id, created_at desc);
create index if not exists idx_raw_snapshots_run on raw_snapshots(scrape_run_id);
create index if not exists idx_extracted_offers_source_created on extracted_offers(source_id, created_at desc);
create index if not exists idx_price_snapshots_item_time on price_snapshots(canonical_item_id, captured_at desc);
create index if not exists idx_alerts_created on alerts(created_at desc);

alter table projects enable row level security;
alter table sources enable row level security;
alter table source_pages enable row level security;
alter table scrape_runs enable row level security;
alter table raw_snapshots enable row level security;
alter table extracted_offers enable row level security;
alter table canonical_items enable row level security;
alter table item_matches enable row level security;
alter table price_snapshots enable row level security;
alter table alerts enable row level security;
