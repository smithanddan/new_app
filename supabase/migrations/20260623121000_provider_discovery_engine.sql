create table if not exists public.provider_discovery_queries (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  city text not null,
  source text not null default 'manual',
  vertical text not null default 'lab_tests',
  canonical_test_id uuid references public.canonical_tests(id) on delete set null,
  priority integer not null default 100,
  enabled boolean not null default true,
  last_run_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_discovery_queries_priority_check check (priority >= 0)
);

create unique index if not exists provider_discovery_queries_unique
  on public.provider_discovery_queries (source, city, query, vertical);

create table if not exists public.provider_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  query_id uuid references public.provider_discovery_queries(id) on delete set null,
  city text not null,
  source text not null,
  status text not null default 'running',
  run_source text not null default 'manual',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text,
  raw_payload jsonb not null default '{}'::jsonb,
  constraint provider_discovery_runs_status_check
    check (status in ('running', 'completed', 'failed', 'skipped')),
  constraint provider_discovery_runs_run_source_check
    check (run_source in ('manual', 'scheduled', 'backfill', 'ci'))
);

create table if not exists public.provider_candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  website_url text,
  domain text,
  phone text,
  address text,
  city text not null,
  lat numeric,
  lng numeric,
  source_type text not null default 'manual_seed',
  confidence numeric not null default 0,
  status text not null default 'new',
  matched_provider_id uuid references public.lab_providers(id) on delete set null,
  duplicate_of_candidate_id uuid references public.provider_candidates(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_candidates_status_check
    check (status in ('new', 'needs_review', 'accepted', 'rejected', 'duplicate')),
  constraint provider_candidates_confidence_check
    check (confidence >= 0 and confidence <= 1)
);

create index if not exists provider_candidates_city_status_idx
  on public.provider_candidates (city, status, source_type);

create unique index if not exists provider_candidates_city_normalized_address_unique
  on public.provider_candidates (city, normalized_name, coalesce(address, ''));

create index if not exists provider_candidates_domain_idx
  on public.provider_candidates (domain) where domain is not null;

create table if not exists public.provider_candidate_sources (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.provider_candidates(id) on delete cascade,
  run_id uuid references public.provider_discovery_runs(id) on delete set null,
  query_id uuid references public.provider_discovery_queries(id) on delete set null,
  source_type text not null,
  source_url text,
  external_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists provider_candidate_sources_candidate_idx
  on public.provider_candidate_sources (candidate_id, fetched_at desc);

create unique index if not exists provider_candidate_sources_unique
  on public.provider_candidate_sources (
    candidate_id,
    source_type,
    coalesce(source_url, ''),
    coalesce(external_id, '')
  );

alter table public.provider_discovery_queries enable row level security;
alter table public.provider_discovery_runs enable row level security;
alter table public.provider_candidates enable row level security;
alter table public.provider_candidate_sources enable row level security;

grant select, insert, update, delete on public.provider_discovery_queries to service_role;
grant select, insert, update, delete on public.provider_discovery_runs to service_role;
grant select, insert, update, delete on public.provider_candidates to service_role;
grant select, insert, update, delete on public.provider_candidate_sources to service_role;

insert into public.provider_discovery_queries (query, city, source, vertical, priority, enabled, raw_payload)
values
  ('лаборатория анализов', 'Москва', 'manual', 'lab_tests', 10, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('сдать анализы', 'Москва', 'manual', 'lab_tests', 20, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('медицинская лаборатория', 'Москва', 'manual', 'lab_tests', 30, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('анализ крови', 'Москва', 'manual', 'lab_tests', 40, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('кариотип цена', 'Москва', 'manual', 'lab_tests', 50, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('лаборатория анализов Долгопрудный', 'Долгопрудный', 'manual', 'lab_tests', 10, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('сдать анализы Долгопрудный', 'Долгопрудный', 'manual', 'lab_tests', 20, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('клиника анализы Долгопрудный', 'Долгопрудный', 'manual', 'lab_tests', 30, true, '{"seed":"provider_discovery_mvp"}'::jsonb),
  ('анализ крови Долгопрудный', 'Долгопрудный', 'manual', 'lab_tests', 40, true, '{"seed":"provider_discovery_mvp"}'::jsonb)
on conflict (source, city, query, vertical) do update
set priority = excluded.priority,
    enabled = excluded.enabled,
    raw_payload = provider_discovery_queries.raw_payload || excluded.raw_payload,
    updated_at = now();
