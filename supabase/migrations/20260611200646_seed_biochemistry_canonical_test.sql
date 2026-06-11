insert into public.canonical_tests (code, name_ru, name_en, kind, category, aliases)
values (
  'BIOCHEM',
  'Биохимия крови',
  'Blood biochemistry',
  'profile',
  'biochemistry',
  array[
    'биохимия крови',
    'биохимия базовая',
    'биохимический анализ крови',
    'базовая биохимия',
    'blood biochemistry'
  ]
)
on conflict (code) do update
set
  name_ru = excluded.name_ru,
  name_en = excluded.name_en,
  kind = excluded.kind,
  category = excluded.category,
  aliases = excluded.aliases,
  updated_at = now();
