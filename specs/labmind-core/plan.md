# LabMind Core — Implementation Plan

## 1. Development strategy
Implement the product in small vertical slices. The first vertical slice is:

**Upload PDF → parse → normalize → save → show table → generate AI report.**

Do not start with Gmail, mobile app, or lab price crawler. These depend on the core parser and biomarker engine.

## 2. Recommended repository structure

```txt
apps/
  web/                       # Next.js PWA
  admin/                     # optional admin later
  mobile/                    # Expo later

packages/
  document-parser/            # MarkItDown adapter + extraction
  biomarker-engine/           # analyte matching, unit parsing, flags
  ai-report/                  # report prompts, schema, guardrails
  lab-crawlers/               # Scrapling later
  shared/                     # types, validation schemas

supabase/
  migrations/
  functions/
    parse-document/
    normalize-results/
    generate-report/
    run-lab-crawler/          # later

specs/
  labmind-core/
    constitution.md
    spec.md
    plan.md
    tasks.md
```

If the repo is created as a single Next.js app first, keep `packages/*` inside the monorepo from day one to avoid rewriting later.

## 3. Technology choices
### Frontend
- Next.js PWA for MVP.
- Tailwind/shadcn or similar component system.
- React Hook Form for correction screens.

### Backend
- Supabase Auth.
- Supabase Postgres.
- Supabase Storage private bucket.
- Supabase Edge Functions or Node worker for parsing.

### Parser
- MarkItDown as first extraction layer.
- OCR adapter interface for fallback.
- LLM extraction only after raw text/table extraction.

### AI report
- One prompt versioned as `lab_report_v1`.
- Strict JSON schema.
- Store prompt version and model.

### Future crawler
- Scrapling adapters per lab.
- Rate-limited scheduled worker.
- Snapshots and diffs.

## 4. Phase 0 — Project setup
### Goals
- Create repository structure.
- Configure Supabase.
- Configure lint/test.
- Add security checklist.

### Deliverables
- Next.js app.
- Supabase project.
- `.env.example`.
- `/specs/labmind-core` files.
- `/docs/security-checklist.md`.

## 5. Phase 1 — Database and storage
### Goals
Create minimal DB for patient profiles, documents, results, analytes, aliases, units, reports, and audit logs.

### Migrations
Tables:
- patient_profiles
- lab_providers
- lab_documents
- analytes
- analyte_aliases
- units
- unit_conversions
- reference_ranges
- lab_results
- ai_reports
- audit_logs

Storage:
- private bucket: `lab-documents`

RLS:
- user can select/insert/update own patient profiles;
- user can select own documents/results/reports;
- user cannot access another user’s files;
- service role/worker can process documents server-side.

### Seed data
Seed initial:
- common analytes;
- aliases in Russian/English;
- units;
- provider placeholders.

## 6. Phase 2 — Upload flow
### Goals
Allow users to upload lab reports.

### Backend/API
- `POST /api/documents/upload` or Supabase upload from signed policy.
- Create `lab_documents` record.
- Store file.
- Set status `uploaded` then `processing`.

### UI
- Upload screen.
- Patient profile selector.
- Upload progress.
- Status card.

### Validation
- allowed MIME types;
- max file size;
- extension checks;
- antivirus later if needed.

## 7. Phase 3 — Parser pipeline
### Goals
Extract raw text/tables from uploaded document.

### Components
- `packages/document-parser/src/markitdown.ts`
- `packages/document-parser/src/extract-lab-json.ts`
- `packages/document-parser/src/confidence.ts`
- `supabase/functions/parse-document`

### Flow
1. Load document from private storage.
2. Convert through MarkItDown.
3. Store raw text in `lab_documents.raw_text`.
4. Extract structured JSON.
5. Store in `lab_documents.parsed_json`.
6. Compute confidence.
7. Set status `parsed`, `needs_review`, or `failed`.

### Failure handling
- if MarkItDown fails, use fallback OCR adapter if configured;
- if both fail, set status `failed` with error payload;
- do not delete raw file.

## 8. Phase 4 — Biomarker normalization
### Goals
Convert raw extracted rows into canonical lab results.

