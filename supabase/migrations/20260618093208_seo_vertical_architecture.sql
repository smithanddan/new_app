-- LabPrice OS SEO vertical architecture.
-- Adds one shared SEO/product vertical model without replacing the existing
-- lab-test catalog, compare matrix, basket optimizer, or crawler sync tables.

create extension if not exists pgcrypto;

create table if not exists public.vertical_configs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  slug text unique not null,
  domain text not null default 'human',
  service_kinds text[] not null default '{}',
  seo_title_template text not null,
  seo_description_template text not null,
  search_placeholder text,
  enabled boolean not null default false,
  priority int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vertical_configs_domain_check'
      and conrelid = 'public.vertical_configs'::regclass
  ) then
    alter table public.vertical_configs
      add constraint vertical_configs_domain_check
      check (domain in ('human', 'veterinary'))
      not valid;
  end if;
end $$;

create table if not exists public.clinical_services (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name_ru text not null,
  category_id uuid,
  kind text not null default 'lab_test',
  aliases text[] not null default '{}',
  description text,
  safety_level text not null default 'price_only',
  is_active boolean not null default true,
  domain text not null default 'human',
  service_kind text not null default 'lab_test',
  seo_slug text,
  city_landing_enabled boolean not null default true,
  canonical_test_id uuid references public.canonical_tests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinical_services
  add column if not exists domain text not null default 'human',
  add column if not exists service_kind text not null default 'lab_test',
  add column if not exists seo_slug text,
  add column if not exists city_landing_enabled boolean not null default true,
  add column if not exists canonical_test_id uuid references public.canonical_tests(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clinical_services_domain_check'
      and conrelid = 'public.clinical_services'::regclass
  ) then
    alter table public.clinical_services
      add constraint clinical_services_domain_check
      check (domain in ('human', 'veterinary'))
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clinical_services_service_kind_check'
      and conrelid = 'public.clinical_services'::regclass
  ) then
    alter table public.clinical_services
      add constraint clinical_services_service_kind_check
      check (service_kind in ('lab_test', 'ultrasound', 'mri', 'ct', 'doctor_visit', 'dentistry', 'veterinary', 'procedure', 'other'))
      not valid;
  end if;
end $$;

create table if not exists public.provider_locations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  name text,
  address text not null,
  city text not null,
  lat numeric,
  lng numeric,
  phone text,
  working_hours text,
  source_url text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, city, address)
);

create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  clinical_service_id uuid references public.clinical_services(id) on delete set null,
  external_id text,
  external_code text,
  name text not null,
  normalized_name text not null,
  category text,
  kind text not null default 'other',
  specialty text,
  visit_type text,
  source_url text not null,
  match_status text not null default 'unmatched',
  match_confidence numeric(3, 2) not null default 0.00,
  raw_payload jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_prices (
  id uuid primary key default gen_random_uuid(),
  provider_service_id uuid not null references public.provider_services(id) on delete cascade,
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  provider_location_id uuid references public.provider_locations(id) on delete set null,
  regular_price_rub numeric(12, 2),
  promo_price_rub numeric(12, 2),
  effective_price_rub numeric(12, 2),
  valid_from date,
  valid_to date,
  source_url text not null,
  raw_payload jsonb,
  fetched_at timestamptz not null default now(),
  snapshot_on date not null default current_date,
  created_at timestamptz not null default now()
);

create unique index if not exists clinical_services_seo_slug_unique_idx
  on public.clinical_services(seo_slug)
  where seo_slug is not null;

create unique index if not exists clinical_services_canonical_test_unique_idx
  on public.clinical_services(canonical_test_id)
  where canonical_test_id is not null;

create index if not exists vertical_configs_enabled_idx
  on public.vertical_configs(enabled, priority);

create index if not exists clinical_services_kind_domain_idx
  on public.clinical_services(domain, service_kind, is_active);

create index if not exists provider_locations_provider_city_idx
  on public.provider_locations(provider_id, city);

create index if not exists provider_services_service_idx
  on public.provider_services(clinical_service_id, match_status, fetched_at desc);

create index if not exists provider_services_provider_idx
  on public.provider_services(provider_id, fetched_at desc);

create index if not exists service_prices_service_snapshot_idx
  on public.service_prices(provider_service_id, snapshot_on desc);

create index if not exists service_prices_compare_idx
  on public.service_prices(provider_id, provider_location_id, effective_price_rub);

