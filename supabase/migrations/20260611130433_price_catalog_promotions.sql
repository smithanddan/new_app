-- Add a canonical test catalog and richer price offer snapshots.

create table if not exists public.test_catalog_items (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ru text not null,
  name_en text,
  kind text not null default 'analyte' check (kind in ('analyte','panel','profile','service')),
  analyte_id uuid references public.analytes(id) on delete set null,
  category text,
  created_at timestamptz default now()
);

create table if not exists public.test_catalog_aliases (
  id uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.test_catalog_items(id) on delete cascade,
  provider_id uuid references public.lab_providers(id) on delete set null,
  alias text not null,
  lang text,
  created_at timestamptz default now(),
  unique (catalog_item_id, provider_id, alias)
);

alter table public.lab_tests
  add column if not exists catalog_item_id uuid references public.test_catalog_items(id) on delete set null,
  add column if not exists kind text check (kind in ('analyte','panel','profile','service') or kind is null);

alter table public.lab_price_snapshots
  add column if not exists region_code text,
  add column if not exists regular_price numeric,
  add column if not exists promo_price numeric,
  add column if not exists effective_price numeric,
  add column if not exists offer_type text default 'regular' check (offer_type in ('regular','promo','cashback','package','unknown')),
  add column if not exists promotion_title text,
  add column if not exists promotion_url text,
  add column if not exists valid_from date,
  add column if not exists valid_to date;

update public.lab_price_snapshots
set
  regular_price = coalesce(regular_price, price),
  effective_price = coalesce(effective_price, price)
where price is not null;

create index if not exists idx_test_catalog_items_code on public.test_catalog_items(code);
create index if not exists idx_test_catalog_aliases_alias on public.test_catalog_aliases(alias);
create index if not exists idx_lab_tests_catalog_item on public.lab_tests(catalog_item_id);
create index if not exists idx_lab_price_snapshots_offer_region on public.lab_price_snapshots(region_code, city, offer_type, checked_at desc);
create index if not exists idx_lab_price_snapshots_valid_to on public.lab_price_snapshots(valid_to);

alter table public.test_catalog_items enable row level security;
alter table public.test_catalog_aliases enable row level security;

create policy "dictionary_read_test_catalog_items"
on public.test_catalog_items
for select
to authenticated
using (true);

create policy "dictionary_read_test_catalog_aliases"
on public.test_catalog_aliases
for select
to authenticated
using (true);

grant select on
  public.test_catalog_items,
  public.test_catalog_aliases
to authenticated;

insert into public.test_catalog_items (code, name_ru, name_en, kind, analyte_id, category)
select code, name_ru, name_en, 'analyte', id, category
from public.analytes
on conflict (code) do update
set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  analyte_id = excluded.analyte_id,
  category = excluded.category;

insert into public.test_catalog_aliases (catalog_item_id, provider_id, alias, lang)
select catalog.id, aliases.provider_id, aliases.alias, aliases.lang
from public.analyte_aliases aliases
join public.analytes analytes on analytes.id = aliases.analyte_id
join public.test_catalog_items catalog on catalog.code = analytes.code
on conflict (catalog_item_id, provider_id, alias) do nothing;
