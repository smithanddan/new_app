# LabMind Core — Product Specification

## 0. Working name
Working name: **LabMind**.
Alternative names can be tested later: LabWise, Анализатор, Мои Анализы, Биомаркер.

## 1. Product summary
LabMind is a service that collects laboratory results from PDF, images, Excel/HTML, and later email; converts them into a structured medical timeline; highlights deviations and trends; generates cautious AI explanations; and eventually compares lab prices for repeat tests.

## 2. Target users
### MVP users
- People who periodically take blood tests and keep PDFs in email or messengers.
- Families that want one place for multiple people’s lab histories.
- Users who are anxious about lab values and need clear, non-alarming explanations.

### Later B2B users
- Clinics and doctors who want patient-uploaded lab history.
- Insurance/wellness services.
- Labs or medical marketplaces.

## 3. Core hook
The first hook is:

> “Upload a lab report and get a clean table, highlighted deviations, a plain-language explanation, and next steps.”

The second hook is:

> “Connect email once and LabMind will build your lab history automatically.”

The third hook is:

> “When you need to repeat tests, LabMind shows where the same tests are cheaper and faster.”

## 4. MVP v1 scope
MVP v1 must include:
1. User registration/login.
2. Patient profile creation.
3. Upload PDF/image/Excel/HTML lab report.
4. Store raw document privately.
5. Parse document via MarkItDown first layer.
6. If parsing confidence is low, mark document as `needs_review`.
7. Extract lab results into structured JSON.
8. Normalize analytes and units.
9. Save results into Supabase.
10. Show results table.
11. Show flags: normal, low, high, unknown.
12. Generate AI report with medical guardrails.
13. Allow manual correction of parsed results.
14. Keep audit logs for document access and report generation.

## 5. MVP v1 out of scope
For the first MVP, do not implement yet:
- full Gmail OAuth;
- Yandex/Mail.ru IMAP;
- automatic forwarding inbox;
- mobile Expo app;
- lab price crawler;
- payments;
- doctor cabinet;
- FHIR integration;
- complex diagnosis inference.

These are planned for later phases.

## 6. MVP v2 scope: email import
MVP v2 adds:
1. Gmail read-only OAuth.
2. IMAP connection for Yandex/Mail.ru using app passwords.
3. Unique forwarding address per user.
4. Lab sender allowlist.
5. Email metadata storage.
6. Attachment extraction.
7. HTML email parsing.
8. User controls for disconnect/delete.

Email import must read only relevant messages from known lab domains and subject patterns.

## 7. MVP v3 scope: lab price crawler
MVP v3 adds:
1. Scrapling-based crawler package.
2. Provider adapters for selected labs.
3. Price snapshots.
4. Diff events.
5. Admin UI for crawler status.
6. User-facing comparison of repeat test prices.

Initial providers:
- Invitro
- Gemotest
- Helix
- KDL
- CMD

## 8. MVP v4 scope: mobile app
MVP v4 adds Expo mobile app:
- upload photo/PDF from phone;
- push notifications;
- report view;
- trends;
- family profiles;
- reminders to repeat tests.

## 9. User stories
### US-001: Upload lab report
As a user, I want to upload a PDF lab report so that LabMind extracts my results automatically.

Acceptance criteria:
- File upload supports PDF, JPG, PNG, XLSX, CSV, HTML.
- File is stored in private storage.
- Document status changes from `uploaded` to `processing`, then `parsed`, `needs_review`, or `failed`.
- User can see parser confidence.

### US-002: View results table
As a user, I want to see all extracted results in a clean table.

Acceptance criteria:
- Table shows date, lab, indicator, value, unit, reference range, flag.
- Unknown indicators are visible and marked.
- User can filter by date, category, flag, and document.

### US-003: Manual correction
As a user, I want to correct parser mistakes.

Acceptance criteria:
- User can edit raw name, value, unit, reference range, and matched analyte.
- Changes create audit log entries.
- Corrected result stores `corrected_by_user = true`.

### US-004: AI report
As a user, I want a plain-language explanation of my results.

Acceptance criteria:
- Report includes key deviations, trends if available, next steps, lifestyle notes if appropriate, and disclaimer.
- Report never diagnoses or prescribes.
- Report cites specific values and reference ranges.
- Report is stored with prompt version and model.

### US-005: Low confidence handling
As a user, I want uncertain parsing to be clearly marked.

Acceptance criteria:
- Document with low confidence goes to `needs_review`.
- User sees what needs review.
- AI report should not overinterpret low-confidence values.

### US-006: Family profiles
As a user, I want to keep results for several people.

Acceptance criteria:
- User can create multiple patient profiles.
- Each document belongs to one patient profile.
- Results and reports are scoped by patient profile.

## 10. Core data model
### patient_profiles
Stores user-owned patient profiles.

Fields:
- id
- user_id
- name
- sex
- birthdate
- created_at

### lab_providers
Known labs and email/domain hints.

Fields:
- id
- code
- name
- domains
- subject_patterns
- parser_hint
- created_at

### lab_documents
Raw uploaded/imported reports.

Fields:
- id
- user_id
- patient_profile_id
- provider_id
- source
- storage_path
- original_filename
- received_at
- taken_at
- status
- parse_confidence
- raw_text
- parsed_json
- parser_version
- created_at

### analytes
Canonical indicators.

Fields:
- id
- code
- name_ru
- name_en
- default_unit
- category

### analyte_aliases
Synonyms and lab-specific names.

Fields:
- id
- analyte_id
- alias
- lang
- provider_id

### units
Canonical units.

Fields:
- id
- code
- normalized_code
- dimension