insert into public.vertical_configs (
  code,
  name,
  slug,
  domain,
  service_kinds,
  seo_title_template,
  seo_description_template,
  search_placeholder,
  enabled,
  priority
)
values
  ('analizy', 'Анализы', 'analizy', 'human', array['lab_test'], '{service}: цены и сравнение в {city} | LabPrice OS', 'Сравнение цен и доступности для {service} в {city}: минимальная цена, медиана, диапазон и провайдеры.', 'Найти анализ', true, 10),
  ('uzi', 'УЗИ', 'uzi', 'human', array['ultrasound'], '{service}: цены на УЗИ в {city} | LabPrice OS', 'Сравнение цен и доступности УЗИ {service} в {city}.', 'Найти УЗИ', false, 20),
  ('mrt_kt', 'МРТ/КТ', 'mrt-kt', 'human', array['mri','ct'], '{service}: цены МРТ/КТ в {city} | LabPrice OS', 'Сравнение цен и доступности МРТ/КТ для {service} в {city}.', 'Найти МРТ или КТ', false, 30),
  ('vrachi', 'Врачи', 'vrachi', 'human', array['doctor_visit'], '{service}: цены приема в {city} | LabPrice OS', 'Сравнение цен и доступности приема врача по направлению {service} в {city}.', 'Найти врача', false, 40),
  ('kliniki', 'Клиники', 'kliniki', 'human', array['procedure','other'], '{service}: цены в клиниках {city} | LabPrice OS', 'Сравнение цен и доступности услуги {service} в клиниках города {city}.', 'Найти услугу', false, 50),
  ('stomatologiya', 'Стоматология', 'stomatologiya', 'human', array['dentistry'], '{service}: цены стоматологии в {city} | LabPrice OS', 'Сравнение цен и доступности стоматологической услуги {service} в {city}.', 'Найти стоматологическую услугу', false, 60),
  ('veterinariya', 'Ветеринария', 'veterinariya', 'veterinary', array['veterinary'], '{service}: цены ветеринарии в {city} | LabPrice OS', 'Сравнение цен и доступности ветеринарной услуги {service} в {city}.', 'Найти ветуслугу', false, 70)
on conflict (code) do update
set
  name = excluded.name,
  slug = excluded.slug,
  domain = excluded.domain,
  service_kinds = excluded.service_kinds,
  seo_title_template = excluded.seo_title_template,
  seo_description_template = excluded.seo_description_template,
  search_placeholder = excluded.search_placeholder,
  enabled = excluded.enabled,
  priority = excluded.priority,
  updated_at = now();

insert into public.clinical_services (
  code,
  name_ru,
  kind,
  aliases,
  description,
  safety_level,
  is_active,
  domain,
  service_kind,
  seo_slug,
  city_landing_enabled,
  canonical_test_id
)
select
  'lab_' || lower(canonical.code),
  canonical.name_ru,
  'lab_test',
  canonical.aliases,
  canonical.description,
  'price_only',
  canonical.is_active,
  'human',
  'lab_test',
  coalesce(nullif(canonical.name_en, ''), lower(canonical.code)),
  true,
  canonical.id
from public.canonical_tests canonical
on conflict (code) do update
set
  name_ru = excluded.name_ru,
  aliases = excluded.aliases,
  description = excluded.description,
  is_active = excluded.is_active,
  domain = excluded.domain,
  service_kind = excluded.service_kind,
  city_landing_enabled = excluded.city_landing_enabled,
  canonical_test_id = excluded.canonical_test_id,
  updated_at = now();

update public.clinical_services
set seo_slug = case
  when code = 'lab_biochem' then 'biochemistry-blood'
  when code = 'lab_cbc' then 'complete-blood-count'
  when code = 'lab_chol' then 'cholesterol-total'
  when code = 'lab_crea' then 'creatinine'
  when code = 'lab_fer' then 'ferritin'
  when code = 'lab_glu' then 'glucose'
  when code = 'lab_tsh' then 'tsh'
  when code = 'lab_uam' then 'urinalysis'
  when code = 'lab_vitd' then 'vitamin-d'
  else regexp_replace(lower(coalesce(seo_slug, code)), '[^a-z0-9]+', '-', 'g')
end
where service_kind = 'lab_test';

alter table public.vertical_configs enable row level security;
alter table public.clinical_services enable row level security;
alter table public.provider_locations enable row level security;
alter table public.provider_services enable row level security;
alter table public.service_prices enable row level security;

drop policy if exists "seo_read_vertical_configs" on public.vertical_configs;
create policy "seo_read_vertical_configs"
  on public.vertical_configs for select to authenticated using (true);

drop policy if exists "seo_admin_update_vertical_configs" on public.vertical_configs;
create policy "seo_admin_update_vertical_configs"
  on public.vertical_configs for update to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() ->> 'role', '') = 'admin'
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() ->> 'role', '') = 'admin'
  );

drop policy if exists "seo_read_clinical_services" on public.clinical_services;
create policy "seo_read_clinical_services"
  on public.clinical_services for select to authenticated using (true);

drop policy if exists "seo_admin_update_clinical_services" on public.clinical_services;
create policy "seo_admin_update_clinical_services"
  on public.clinical_services for update to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() ->> 'role', '') = 'admin'
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() ->> 'role', '') = 'admin'
  );

drop policy if exists "seo_read_provider_locations" on public.provider_locations;
create policy "seo_read_provider_locations"
  on public.provider_locations for select to authenticated using (true);

drop policy if exists "seo_read_provider_services" on public.provider_services;
create policy "seo_read_provider_services"
  on public.provider_services for select to authenticated using (true);

drop policy if exists "seo_read_service_prices" on public.service_prices;
create policy "seo_read_service_prices"
  on public.service_prices for select to authenticated using (true);

grant select on
  public.vertical_configs,
  public.clinical_services,
  public.provider_locations,
  public.provider_services,
  public.service_prices
to authenticated;

grant update (
  enabled,
  priority,
  seo_title_template,
  seo_description_template,
  search_placeholder,
  updated_at
) on public.vertical_configs to authenticated;

grant update (
  city_landing_enabled,
  updated_at
) on public.clinical_services to authenticated;
