-- Geo Intelligence v1: manual/mock lab locations for nearest + cheapest decisions.
-- No external maps provider is used in v1.

create table if not exists public.lab_locations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.lab_providers(id) on delete cascade,
  lab_region_id uuid references public.lab_regions(id) on delete set null,
  name text not null,
  address text not null,
  city text not null,
  lat numeric(9,6) not null check (lat between -90 and 90),
  lng numeric(9,6) not null check (lng between -180 and 180),
  geo_hash text,
  coverage_radius_km numeric(8,2),
  pickup_type text not null default 'unknown'
    check (pickup_type in ('walk_in','courier','partner_clinic','unknown')),
  source_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, lab_region_id, address)
);

create index if not exists idx_lab_locations_city_provider
  on public.lab_locations(city, provider_id);

create index if not exists idx_lab_locations_region
  on public.lab_locations(lab_region_id);

alter table public.lab_locations enable row level security;

grant select, insert, update, delete on public.lab_locations to service_role;

with location_seed(provider_code, region_code, name, address, city, lat, lng, geo_hash, coverage_radius_km, pickup_type, source_url, raw_payload) as (
  values
    (
      'dnkom',
      'moscow',
      'ДНКОМ, центр Москвы',
      'Москва, Тверская улица, 18',
      'Москва',
      55.765347,
      37.605090,
      'ucfv0',
      5.00,
      'walk_in',
      'https://dnkom.ru/',
      '{"seed":"manual_mock","note":"Geo v1 test coordinate, replace with verified branch address before production routing"}'::jsonb
    ),
    (
      'dnkom',
      'moscow',
      'ДНКОМ, юго-запад',
      'Москва, Ленинский проспект, 68/10',
      'Москва',
      55.689815,
      37.542687,
      'ucftf',
      5.00,
      'walk_in',
      'https://dnkom.ru/',
      '{"seed":"manual_mock","note":"Geo v1 test coordinate, replace with verified branch address before production routing"}'::jsonb
    ),
    (
      'dnkom',
      'moscow',
      'ДНКОМ, восток',
      'Москва, Измайловский бульвар, 43',
      'Москва',
      55.798281,
      37.798201,
      'ucfvf',
      5.00,
      'walk_in',
      'https://dnkom.ru/',
      '{"seed":"manual_mock","note":"Geo v1 test coordinate, replace with verified branch address before production routing"}'::jsonb
    ),
    (
      'gemotest',
      'moskva',
      'Гемотест, центр Москвы',
      'Москва, Мясницкая улица, 24/7с1',
      'Москва',
      55.764341,
      37.635951,
      'ucfv1',
      5.00,
      'walk_in',
      'https://gemotest.ru/moskva/',
      '{"seed":"manual_mock","note":"Geo v1 test coordinate, replace with verified branch address before production routing"}'::jsonb
    ),
    (
      'gemotest',
      'moskva',
      'Гемотест, запад',
      'Москва, Кутузовский проспект, 30',
      'Москва',
      55.742059,
      37.532092,
      'ucftv',
      5.00,
      'walk_in',
      'https://gemotest.ru/moskva/',
      '{"seed":"manual_mock","note":"Geo v1 test coordinate, replace with verified branch address before production routing"}'::jsonb
    ),
    (
      'gemotest',
      'moskva',
      'Гемотест, север',
      'Москва, Ленинградский проспект, 74',
      'Москва',
      55.805369,
      37.516644,
      'ucfvm',
      5.00,
      'walk_in',
      'https://gemotest.ru/moskva/',
      '{"seed":"manual_mock","note":"Geo v1 test coordinate, replace with verified branch address before production routing"}'::jsonb
    )
)
insert into public.lab_locations (
  provider_id,
  lab_region_id,
  name,
  address,
  city,
  lat,
  lng,
  geo_hash,
  coverage_radius_km,
  pickup_type,
  source_url,
  raw_payload
)
select
  provider.id,
  region.id,
  seed.name,
  seed.address,
  seed.city,
  seed.lat,
  seed.lng,
  seed.geo_hash,
  seed.coverage_radius_km,
  seed.pickup_type,
  seed.source_url,
  seed.raw_payload
from location_seed seed
join public.lab_providers provider on provider.code = seed.provider_code
join public.lab_regions region
  on region.provider_id = provider.id
 and region.code = seed.region_code
on conflict (provider_id, lab_region_id, address) do update
set
  name = excluded.name,
  city = excluded.city,
  lat = excluded.lat,
  lng = excluded.lng,
  geo_hash = excluded.geo_hash,
  coverage_radius_km = excluded.coverage_radius_km,
  pickup_type = excluded.pickup_type,
  source_url = excluded.source_url,
  raw_payload = excluded.raw_payload,
  updated_at = now();
