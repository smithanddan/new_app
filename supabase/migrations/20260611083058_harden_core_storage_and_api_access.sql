-- Harden the LabMind MVP core for Supabase Storage and the Data API.

alter table public.lab_documents
  add column if not exists parser_version text,
  add column if not exists parse_error jsonb,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint;

alter table public.lab_documents
  drop constraint if exists lab_documents_status_check;

alter table public.lab_documents
  add constraint lab_documents_status_check
  check (status in ('uploaded','received','queued','processing','parsed','needs_review','failed','confirmed'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lab-documents',
  'lab-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/html'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "lab_documents_storage_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lab-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "lab_documents_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lab-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "lab_documents_storage_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lab-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'lab-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "lab_documents_storage_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lab-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.patient_profiles to authenticated;
grant select, insert, update, delete on public.lab_documents to authenticated;
grant select, insert, update, delete on public.lab_results to authenticated;
grant select, insert, delete on public.ai_reports to authenticated;
grant select, insert on public.audit_logs to authenticated;

grant select on
  public.lab_providers,
  public.analytes,
  public.analyte_aliases,
  public.units,
  public.unit_conversions,
  public.reference_ranges,
  public.lab_tests,
  public.lab_price_snapshots
to authenticated;
