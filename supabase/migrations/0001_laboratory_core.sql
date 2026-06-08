-- LabMind MVP core schema
-- Apply in Supabase SQL editor or via `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  sex text check (sex in ('male', 'female') or sex is null),
  birthdate date,
  created_at timestamptz default now()
);

create table if not exists public.lab_providers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  domains text[] default '{}',
  subject_patterns text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists public.lab_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_profile_id uuid references public.patient_profiles(id) on delete set null,
  provider_id uuid references public.lab_providers(id) on delete set null,
  source text not null check (source in ('upload','gmail','imap','forward','manual')),
  storage_path text,
  original_filename text,
  received_at timestamptz,
  taken_at date,
  status text not null default 'uploaded' check (status in ('uploaded','received','queued','parsed','needs_review','failed','confirmed')),
  parse_confidence numeric,
  raw_text text,
  parsed_json jsonb,
  created_at timestamptz default now()
);

create table if not exists public.analytes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ru text not null,
  name_en text,
  default_unit text,
  category text,
  created_at timestamptz default now()
);

create table if not exists public.analyte_aliases (
  id uuid primary key default gen_random_uuid(),
  analyte_id uuid not null references public.analytes(id) on delete cascade,
  alias text not null,
  lang text,
  provider_id uuid references public.lab_providers(id) on delete set null,
  unique (analyte_id, alias, provider_id)
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  canonical_code text not null,
  created_at timestamptz default now()
);

create table if not exists public.unit_conversions (
  id uuid primary key default gen_random_uuid(),
  analyte_id uuid references public.analytes(id) on delete cascade,
  from_unit text not null,
  to_unit text not null,
  multiplier numeric not null default 1,
  offset numeric not null default 0,
  created_at timestamptz default now(),
  unique (analyte_id, from_unit, to_unit)
);

create table if not exists public.reference_ranges (
  id uuid primary key default gen_random_uuid(),
  analyte_id uuid not null references public.analytes(id) on delete cascade,
  sex text check (sex in ('male', 'female') or sex is null),
  age_min int,
  age_max int,
  unit text,
  low numeric,
  high numeric,
  source text,
  created_at timestamptz default now()
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_profile_id uuid references public.patient_profiles(id) on delete set null,
  document_id uuid references public.lab_documents(id) on delete cascade,
  analyte_id uuid references public.analytes(id) on delete set null,
  name_raw text,
  value_raw text,
  value_num numeric,
  unit_raw text,
  unit_normalized text,
  ref_raw text,
  ref_low numeric,
  ref_high numeric,
  flag text default 'unknown' check (flag in ('low','normal','high','unknown')),
  confidence numeric,
  confirmed_by_user boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_profile_id uuid references public.patient_profiles(id) on delete set null,
  document_id uuid references public.lab_documents(id) on delete cascade,
  report_json jsonb,
  report_text text,
  prompt_version text,
  model text,
  created_at timestamptz default now()
);

create table if not exists public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.lab_providers(id) on delete cascade,
  external_test_id text,
  name text not null,
  code text,
  category text,
  source_url text,
  created_at timestamptz default now(),
  unique (provider_id, external_test_id)
);

create table if not exists public.lab_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  lab_test_id uuid references public.lab_tests(id) on delete cascade,
  city text,
  price numeric,
  currency text default 'RUB',
  turnaround_time text,
  biomaterial text,
  preparation text,
  checked_at timestamptz default now(),
  raw_json jsonb
);

create table if not exists public.crawler_runs (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null,
  status text not null default 'started' check (status in ('started','success','partial','failed')),
  started_at timestamptz default now(),
  finished_at timestamptz,
  stats jsonb,
  error text
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_patient_profiles_user on public.patient_profiles(user_id);
create index if not exists idx_lab_documents_user_created on public.lab_documents(user_id, created_at desc);
create index if not exists idx_lab_results_user_created on public.lab_results(user_id, created_at desc);
create index if not exists idx_lab_results_document on public.lab_results(document_id);
create index if not exists idx_lab_results_analyte on public.lab_results(analyte_id);
create index if not exists idx_lab_price_snapshots_test_checked on public.lab_price_snapshots(lab_test_id, checked_at desc);

alter table public.patient_profiles enable row level security;
alter table public.lab_documents enable row level security;
alter table public.lab_results enable row level security;
alter table public.ai_reports enable row level security;
alter table public.audit_logs enable row level security;

-- Public read dictionaries. If needed, restrict later.
alter table public.lab_providers enable row level security;
alter table public.analytes enable row level security;
alter table public.analyte_aliases enable row level security;
alter table public.units enable row level security;
alter table public.unit_conversions enable row level security;
alter table public.reference_ranges enable row level security;
alter table public.lab_tests enable row level security;
alter table public.lab_price_snapshots enable row level security;
alter table public.crawler_runs enable row level security;

create policy "profiles_select_own" on public.patient_profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.patient_profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.patient_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.patient_profiles for delete using (auth.uid() = user_id);

create policy "documents_select_own" on public.lab_documents for select using (auth.uid() = user_id);
create policy "documents_insert_own" on public.lab_documents for insert with check (auth.uid() = user_id);
create policy "documents_update_own" on public.lab_documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "documents_delete_own" on public.lab_documents for delete using (auth.uid() = user_id);

create policy "results_select_own" on public.lab_results for select using (auth.uid() = user_id);
create policy "results_insert_own" on public.lab_results for insert with check (auth.uid() = user_id);
create policy "results_update_own" on public.lab_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "results_delete_own" on public.lab_results for delete using (auth.uid() = user_id);

create policy "reports_select_own" on public.ai_reports for select using (auth.uid() = user_id);
create policy "reports_insert_own" on public.ai_reports for insert with check (auth.uid() = user_id);
create policy "reports_delete_own" on public.ai_reports for delete using (auth.uid() = user_id);

create policy "audit_select_own" on public.audit_logs for select using (auth.uid() = user_id);
create policy "audit_insert_own" on public.audit_logs for insert with check (auth.uid() = user_id or auth.uid() is null);

create policy "dictionary_read_lab_providers" on public.lab_providers for select to authenticated using (true);
create policy "dictionary_read_analytes" on public.analytes for select to authenticated using (true);
create policy "dictionary_read_aliases" on public.analyte_aliases for select to authenticated using (true);
create policy "dictionary_read_units" on public.units for select to authenticated using (true);
create policy "dictionary_read_unit_conversions" on public.unit_conversions for select to authenticated using (true);
create policy "dictionary_read_reference_ranges" on public.reference_ranges for select to authenticated using (true);
create policy "dictionary_read_lab_tests" on public.lab_tests for select to authenticated using (true);
create policy "dictionary_read_price_snapshots" on public.lab_price_snapshots for select to authenticated using (true);

insert into public.lab_providers (code, name, domains, subject_patterns) values
  ('invitro', 'ИНВИТРО', array['invitro.ru'], array['результаты','исследований']),
  ('gemotest', 'Гемотест', array['gemotest.ru'], array['результаты','готовы']),
  ('helix', 'Хеликс', array['helix.ru'], array['результаты']),
  ('kdl', 'KDL', array['kdl.ru'], array['результаты']),
  ('cmd', 'CMD', array['cmd-online.ru'], array['результаты'])
on conflict (code) do nothing;

insert into public.units (code, canonical_code) values
  ('ммоль/л', 'mmol/L'), ('mmol/L', 'mmol/L'), ('мг/дл', 'mg/dL'), ('mg/dL', 'mg/dL'),
  ('г/л', 'g/L'), ('g/L', 'g/L'), ('Ед/л', 'U/L'), ('U/L', 'U/L'),
  ('мМЕ/л', 'mIU/L'), ('mIU/L', 'mIU/L')
on conflict (code) do nothing;

insert into public.analytes (code, name_ru, name_en, default_unit, category) values
  ('GLU', 'Глюкоза', 'Glucose', 'mmol/L', 'biochemistry'),
  ('HGB', 'Гемоглобин', 'Hemoglobin', 'g/L', 'cbc'),
  ('ALT', 'АЛТ', 'ALT', 'U/L', 'liver'),
  ('AST', 'АСТ', 'AST', 'U/L', 'liver'),
  ('TSH', 'ТТГ', 'TSH', 'mIU/L', 'thyroid'),
  ('HDL', 'ЛПВП', 'HDL', 'mmol/L', 'lipids'),
  ('LDL', 'ЛПНП', 'LDL', 'mmol/L', 'lipids'),
  ('TG', 'Триглицериды', 'Triglycerides', 'mmol/L', 'lipids'),
  ('CHOL', 'Холестерин общий', 'Total cholesterol', 'mmol/L', 'lipids'),
  ('FER', 'Ферритин', 'Ferritin', 'ng/mL', 'iron')
on conflict (code) do nothing;

insert into public.analyte_aliases (analyte_id, alias, lang)
select id, alias, 'ru'
from public.analytes a,
lateral unnest(case a.code
  when 'GLU' then array['Глюкоза','Glucose','GLU']
  when 'HGB' then array['Гемоглобин','Hemoglobin','Hb','HGB']
  when 'ALT' then array['АЛТ','ALT','Аланинаминотрансфераза']
  when 'AST' then array['АСТ','AST','Аспартатаминотрансфераза']
  when 'TSH' then array['ТТГ','TSH','Тиреотропный гормон']
  when 'HDL' then array['ЛПВП','HDL','Холестерин ЛПВП']
  when 'LDL' then array['ЛПНП','LDL','Холестерин ЛПНП']
  when 'TG' then array['Триглицериды','Triglycerides','TG']
  when 'CHOL' then array['Холестерин общий','Общий холестерин','Cholesterol total','CHOL']
  when 'FER' then array['Ферритин','Ferritin','FER']
  else array[]::text[]
end) as alias
on conflict do nothing;
