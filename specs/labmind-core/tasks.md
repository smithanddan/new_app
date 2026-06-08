# LabMind Core — Task List

## Milestone 0 — Repository and workflow
- [ ] Create repository or monorepo.
- [ ] Add `/specs/labmind-core` folder.
- [ ] Add `constitution.md`, `spec.md`, `plan.md`, `tasks.md`.
- [ ] Add `.env.example`.
- [ ] Add `/docs/security-checklist.md`.
- [ ] Add linting and formatting.
- [ ] Add basic test setup.
- [ ] Configure Supabase project.
- [ ] Decide parser runtime: Supabase function vs separate Python/FastAPI service.

## Milestone 1 — Database schema
- [ ] Create migration for `patient_profiles`.
- [ ] Create migration for `lab_providers`.
- [ ] Create migration for `lab_documents`.
- [ ] Create migration for `analytes`.
- [ ] Create migration for `analyte_aliases`.
- [ ] Create migration for `units`.
- [ ] Create migration for `unit_conversions`.
- [ ] Create migration for `reference_ranges`.
- [ ] Create migration for `lab_results`.
- [ ] Create migration for `ai_reports`.
- [ ] Create migration for `audit_logs`.
- [ ] Enable RLS on all user-owned tables.
- [ ] Write RLS policies for each table.
- [ ] Create private storage bucket `lab-documents`.
- [ ] Write storage access policy.
- [ ] Add seed data for common analytes.
- [ ] Add seed data for aliases.
- [ ] Add seed data for units.
- [ ] Add initial lab providers.

## Milestone 2 — Auth and profile
- [ ] Implement login/register with Supabase Auth.
- [ ] Create default patient profile after registration.
- [ ] Build patient profile form.
- [ ] Support sex and birthdate fields.
- [ ] Add profile selector to app shell.
- [ ] Add privacy settings placeholder.

## Milestone 3 — File upload
- [ ] Build upload page.
- [ ] Add file dropzone.
- [ ] Validate file type.
- [ ] Validate max file size.
- [ ] Upload to private storage path.
- [ ] Create `lab_documents` row.
- [ ] Set status `uploaded`.
- [ ] Trigger parser pipeline.
- [ ] Show upload progress.
- [ ] Show document processing status.
- [ ] Add audit log for upload.

## Milestone 4 — Parser service
- [ ] Create `packages/document-parser`.
- [ ] Add MarkItDown adapter.
- [ ] Add parser input/output types.
- [ ] Add raw text extraction function.
- [ ] Store raw markdown/text in `lab_documents.raw_text`.
- [ ] Add structured extraction function.
- [ ] Define extracted JSON schema.
- [ ] Validate extracted JSON.
- [ ] Compute confidence score.
- [ ] Set document status `parsed`, `needs_review`, or `failed`.
- [ ] Add parser version field.
- [ ] Add error payload logging.
- [ ] Add sample fixture tests.

## Milestone 5 — Biomarker engine
- [ ] Create `packages/biomarker-engine`.
- [ ] Implement `normalizeString()`.
- [ ] Implement `matchAnalyte()` exact alias match.
- [ ] Implement `parseValue()`.
- [ ] Implement `parseReferenceRange()`.
- [ ] Implement `normalizeUnit()`.
- [ ] Implement `flagResult()`.
- [ ] Implement age calculation by taken_at date.
- [ ] Implement reference range lookup.
- [ ] Save normalized rows to `lab_results`.
- [ ] Save unknown rows with null analyte_id.
- [ ] Add confidence per result.
- [ ] Add unit tests.

## Milestone 6 — Results UI
- [ ] Build dashboard page.
- [ ] Build document list page.
- [ ] Build document detail page.
- [ ] Build results table.
- [ ] Add filters: date, flag, category, document.
- [ ] Add flag colors.
- [ ] Add unknown analyte indicator.
- [ ] Add confidence display.
- [ ] Add manual correction modal.
- [ ] Save correction to `lab_results`.
- [ ] Create audit log for correction.
- [ ] Recalculate flags after correction.

## Milestone 7 — AI report
- [ ] Create `packages/ai-report`.
- [ ] Create `lab_report_v1` system prompt.
- [ ] Define JSON schema.
- [ ] Implement report generator.
- [ ] Add report persistence to `ai_reports`.
- [ ] Add report generation button.
- [ ] Auto-generate after successful parse if confidence is acceptable.
- [ ] Show report page.
- [ ] Add disclaimer block.
- [ ] Add prompt version to stored report.
- [ ] Add model name to stored report.
- [ ] Add audit log for report generation.
- [ ] Add tests for schema validation.

## Milestone 8 — Security hardening
- [ ] Test RLS with two test users.
- [ ] Test private storage access.
- [ ] Ensure service role key is server-only.
- [ ] Add signed URL generation only after access check.
- [ ] Add upload rate limits.
- [ ] Add file size limits.
- [ ] Add consent checkbox for external AI/OCR processing.
- [ ] Add delete user data flow placeholder.
- [ ] Add export data flow placeholder.
- [ ] Review logs for accidental PHI/medical data leakage.
- [ ] Run automated security review if available.

## Milestone 9 — Email import v2
- [ ] Create `email_connections` table.
- [ ] Create `email_imports` table.
- [ ] Add lab sender allowlist.
- [ ] Implement forwarding address concept.
- [ ] Implement Gmail OAuth read-only flow.
- [ ] Implement IMAP connection with encrypted credentials.
- [ ] Build email import settings page.
- [ ] Parse email HTML body.
- [ ] Extract attachments.
- [ ] Queue attachments into parser pipeline.
- [ ] Add disconnect integration flow.
- [ ] Add delete imported data flow.

## Milestone 10 — Lab price crawler v3
- [ ] Create `packages/lab-crawlers`.
- [ ] Create `lab_tests` table.
- [ ] Create `lab_test_aliases` table.
- [ ] Create `lab_price_snapshots` table.
- [ ] Create `crawler_runs` table.
- [ ] Create `crawler_errors` table.
- [ ] Define `LabCrawlerAdapter` interface.
- [ ] Implement mock adapter.
- [ ] Implement one real provider adapter.
- [ ] Add rate limiting.
- [ ] Add robots.txt/terms check note.
- [ ] Add scheduler.
- [ ] Add diff logic.
- [ ] Add admin crawler UI.
- [ ] Add user-facing price comparison later.

## Milestone 11 — Mobile app v4
- [ ] Create Expo app.
- [ ] Add Supabase Auth.
- [ ] Add upload from phone.
- [ ] Add dashboard.
- [ ] Add results table/mobile cards.
- [ ] Add report screen.
- [ ] Add push notifications.
- [ ] Add family profiles.
- [ ] Add privacy settings.

## Definition of Done for MVP v1
- [ ] A new user can register.
- [ ] A new user can create/select patient profile.
- [ ] A user can upload a lab report PDF.
- [ ] The file is stored privately.
- [ ] The parser extracts at least basic rows from a fixture/report.
- [ ] Results are normalized and stored.
- [ ] Results table is visible.
- [ ] Unknown rows are preserved.
- [ ] User can correct a row manually.
- [ ] AI report is generated with disclaimer.
- [ ] RLS prevents cross-user access.
- [ ] Audit logs exist for upload, correction, and report generation.
