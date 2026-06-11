-- MVP catalog and price admin schema for multi-provider laboratory prices.
-- Principle: store provider data "as-is" first, then match it to canonical_tests.

create extension if not exists pgcrypto;

alter table public.lab_providers
  add column if not exists display_name text,
  add column if not exists website_url text,
  add column if not exists is_active boolean not null default true,
  add column if not exists raw_payload jsonb;

update public.lab_providers
set display_name = coalesce(display_name, name)
where display_name is null;

create table if not exists public.lab_regions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  code text not null,
  name text not null,
  city text not null,
  country_code text not null default 'RU',
  url_prefix text,
  provider_city_id text,
  timezone text default 'Europe/Moscow',
  is_active boolean not null default true,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, code)
);

create table if not exists public.canonical_tests (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ru text not null,
  name_en text,
  kind text not null default 'analysis' check (kind in ('analysis','panel','profile','service')),
  category text,
  aliases text[] not null default '{}',
  description text,
  is_active boolean not null default true,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_tests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  canonical_test_id uuid references public.canonical_tests(id) on delete set null,
  external_id text,
  external_code text,
  name text not null,
  normalized_name text,
  kind text not null default 'analysis' check (kind in ('analysis','panel','profile','service','unknown')),
  category text,
  description text,
  biomaterial text,
  preparation text,
  turnaround_time text,
  source_url text,
  match_status text not null default 'unmatched' check (match_status in ('unmatched','auto_matched','manual_matched','ignored')),
  match_confidence numeric,
  matched_by uuid references auth.users(id) on delete set null,
  matched_at timestamptz,
  fetched_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, external_id)
);

create table if not exists public.provider_test_prices (
  id uuid primary key default gen_random_uuid(),
  provider_test_id uuid not null references public.provider_tests(id) on delete cascade,
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  lab_region_id uuid not null references public.lab_regions(id) on delete cascade,
  currency text not null default 'RUB',
  regular_price_rub integer,
  promo_price_rub integer,
  effective_price_rub integer,
  biomaterial_price_rub integer,
  offer_type text not null default 'regular' check (offer_type in ('regular','promo','cashback','package','unknown')),
  valid_from date,
  valid_to date,
  source_url text,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  check (regular_price_rub is null or regular_price_rub >= 0),
  check (promo_price_rub is null or promo_price_rub >= 0),
  check (effective_price_rub is null or effective_price_rub >= 0),
  check (biomaterial_price_rub is null or biomaterial_price_rub >= 0)
);

create table if not exists public.lab_promotions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  lab_region_id uuid references public.lab_regions(id) on delete cascade,
  external_id text,
  title text not null,
  description text,
  offer_type text not null default 'promo' check (offer_type in ('promo','cashback','package','discount','unknown')),
  starts_on date,
  ends_on date,
  region_scope text,
  source_url text,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, external_id)
);

create table if not exists public.lab_promotion_items (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.lab_promotions(id) on delete cascade,
  provider_test_id uuid references public.provider_tests(id) on delete set null,
  canonical_test_id uuid references public.canonical_tests(id) on delete set null,
  original_name text not null,
  regular_price_rub integer,
  promo_price_rub integer,
  effective_price_rub integer,
  biomaterial_price_rub integer,
  source_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  check (regular_price_rub is null or regular_price_rub >= 0),
  check (promo_price_rub is null or promo_price_rub >= 0),
  check (effective_price_rub is null or effective_price_rub >= 0),
  check (biomaterial_price_rub is null or biomaterial_price_rub >= 0)
);

create table if not exists public.test_indicators (
  id uuid primary key default gen_random_uuid(),
  canonical_test_id uuid not null references public.canonical_tests(id) on delete cascade,
  code text,
  name_ru text not null,
  name_en text,
  unit text,
  aliases text[] not null default '{}',
  sort_order integer,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.provider_scraper_configs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  lab_region_id uuid references public.lab_regions(id) on delete cascade,
  scraper_key text not null,
  strategy text not null default 'mock' check (strategy in ('mock','json_upload','http','playwright','manual')),
  entry_urls text[] not null default '{}',
  region_mode text not null default 'url_prefix' check (region_mode in ('url_prefix','cookie','local_storage','network_request','manual','unknown')),
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, lab_region_id, scraper_key)
);

