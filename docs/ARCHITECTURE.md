# LabPrice OS Architecture

LabPrice OS is a decision engine for healthcare pricing. The system is no longer just a scraper or ETL pipeline: it collects the lab market, normalizes provider-specific tests into a canonical model, builds a pricing graph, and helps a user decide where and how to submit a basket of medical tests.

```text
[ Providers ]
      |
[ Data Ingestion Layer ]
      |
[ Normalization Layer ]
      |
[ Pricing Graph Layer ]
      |
[ Geo Intelligence Layer ]
      |
[ Optimization Engine ]
      |
[ Market Intelligence Layer ]
      |
[ Product Layer (CLI / UI / API) ]
      |
[ User Decision ]
```

## 1. Data Ingestion Layer

Goal: collect the market as-is, without over-normalizing early.

Current components:
- `CrawlerRunner` is the single execution entrypoint for provider syncs.
- `ProviderAdapter` wraps provider-specific crawlers.
- DNKOM and Gemotest are active provider adapters.
- INVITRO is a future adapter; current work is limited to safe probe and anti-bot mapping.
- Transport layer records whether a provider run uses `http`, `playwright`, or a hybrid approach.

Output tables:
- `provider_tests`
- `provider_test_prices`
- `lab_promotions`
- `lab_promotion_items`
- `scraper_runs`
- `scraper_run_items`

This layer represents the raw market.

## 2. Normalization Layer

Goal: turn provider-specific catalog entries into a shared medical taxonomy.

Core model:
- `canonical_tests` is the internal canonical test catalog.
- `provider_tests` stores provider names, codes, raw payloads, source URLs, and match state.
- Matching connects `provider_tests` to `canonical_tests`.

Current matching tools:
- `match:db` for automatic and candidate matching.
- `match:manual` for explicit manual overrides.

Rules:
- Manual match always wins.
- Confidence scoring is stored with the match result.
- Provider entries are classified as `analysis`, `panel`, `complex`, or `unknown`.
- Complexes and panels must not be auto-matched to a single analysis.

This layer represents market understanding.

## 3. Pricing Graph Layer

Goal: model the available ways to buy each canonical test.

Conceptual graph:

```text
Test
  -> Provider option
      -> test price
      -> promo price
      -> biomaterial fee
      -> source URL
      -> fetched_at
```

The graph edge weight is the total cost of a provider option. For single-test comparison this is:

```text
effective_price_rub + biomaterial_price_rub
```

For basket optimization, biomaterial fees are deduplicated once per selected provider route.

This layer is the core bridge between normalized data and optimization.

## 4. Geo Intelligence Layer

Goal: add the physical-world context needed to answer "cheapest and closest", not only "cheapest".

Current v1 model:
- `lab_locations` stores provider branch/pickup points, city, address, latitude, longitude, pickup type, source URL, and raw payload.
- User location is not stored; it is passed per request via `lat` and `lng`.
- `GeoService` is pure TypeScript and uses Haversine distance.
- Yandex Maps is intentionally not a core dependency. Future Yandex geocoding or distance matrix support must be implemented as a `GeoProvider` adapter.

Product behavior:
- `/compare` and `/basket` can receive `lat` and `lng`.
- Offers can include nearest provider location, distance in kilometers, pickup type, and geo score.
- Price remains the primary ranking by default; distance is displayed and can be used for `sort=distance`.

This layer brings the real world into the pricing graph.

## 5. Optimization Engine

Goal: answer the practical question: where should a person submit a basket of tests?

Input example:

```text
["Глюкоза", "ТТГ", "Ферритин"]
```

Current strategy:
- Option A: one provider that can cover all requested tests.
- Option B: split providers, choosing the cheapest provider option per test.
- Biomaterial fees are deduplicated per provider.
- Route penalty accounts for the inconvenience of visiting multiple providers.

Main CLI:

```bash
pnpm --filter @labmind/lab-crawlers cheapest:basket -- --tests "Глюкоза,ТТГ,Ферритин" --city "Москва"
```

This layer turns price comparison into an optimization problem.

## 6. Market Intelligence Layer

Goal: explain the market around a test, not only show one price.

Main CLI:

```bash
pnpm --filter @labmind/lab-crawlers compare:market -- --test "Ферритин" --city "Москва"
```

Outputs:
- minimum price;
- maximum price;
- average price;
- median price;
- provider distribution;
- promo ratio;
- price spread;
- cheapest and most expensive provider options.

This layer answers: where is the market cheap, expensive, promotional, or fragmented?

## 7. Product Layer

Goal: make the system usable by humans, not only by scripts.

CLI:
- `crawler:run` runs provider ingestion through the orchestration layer.
- `compare:matrix` shows readable price comparison tables.
- `cheapest:basket` calculates optimized basket routes.
- `compare:market` shows market analytics.
- `match:db` proposes automatic and candidate matches.
- `match:manual` performs explicit manual matching.
- `invitro:probe` safely inspects INVITRO without ingestion.

Admin UI:
- `/compare` is the decision table for one analysis.
- `/basket` is the basket optimization view.
- `/match` is the matching control plane.
- `/runs` shows scraper run history.
- `/dashboard` summarizes market coverage and quality.

This layer is the product surface.

## 8. Observability Layer

Goal: preserve system memory and make pipeline quality visible.

Current data:
- `scraper_runs` stores run-level status and counters.
- `scraper_run_items` stores item-level metadata, statuses, messages, and sanitized payloads.
- Price snapshots are append-only through `provider_test_prices`.
- Match state and confidence are stored on `provider_tests`.

Rules:
- Ingestion and explicit manual matching are the only write paths.
- Product and analytics layers are read-only.
- HTML bodies and PII must not be stored in run logs.

This layer is the system brain.

## 9. Future Providers Layer

INVITRO is intentionally staged:
- probe first;
- map catalog structure, promo structure, region behavior, and anti-bot level;
- build fixture parser before ingestion;
- add adapter only after access strategy is stable.

The same pattern should be used for every new provider: probe, fixture, adapter, write sync, matching, product validation.

## Product Principle

LabPrice OS is not a scraper system and not only an ETL pipeline.

It is a medical price intelligence engine: a system that optimizes where and how a person can submit medical tests for the best practical cost.
