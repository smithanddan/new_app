-- Add karyotyping to the canonical laboratory test catalog.
-- This is a seed-only migration: no core schema or compare/basket contracts change.

create table if not exists public.clinical_services (
  id uuid primary key default gen_random_uuid(),
  canonical_test_id uuid references public.canonical_tests(id) on delete set null,
  code text unique not null,
  name_ru text not null,
  name_en text,
  service_kind text not null,
  domain text not null,
  seo_slug text unique not null,
  city_landing_enabled boolean not null default false,
  is_active boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinical_services enable row level security;

drop policy if exists "catalog_read_clinical_services" on public.clinical_services;
create policy "catalog_read_clinical_services"
  on public.clinical_services
  for select
  to authenticated
  using (true);

insert into public.canonical_tests (
  code,
  name_ru,
  name_en,
  kind,
  category,
  aliases,
  description,
  is_active,
  raw_payload
)
values (
  'KARYOTYPE',
  'Исследование кариотипа',
  'Karyotype analysis',
  'analysis',
  'genetics/cytogenetics',
  array[
    'кариотип',
    'кариотипирование',
    'исследование кариотипа',
    'цитогенетическое исследование кариотипа',
    'karyotype'
  ],
  'Цитогенетическое исследование кариотипа. Используется для сравнения цен, не является медицинской рекомендацией.',
  true,
  '{"seed":"cmd_targeted_karyotype","source":"manual_canonical_seed"}'::jsonb
)
on conflict (code) do update
set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  kind = excluded.kind,
  category = excluded.category,
  aliases = excluded.aliases,
  description = excluded.description,
  is_active = excluded.is_active,
  raw_payload = excluded.raw_payload,
  updated_at = now();

insert into public.clinical_services (
  canonical_test_id,
  code,
  name_ru,
  name_en,
  service_kind,
  domain,
  seo_slug,
  city_landing_enabled,
  is_active,
  raw_payload
)
select
  canonical.id,
  'KARYOTYPE',
  'Исследование кариотипа',
  'Karyotype analysis',
  'lab_test',
  'human',
  'karyotype',
  true,
  true,
  '{"seed":"cmd_targeted_karyotype","bridge":"canonical_test_to_service"}'::jsonb
from public.canonical_tests canonical
where canonical.code = 'KARYOTYPE'
on conflict (code) do update
set
  canonical_test_id = excluded.canonical_test_id,
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  service_kind = excluded.service_kind,
  domain = excluded.domain,
  seo_slug = excluded.seo_slug,
  city_landing_enabled = excluded.city_landing_enabled,
  is_active = excluded.is_active,
  raw_payload = excluded.raw_payload,
  updated_at = now();

update public.provider_scraper_configs config
set
  strategy = 'http',
  entry_urls = array[
    'https://www.cmd-online.ru/analizy-i-tseny/katalog-analizov/msk/',
    'https://www.cmd-online.ru/search/?q=%D0%BA%D0%B0%D1%80%D0%B8%D0%BE%D1%82%D0%B8%D0%BF&type=analyzes&action=popup'
  ],
  config = jsonb_build_object(
    'catalogPath', '/analizy-i-tseny/katalog-analizov/msk/',
    'targetedSearch', jsonb_build_array(
      jsonb_build_object(
        'term', 'кариотип',
        'url', 'https://www.cmd-online.ru/search/?q=%D0%BA%D0%B0%D1%80%D0%B8%D0%BE%D1%82%D0%B8%D0%BF&type=analyzes&action=popup',
        'canonicalCode', 'KARYOTYPE',
        'providerExternalCode', '190204',
        'matchReason', 'exact_provider_code'
      )
    ),
    'promotionsPath', '/aktsii/',
    'parser', 'cmd_live_html',
    'nextStep', 'production_write_after_dry_run_review'
  ),
  updated_at = now()
from public.lab_providers provider
join public.lab_regions region
  on region.provider_id = provider.id
where config.provider_id = provider.id
  and config.lab_region_id = region.id
  and provider.code = 'cmd'
  and region.code = 'msk'
  and config.scraper_key = 'cmd_catalog_msk_probe';

update public.provider_tests provider_test
set
  canonical_test_id = canonical.id,
  match_status = 'manual_matched',
  match_confidence = 1,
  matched_at = now(),
  raw_payload = coalesce(provider_test.raw_payload, '{}'::jsonb)
    || jsonb_build_object(
      'manual_match',
      jsonb_build_object(
        'canonical_code', 'KARYOTYPE',
        'provider_code', 'cmd',
        'external_code', '190204',
        'confidence', 1,
        'reason', 'exact_provider_code',
        'matched_at', now()
      )
    ),
  updated_at = now()
from public.lab_providers provider,
     public.canonical_tests canonical
where provider_test.provider_id = provider.id
  and provider.code = 'cmd'
  and provider_test.external_code = '190204'
  and canonical.code = 'KARYOTYPE';
