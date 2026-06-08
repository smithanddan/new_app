# Security checklist

- [ ] RLS enabled for user-owned tables.
- [ ] Private storage bucket for raw medical documents.
- [ ] Signed URLs only.
- [ ] No service role key in frontend.
- [ ] No raw medical documents sent to external OCR/LLM without consent flag.
- [ ] Audit log for document view/download/report generation.
- [ ] Gmail scope is read-only and filtered by lab domains.
- [ ] IMAP credentials encrypted.
- [ ] Parser handles malicious PDFs/HTML safely.
- [ ] AI report cannot produce diagnosis/treatment instructions.
- [ ] Crawler respects rate limits and legal boundaries.
