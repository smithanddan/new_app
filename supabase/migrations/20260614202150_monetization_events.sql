-- Monetization tracking without billing.
-- Events are written server-side with the Supabase service role.

create table if not exists public.monetization_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('affiliate_click','basket_checkout','lead_request','api_request')),
  provider_id uuid references public.lab_providers(id) on delete set null,
  canonical_test_id uuid references public.canonical_tests(id) on delete set null,
  provider_test_id uuid references public.provider_tests(id) on delete set null,
  source_url text,
  target_url text,
  utm_source text,
  utm_campaign text,
  session_id text,
  city text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_monetization_events_type_created
  on public.monetization_events(event_type, created_at desc);

create index if not exists idx_monetization_events_provider_created
  on public.monetization_events(provider_id, created_at desc);

create index if not exists idx_monetization_events_session
  on public.monetization_events(session_id, created_at desc);

alter table public.monetization_events enable row level security;

grant insert, select on public.monetization_events to service_role;