### Components
- `packages/biomarker-engine/src/match-analyte.ts`
- `packages/biomarker-engine/src/parse-value.ts`
- `packages/biomarker-engine/src/parse-reference.ts`
- `packages/biomarker-engine/src/normalize-unit.ts`
- `packages/biomarker-engine/src/flag-result.ts`

### Flow
For each extracted row:
1. Normalize raw name.
2. Match to analyte_aliases.
3. Parse numeric value.
4. Normalize unit.
5. Parse reference range.
6. If reference missing, search `reference_ranges` by patient sex/age.
7. Assign flag.
8. Store `lab_results`.

### Matching logic v1
- case-insensitive exact alias match;
- trim spaces;
- normalize ё/е;
- remove extra punctuation;
- fallback to unknown analyte candidate.

### Matching logic v2 later
- fuzzy matching;
- provider-specific aliases;
- LLM-assisted candidate suggestion.

## 9. Phase 5 — Results UI
### Goals
Show extracted results clearly.

### Screens
- Dashboard.
- Document detail.
- Results table.
- Result correction modal.

### Table columns
- date;
- lab;
- indicator;
- value;
- unit;
- reference;
- flag;
- confidence;
- source document.

### Manual correction
- User can edit raw row.
- User can select canonical analyte.
- Save correction as audit event.
- Re-run flag calculation.

## 10. Phase 6 — AI report
### Goals
Generate a cautious report.

### Components
- `packages/ai-report/src/prompt.ts`
- `packages/ai-report/src/schema.ts`
- `packages/ai-report/src/generate.ts`
- `supabase/functions/generate-report`

### Prompt version
`lab_report_v1`

### Report sections
- summary;
- key deviations;
- trends;
- next steps;
- repeat tests;
- specialists;
- lifestyle;
- disclaimer.

### Guardrails
- no diagnosis;
- no prescriptions;
- no medication changes;
- no panic;
- if critical values, recommend urgent medical care;
- if confidence low, mention limitation.

## 11. Phase 7 — Email import later
### Components
- Gmail OAuth.
- IMAP encrypted credentials.
- Forwarding inbound email.
- Known lab sender allowlist.
- Email metadata table.

### First implementation path
Start with forwarding because it requires the least user OAuth complexity.

## 12. Phase 8 — Lab price crawler later
### Components
- `packages/lab-crawlers`.
- Scrapling adapter interface.
- provider adapters.
- snapshots.
- diff events.
- admin UI.

### First implementation path
Start with mock adapter and one provider.

## 13. Security plan
### Required checks before launch
- RLS enabled and tested.
- Private storage tested.
- Service role not exposed client-side.
- File upload validation.
- Signed URL access check.
- Audit logs for document read/report generation.
- AI/OCR consent text.
- Delete/export data flow.

### Security-sensitive areas
- storage bucket policies;
- parser worker permissions;
- AI provider payloads;
- email OAuth and IMAP later;
- crawler rate limits and legal constraints later.

## 14. Testing plan
### Unit tests
- parse value;
- parse reference range;
- normalize unit;
- match analyte;
- flag result;
- report schema validation.

### Integration tests
- upload document;
- create lab_document;
- parse sample text;
- create lab_results;
- generate report.

### RLS tests
- user A cannot access user B documents;
- user A cannot access user B results;
- signed URL requires authorization.

### Parser fixtures
Create fixtures:
- simple text table;
- PDF converted to markdown sample;
- Russian comma decimals;
- missing unit;
- missing reference;
- unknown analyte;
- multi-panel report.

## 15. Deployment plan
### MVP hosting
- Vercel for Next.js.
- Supabase for DB/storage/functions.
- Worker can be Supabase Edge Function or a small Node/Python service depending on MarkItDown runtime requirements.

### Important runtime note
MarkItDown is Python-based. If Supabase Edge Functions cannot run it comfortably, use a separate parser service:
- small FastAPI service;
- Docker deployment;
- called from Supabase/Next backend;
- returns raw markdown and structured JSON.

## 16. Open technical decisions
1. Should parser service be Python/FastAPI from day one?
2. Which OCR provider should be the fallback?
3. Which LLM provider is allowed for medical text?
4. Where should data be hosted for the first market?
5. Do we start with PWA only or create Expo app immediately after Phase 1?
