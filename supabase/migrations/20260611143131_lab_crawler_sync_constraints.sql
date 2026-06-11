-- Support append-only crawler sync writes and deterministic upserts.

alter table public.lab_promotion_items
  add column if not exists provider_test_code text;

create unique index if not exists provider_tests_provider_external_code_uidx
  on public.provider_tests(provider_id, external_code)
  where external_code is not null;

create unique index if not exists provider_tests_provider_name_source_uidx
  on public.provider_tests(provider_id, normalized_name, source_url)
  where external_code is null and normalized_name is not null and source_url is not null;

create unique index if not exists lab_promotions_provider_region_identity_uidx
  on public.lab_promotions(
    provider_id,
    coalesce(lab_region_id, '00000000-0000-0000-0000-000000000000'::uuid),
    title,
    coalesce(starts_on, '0001-01-01'::date),
    coalesce(ends_on, '0001-01-01'::date),
    coalesce(source_url, '')
  );

create unique index if not exists lab_promotion_items_promotion_provider_code_uidx
  on public.lab_promotion_items(promotion_id, provider_test_code)
  where provider_test_code is not null;
