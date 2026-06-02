# Architecture

Главный принцип: система должна быть не парсером одного сайта, а повторяемым конвейером.

```text
source -> pages -> scrape_run -> raw_snapshot -> extracted_offer -> canonical_item -> price_snapshot -> alert
```

## Admin

Next.js CRM для источников, страниц, запусков, извлечённых предложений, нормализованных объектов и алертов.

## Worker

Отдельный процесс, который берёт enabled sources, обходит source_pages, сохраняет raw snapshots, извлекает offers и пишет price snapshots.

## Database

Supabase/Postgres хранит историю, аналитику, матчинги и будущие tenant/project связи.

## Matching

MVP: manual matching, normalized name, simple fuzzy similarity.

Позже: embeddings, LLM-assisted matching, справочники по доменам.

## Notifications

MVP: alerts table.

Позже: Telegram, email, webhook, daily digest.
