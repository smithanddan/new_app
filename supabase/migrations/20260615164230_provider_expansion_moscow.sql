-- Provider expansion foundation for Moscow.
-- These providers start as probe/mock adapters; live parsers are added provider-by-provider.

insert into public.lab_providers (code, name, display_name, website_url, domains, is_active, raw_payload)
values
  ('cmd', 'CMD', 'CMD', 'https://www.cmd-online.ru', array['cmd-online.ru'], true, '{"stage":"provider_expansion","parser":"probe_mock"}'::jsonb),
  ('helix', 'Хеликс', 'Хеликс', 'https://helix.ru', array['helix.ru'], true, '{"stage":"provider_expansion","parser":"probe_mock"}'::jsonb),
  ('kdl', 'KDL', 'KDL', 'https://kdl.ru', array['kdl.ru'], true, '{"stage":"provider_expansion","parser":"probe_mock"}'::jsonb),
  ('citilab', 'СИТИЛАБ', 'СИТИЛАБ', 'https://citilab.ru', array['citilab.ru'], true, '{"stage":"provider_expansion","parser":"probe_mock"}'::jsonb)
on conflict (code) do update
set
  name = excluded.name,
  display_name = excluded.display_name,
  website_url = excluded.website_url,
  domains = excluded.domains,
  is_active = excluded.is_active,
  raw_payload = excluded.raw_payload;

insert into public.lab_regions (provider_id, code, name, city, country_code, url_prefix, provider_city_id, raw_payload)
select provider.id, region.code, region.name, 'Москва', 'RU', region.url_prefix, region.provider_city_id, region.raw_payload
from public.lab_providers provider
join (
  values
    ('cmd', 'msk', 'Москва', '/analizy-i-tseny/katalog-analizov/msk', 'msk', '{"note":"catalog uses /msk/ path, e.g. /analizy-i-tseny/katalog-analizov/msk/"}'::jsonb),
    ('helix', 'moskva', 'Москва', '/moskva', 'moskva', '{"note":"catalog uses /moskva/ path, e.g. /moskva/catalog/190-vse-analizy"}'::jsonb),
    ('kdl', 'msk', 'Москва', '/analizy-i-tseny/msk', 'msk', '{"note":"catalog uses /msk path, e.g. /analizy-i-tseny/msk"}'::jsonb),
    ('citilab', 'moskva', 'Москва', '/moskva', 'moskva', '{"note":"catalog uses /moskva path, e.g. /moskva/catalog/"}'::jsonb)
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
    ('cmd', 'cmd_catalog_msk_probe', 'probe_mock', array['https://www.cmd-online.ru/analizy-i-tseny/katalog-analizov/msk/'], 'url_prefix', '{"catalogPath":"/analizy-i-tseny/katalog-analizov/msk/","promotionsPath":"/aktsii/","nextStep":"live_html_parser"}'::jsonb),
    ('helix', 'helix_catalog_moskva_probe', 'probe_mock', array['https://helix.ru/moskva/catalog/190-vse-analizy'], 'url_prefix', '{"catalogPath":"/moskva/catalog/190-vse-analizy","promotionsPath":"/moskva/actions","nextStep":"live_html_or_api_probe"}'::jsonb),
    ('kdl', 'kdl_catalog_msk_probe', 'probe_mock', array['https://kdl.ru/analizy-i-tseny/msk'], 'url_prefix', '{"catalogPath":"/analizy-i-tseny/msk","promotionsPath":"/actions","nextStep":"live_html_or_api_probe"}'::jsonb),
    ('citilab', 'citilab_catalog_moskva_probe', 'probe_mock', array['https://citilab.ru/moskva/catalog/'], 'url_prefix', '{"catalogPath":"/moskva/catalog/","promotionsPath":"/moskva/actions/","nextStep":"live_html_or_api_probe"}'::jsonb)
) as config(provider_code, scraper_key, strategy, entry_urls, region_mode, config)
  on provider.code = config.provider_code
on conflict (provider_id, lab_region_id, scraper_key) do update
set
  strategy = excluded.strategy,
  entry_urls = excluded.entry_urls,
  region_mode = excluded.region_mode,
  config = excluded.config,
  updated_at = now();

with location_seed(provider_code, region_code, name, address, city, lat, lng, geo_hash, coverage_radius_km, pickup_type, source_url, raw_payload) as (
  values
    (
      'cmd',
      'msk',
      'CMD, Москва mock point',
      'Москва, Новогиреевская улица, 3А',
      'Москва',
      55.753930,
      37.816729,
      'ucfvf',
      5.00,
      'walk_in',
      'https://www.cmd-online.ru/',
      '{"seed":"provider_expansion_mock","note":"Replace with verified CMD branch address before production routing"}'::jsonb
    ),
    (
      'helix',
      'moskva',
      'Хеликс, Москва mock point',
      'Москва, Цветной бульвар, 11с6',
      'Москва',
      55.770807,
      37.620773,
      'ucfv1',
      5.00,
      'walk_in',
      'https://helix.ru/moskva',
      '{"seed":"provider_expansion_mock","note":"Replace with verified Helix branch address before production routing"}'::jsonb
    ),
    (
      'kdl',
      'msk',
      'KDL, Москва mock point',
      'Москва, Ленинградский проспект, 80к17',
      'Москва',
      55.807376,
      37.510534,
      'ucfvm',
      5.00,
      'walk_in',
      'https://kdl.ru/',
      '{"seed":"provider_expansion_mock","note":"Replace with verified KDL branch address before production routing"}'::jsonb
    ),
    (
      'citilab',
      'moskva',
      'СИТИЛАБ, Москва mock point',
      'Москва, Большая Серпуховская улица, 30с2',
      'Москва',
      55.723580,
      37.625851,
      'ucftz',
      5.00,
      'walk_in',
      'https://citilab.ru/moskva/',
      '{"seed":"provider_expansion_mock","note":"Replace with verified Citilab branch address before production routing"}'::jsonb
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
