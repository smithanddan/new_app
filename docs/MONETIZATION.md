# Monetization Architecture

LabPrice OS monetization starts with lightweight tracking and read-only APIs. The goal of v1 is to package the existing decision engine into commercial surfaces without adding billing, subscriptions, or provider-specific affiliate contracts yet.

## Product Lines

### B2C Service

User promise: find where it is cheaper and simpler to submit lab tests.

Current public flows:
- `/search` — search one analysis or enter a basket.
- `/compare` — compare offers for one canonical test.
- `/basket` — optimize a basket across single-provider and split-provider routes.
- `/checkout` — tracking redirect before sending the user to the provider source URL.

Revenue model for later:
- affiliate click or booked order with providers;
- lead generation for clinics and check-up flows;
- premium consumer features such as price history and saved baskets.

### B2B API

API promise: pricing intelligence as a service.

Current skeleton endpoints:
- `GET /api/v1/compare?test=Ферритин&city=Москва`
- `GET /api/v1/basket-optimize?tests=Глюкоза,ТТГ,Ферритин&city=Москва`
- `GET /api/v1/market-stats?test=Ферритин&city=Москва`
- `GET /api/v1/cheapest?test=Ферритин&city=Москва`

Commercial packaging for later:
- tiered monthly plans;
- usage-based API billing;
- white-label comparison and basket optimization.

### B2B Dashboard

Dashboard promise: competitor price monitoring for laboratories, clinics, and medical networks.

Current internal/read-only surfaces:
- `/dashboard` — coverage and quality report.
- `/compare` — decision table and market summary.
- `/basket` — optimization view.
- `/match` — matching control plane.
- `/runs` — scraper observability.

Enterprise features for later:
- price trend charts;
- regional comparisons;
- promo monitoring;
- alerts for price changes and competitor campaigns.

## Tracking v1

`monetization_events` records commercial signals:
- `affiliate_click`
- `basket_checkout`
- `lead_request`
- `api_request`

The table is written only server-side with the Supabase service role. No public Supabase client key is used for event inserts.

Tracked fields include provider, canonical test, provider test, source URL, target URL, UTM fields, session id, city, and sanitized raw payload.

## API Key Gate

`LABPRICE_API_KEYS` is a comma-separated list.

If it is set, API requests must include:

```http
x-api-key: your-key
```

If it is not set, the API stays open for local/dev validation. Production should set the variable in the hosting environment.

## Intentionally Deferred

Not included in v1:
- Stripe or billing.
- Subscription plans.
- Usage limits or metering enforcement.
- Provider-specific affiliate integrations.
- Public auth.
- Separate B2C app package.

The first monetization wedge is deliberately small: public search, checkout tracking, and API packaging on top of the existing pricing engine.