create table if not exists public.scraper_runs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  lab_region_id uuid references public.lab_regions(id) on delete set null,
  scraper_config_id uuid references public.provider_scraper_configs(id) on delete set null,
  run_type text not null check (run_type in ('sync_catalog','sync_prices','sync_promotions','manual_json_import','region_probe')),
  status text not null default 'started' check (status in ('started','success','partial','failed','cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error text,
  raw_payload jsonb
);

create table if not exists public.scraper_run_items (
  id uuid primary key default gen_random_uuid(),
  scraper_run_id uuid not null references public.scraper_runs(id) on delete cascade,
  provider_test_id uuid references public.provider_tests(id) on delete set null,
  canonical_test_id uuid references public.canonical_tests(id) on delete set null,
  entity_type text not null check (entity_type in ('provider_test','price','promotion','promotion_item','region','unknown')),
  source_url text,
  status text not null check (status in ('success','skipped','warning','failed')),
  message text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_regions_provider on public.lab_regions(provider_id);
create index if not exists idx_canonical_tests_aliases on public.canonical_tests using gin (aliases);
create index if not exists idx_provider_tests_provider on public.provider_tests(provider_id);
create index if not exists idx_provider_tests_canonical on public.provider_tests(canonical_test_id);
create index if not exists idx_provider_tests_match_status on public.provider_tests(match_status);
create index if not exists idx_provider_test_prices_lookup on public.provider_test_prices(provider_id, lab_region_id, fetched_at desc);
create index if not exists idx_provider_test_prices_test on public.provider_test_prices(provider_test_id, fetched_at desc);
create index if not exists idx_lab_promotions_provider_region on public.lab_promotions(provider_id, lab_region_id, fetched_at desc);
create index if not exists idx_lab_promotion_items_promotion on public.lab_promotion_items(promotion_id);
create index if not exists idx_test_indicators_canonical on public.test_indicators(canonical_test_id);
create index if not exists idx_scraper_runs_provider_region on public.scraper_runs(provider_id, lab_region_id, started_at desc);
create index if not exists idx_scraper_run_items_run on public.scraper_run_items(scraper_run_id);

alter table public.lab_regions enable row level security;
alter table public.canonical_tests enable row level security;
alter table public.provider_tests enable row level security;
alter table public.provider_test_prices enable row level security;
alter table public.lab_promotions enable row level security;
alter table public.lab_promotion_items enable row level security;
alter table public.test_indicators enable row level security;
alter table public.provider_scraper_configs enable row level security;
alter table public.scraper_runs enable row level security;
alter table public.scraper_run_items enable row level security;

create policy "catalog_read_lab_regions" on public.lab_regions for select to authenticated using (true);
create policy "catalog_read_canonical_tests" on public.canonical_tests for select to authenticated using (true);
create policy "catalog_read_provider_tests" on public.provider_tests for select to authenticated using (true);
create policy "catalog_read_provider_test_prices" on public.provider_test_prices for select to authenticated using (true);
create policy "catalog_read_lab_promotions" on public.lab_promotions for select to authenticated using (true);
create policy "catalog_read_lab_promotion_items" on public.lab_promotion_items for select to authenticated using (true);
create policy "catalog_read_test_indicators" on public.test_indicators for select to authenticated using (true);
create policy "catalog_read_provider_scraper_configs" on public.provider_scraper_configs for select to authenticated using (true);
create policy "catalog_read_scraper_runs" on public.scraper_runs for select to authenticated using (true);
create policy "catalog_read_scraper_run_items" on public.scraper_run_items for select to authenticated using (true);

grant select on
  public.lab_regions,
  public.canonical_tests,
  public.provider_tests,
  public.provider_test_prices,
  public.lab_promotions,
  public.lab_promotion_items,
  public.test_indicators,
  public.provider_scraper_configs,
  public.scraper_runs,
  public.scraper_run_items
to authenticated;

insert into public.lab_providers (code, name, display_name, website_url, domains, is_active)
values
  ('invitro', 'ИНВИТРО', 'INVITRO', 'https://www.invitro.ru', array['invitro.ru'], true),
  ('gemotest', 'Гемотест', 'Гемотест', 'https://gemotest.ru', array['gemotest.ru'], true),
  ('dnkom', 'ДНКОМ', 'ДНКОМ', 'https://dnkom.ru', array['dnkom.ru'], true)
on conflict (code) do update
set
  name = excluded.name,
  display_name = excluded.display_name,
  website_url = excluded.website_url,
  domains = excluded.domains,
  is_active = excluded.is_active;

insert into public.lab_regions (provider_id, code, name, city, country_code, url_prefix, provider_city_id, raw_payload)
select provider.id, region.code, region.name, 'Москва', 'RU', region.url_prefix, region.provider_city_id, region.raw_payload
from public.lab_providers provider
join (
  values
    ('invitro', 'moscow', 'Москва', '/moscow', 'moscow', '{"note":"city appears in URL before section, e.g. /moscow/ak/"}'::jsonb),
    ('gemotest', 'moskva', 'Москва', '/moskva', 'moskva', '{"note":"city appears in URL before catalog, e.g. /moskva/catalog/"}'::jsonb),
    ('dnkom', 'moscow', 'Москва', null, null, '{"note":"region selection requires Playwright probe for cookie/localStorage/network city id"}'::jsonb)
) as region(provider_code, code, name, url_prefix, provider_city_id, raw_payload)
  on provider.code = region.provider_code
on conflict (provider_id, code) do update
set
  name = excluded.name,
  city = excluded.city,
  url_prefix = excluded.url_prefix,
  provider_city_id = excluded.provider_city_id,
  raw_payload = excluded.raw_payload,
  updated_at = now();

insert into public.canonical_tests (code, name_ru, name_en, kind, category, aliases)
values
  ('CBC', 'Общий анализ крови', 'Complete blood count', 'analysis', 'hematology', array['ОАК','клинический анализ крови','общий анализ крови']),
  ('UA', 'Общий анализ мочи', 'Urinalysis', 'analysis', 'urine', array['ОАМ','общий анализ мочи']),
  ('FER', 'Ферритин', 'Ferritin', 'analysis', 'iron', array['ферритин','ferritin']),
  ('TSH', 'ТТГ', 'Thyroid-stimulating hormone', 'analysis', 'thyroid', array['ТТГ','TSH','тиреотропный гормон']),
  ('GLU', 'Глюкоза', 'Glucose', 'analysis', 'biochemistry', array['глюкоза','glucose','глюкоза крови']),
  ('CHOL', 'Холестерин общий', 'Total cholesterol', 'analysis', 'lipids', array['общий холестерин','холестерин общий','total cholesterol','chol']),
  ('VITD', 'Витамин D', '25-OH Vitamin D', 'analysis', 'vitamins', array['25-OH витамин D','витамин д','vitamin d','25 гидроксивитамин d']),
  ('CREA', 'Креатинин', 'Creatinine', 'analysis', 'kidney', array['креатинин','creatinine'])
on conflict (code) do update
set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  kind = excluded.kind,
  category = excluded.category,
  aliases = excluded.aliases,
  updated_at = now();

insert into public.provider_scraper_configs (
  provider_id,
  lab_region_id,
  scraper_key,
  strategy,
  entry_urls,
  region_mode,
  config
)
select provider.id, region.id, config.scraper_key, config.strategy, config.entry_urls, config.region_mode, config.config
from public.lab_providers provider
join public.lab_regions region on region.provider_id = provider.id
join (
  values
    ('invitro', 'invitro_catalog_moscow', 'mock', array['https://www.invitro.ru/analizes/for-doctors/','https://www.invitro.ru/moscow/ak/'], 'url_prefix', '{"catalogPath":"/analizes/for-doctors/","promotionsPath":"/moscow/ak/"}'::jsonb),
    ('gemotest', 'gemotest_catalog_moskva', 'mock', array['https://gemotest.ru/moskva/catalog/'], 'url_prefix', '{"catalogPath":"/moskva/catalog/"}'::jsonb),
    ('dnkom', 'dnkom_catalog_moscow_probe', 'mock', array['https://dnkom.ru/'], 'network_request', '{"requiresPlaywrightProbe":true,"probe":["cookies","localStorage","networkRequests"]}'::jsonb)
) as config(provider_code, scraper_key, strategy, entry_urls, region_mode, config)
  on provider.code = config.provider_code
on conflict (provider_id, lab_region_id, scraper_key) do update
set
  strategy = excluded.strategy,
  entry_urls = excluded.entry_urls,
  region_mode = excluded.region_mode,
  config = excluded.config,
  updated_at = now();