### unit_conversions
Conversion rules.

Fields:
- id
- from_unit
- to_unit
- analyte_id nullable
- factor
- offset

### reference_ranges
Reference ranges by analyte, sex, and age.

Fields:
- id
- analyte_id
- sex
- age_min
- age_max
- unit
- low
- high
- source

### lab_results
Normalized results.

Fields:
- id
- user_id
- patient_profile_id
- document_id
- analyte_id nullable
- name_raw
- value_raw
- value_num
- unit_raw
- unit_normalized
- ref_raw
- ref_low
- ref_high
- flag
- confidence
- corrected_by_user
- created_at

### ai_reports
AI-generated explanations.

Fields:
- id
- user_id
- patient_profile_id
- document_id
- report_json
- report_text
- prompt_version
- model
- created_at

### lab_tests / lab_price_snapshots
Used later for price crawler.

### audit_logs
Security and traceability.

Fields:
- id
- user_id
- action
- entity_type
- entity_id
- payload
- created_at

## 11. Document parsing pipeline
### Step 1: Receive document
Input sources:
- manual upload;
- later: email attachment;
- later: HTML email;
- later: forwarded email.

### Step 2: Store raw file
Store in private storage bucket:
`lab-documents/{user_id}/{document_id}/{filename}`

### Step 3: Extract raw text/tables
Use MarkItDown first.

If MarkItDown output is insufficient:
- use OCR/Vision adapter;
- store `ocr_used = true`.

### Step 4: Extract structured JSON
Output schema:

```json
{
  "lab_name": "...",
  "taken_at": "YYYY-MM-DD",
  "panels": [
    {
      "name": "Биохимия",
      "items": [
        {
          "name_raw": "Глюкоза",
          "value_raw": "5,4",
          "unit_raw": "ммоль/л",
          "ref_raw": "3.9–6.1",
          "confidence": 0.93
        }
      ]
    }
  ]
}
```

### Step 5: Normalize
- match raw name to analyte alias;
- parse value;
- normalize unit;
- parse reference range;
- compare to reference;
- assign flag;
- save.

### Step 6: Review
If confidence < threshold:
- status `needs_review`;
- show UI review screen.

## 12. AI report rules
AI report must:
- be short enough for non-medical users;
- avoid diagnosis;
- explain only values that exist;
- mention if data is incomplete;
- use calm wording;
- recommend medical consultation when needed;
- include disclaimer.

Report JSON schema:

```json
{
  "summary": "string",
  "key_deviations": [
    {
      "title": "string",
      "value": "string",
      "reference": "string",
      "meaning": "string",
      "severity": "info|attention|important"
    }
  ],
  "trends": [
    {
      "analyte": "string",
      "direction": "up|down|stable|unknown",
      "comment": "string"
    }
  ],
  "next_steps": ["string"],
  "repeat_tests": ["string"],
  "specialists": ["string"],
  "lifestyle": ["string"],
  "disclaimer": "string"
}
```

## 13. UI screens
### 13.1 Onboarding
- Product promise.
- Privacy promise.
- Upload first report button.

### 13.2 Dashboard
- Last document status.
- Number of results imported.
- Key deviations.
- Recent AI report.
- CTA: upload another report / connect email later.

### 13.3 Upload screen
- File dropzone.
- Supported formats.
- Patient profile selection.
- Consent for external processing if OCR/AI provider is used.

### 13.4 Document detail
- Document metadata.
- Parsing status.
- Confidence.
- Extracted rows.
- Manual correction UI.

### 13.5 Results table
- Date.
- Lab.
- Analyte.
- Value.
- Unit.
- Reference.
- Flag.
- Source document.

### 13.6 AI report
- Summary.
- Deviations.
- Trends.
- Next steps.
- Disclaimer.

### 13.7 Profile/privacy
- Patient profiles.
- Delete data.
- Export data.
- Manage integrations later.

## 14. Security requirements
- Enable RLS on all user-owned tables.
- Use private storage bucket.
- Use signed URLs.
- Do not expose service role key to client.
- Audit document view/download/report generation.
- Encrypt external credentials later for email import.
- Separate parser worker permissions from user client permissions.
- Do not store secrets in logs.
- Validate uploaded file type and size.
- Limit parser execution time.
- Add rate limits.

## 15. Success metrics
MVP success metrics:
- file upload success rate;
- parse success rate;
- percent of rows matched to canonical analytes;
- average parser confidence;
- report generation success rate;
- user clicks “upload another report”;
- manual correction rate;
- retention after first report.

## 16. Initial analyte seed list
Initial canonical analytes:
- HGB: Гемоглобин
- RBC: Эритроциты
- WBC: Лейкоциты
- PLT: Тромбоциты
- ESR: СОЭ
- GLU: Глюкоза
- CHOL: Холестерин общий
- HDL: ЛПВП
- LDL: ЛПНП
- TG: Триглицериды
- ALT: АЛТ
- AST: АСТ
- BIL: Билирубин общий
- CRP: С-реактивный белок
- FERR: Ферритин
- FE: Железо
- B12: Витамин B12
- D25: Витамин D 25-OH
- TSH: ТТГ
- FT4: Т4 свободный
- FT3: Т3 свободный
- CREA: Креатинин
- UREA: Мочевина
- UA: Мочевая кислота
- HBA1C: Гликированный гемоглобин

## 17. Open questions
- Final product name.
- Initial target geography: РФ only or broader.
- Whether to store data in RU or EU cloud.
- Which external OCR/LLM providers are allowed.
- Whether to allow pet profiles later.
- Whether to support doctor sharing in MVP.
