# LabMind Starter Repo

Персональный медицинский дата-кабинет: импорт результатов анализов из PDF/фото/почты, нормализация в единую таблицу, AI-отчёты и crawler цен лабораторий.

## Что внутри

```txt
apps/web                  Next.js PWA skeleton
packages/document-parser  MarkItDown/OCR pipeline interfaces
packages/biomarker-engine Нормализация показателей, единиц, референсов
packages/ai-report        Guardrails и JSON schema AI-отчётов
packages/lab-crawlers     Scrapling adapter skeleton
packages/shared           Shared types
supabase/migrations       MVP schema + RLS
supabase/functions        Edge Function stubs
specs/labmind-core        Spec Kit файлы
```

## Быстрый старт

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Первый порядок работы в Cursor / Claude / Codex

1. Открой `specs/labmind-core/cursor_master_prompt.md`.
2. Вставь его первым сообщением агенту.
3. Попроси начать с `tasks.md` → Milestone 0–1.
4. Не проси писать код до проверки `spec.md` и `plan.md`.

## MVP v1

- upload PDF/JPG/XLSX/HTML;
- private storage bucket;
- parse via MarkItDown first;
- OCR fallback interface;
- normalize analytes and units;
- results table;
- AI report without diagnosis;
- manual correction flow;
- RLS + audit logs.
