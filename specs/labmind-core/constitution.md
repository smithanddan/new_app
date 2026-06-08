# LabMind Core — Constitution

## 1. Product principle
LabMind is a personal medical data cabinet for laboratory results. It imports lab reports from files and email, normalizes them into a single longitudinal table, explains deviations, and helps users decide what to discuss with a doctor or when to repeat tests.

The product must optimize for trust, clarity, privacy, and repeat usage. The first user hook is: upload or import a lab report and immediately receive a clean table, highlighted deviations, and a cautious AI explanation.

## 2. Medical safety principle
LabMind does not diagnose, prescribe treatment, cancel medication, or replace a clinician. AI output is informational and must include a visible disclaimer.

Allowed wording:
- “This may be worth discussing with a doctor.”
- “Consider repeating the test.”
- “This result is outside the provided reference range.”
- “If you have symptoms or the value is markedly abnormal, seek medical care.”

Forbidden wording:
- “You have disease X.”
- “Start taking medicine Y.”
- “Stop taking medicine Y.”
- “This is safe, ignore it.”

## 3. Privacy principle
Laboratory results are sensitive personal data. The system must default to least privilege, private storage, tenant isolation, RLS, audit logs, explicit consent for external processing, and user-controlled deletion.

Raw medical documents must never be publicly accessible. All file access must go through signed URLs or server-mediated access checks.

## 4. Data quality principle
The product must preserve raw data and confidence scores. It must never silently overwrite uncertain parsed results. If confidence is low, the document must go to manual review.

Every parsed result should retain:
- raw name
- raw value
- raw unit
- raw reference
- normalized analyte, if matched
- confidence
- parser version
- source document

## 5. Architecture principle
The MVP should be simple enough to ship quickly but structured enough to grow into email import, mobile app, crawler-based lab price comparison, and family profiles.

Preferred stack:
- Next.js PWA for MVP web
- Supabase Auth, Postgres, Storage, RLS
- Edge Functions or workers for parsing/report generation
- MarkItDown as first parsing layer
- OCR/Vision fallback through adapter interface
- Scrapling for public lab price crawlers
- Expo mobile later

## 6. Development principle
No large feature should be implemented without a spec, plan, and task list.

For every feature:
1. Write spec.md.
2. Write plan.md.
3. Write tasks.md.
4. Review data model, security, and UX.
5. Implement in small steps.
6. Add tests.
7. Run security review for auth, storage, RLS, webhooks, and external integrations.

## 7. Commercial principle
The first MVP must prove the hook:
- user uploads/imports results;
- system extracts indicators;
- system shows understandable analysis;
- user sees value within minutes.

Price comparison and mobile apps are important, but they come after the core parsing and interpretation loop works reliably.
