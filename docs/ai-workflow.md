# AI-assisted workflow

1. Work from `/specs/labmind-core`.
2. No implementation without `spec.md`, `plan.md`, `tasks.md`.
3. Use CodeGraph before editing existing architecture.
4. Use security review for auth, RLS, storage, email ingest, webhooks, AI/OCR calls.
5. After each change, output:
   - files changed
   - migrations added
   - tests needed
   - risks

## First prompt

Use `specs/labmind-core/cursor_master_prompt.md`.
