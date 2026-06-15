# Geo Intelligence

Geo Intelligence is the LabPrice OS layer that answers the next product question after price:

```text
Where is it cheaper and closer to submit these tests?
```

## v1: Manual Coordinates

Geo v1 deliberately avoids external map APIs. It adds the data model and product logic first:

- `lab_locations` stores provider locations and pickup points.
- Moscow has a small seed set of manual/mock DNKOM and Gemotest locations.
- User location is passed per request with `lat` and `lng`.
- Distance is calculated with Haversine in `GeoService`.
- Compare and basket results can show:
  - nearest location;
  - distance in kilometers;
  - pickup type;
  - geo score.

Price remains the primary sorting criterion. Distance is displayed as decision context and is used as a tie-breaker unless the request explicitly passes `sort=distance`.

Example:

```bash
/compare?test=Ферритин&city=Москва&lat=55.75&lng=37.62
/basket?tests=Глюкоза,ТТГ&city=Москва&lat=55.75&lng=37.62
```

API examples:

```bash
/api/v1/compare?test=Ферритин&city=Москва&lat=55.75&lng=37.62
/api/v1/basket-optimize?tests=Глюкоза,ТТГ&city=Москва&lat=55.75&lng=37.62
```

## v2: Geocoding

Geo v2 should replace manual coordinates with batch geocoding:

- collect provider branch addresses;
- geocode `address -> lat/lng`;
- store source URL and raw payload for traceability;
- keep manual override support for bad geocoding results.

Yandex, Google, 2GIS, or another provider can be added behind a `GeoProvider` interface. The core pricing and basket engine must not depend directly on a maps SDK.

## v3: Distance Matrix and Travel Time

Geo v3 can add real routing:

- walking / public transit / car travel time;
- distance matrix for user location to provider locations;
- route-aware basket optimization;
- district-level market analysis.

At that point, basket scoring can evolve from:

```text
price first + distance hint
```

to:

```text
final_score = price_weight + distance_weight + availability_weight
```

## Architecture Rule

Maps providers are adapters, not the core:

```text
Pricing Graph
  -> GeoService
      -> MockGeoProvider (v1)
      -> YandexGeoProvider (future)
  -> Basket Optimizer
```

Scrapers collect market data. Geo providers enrich physical location data. Product functions combine both into user-facing decisions.
