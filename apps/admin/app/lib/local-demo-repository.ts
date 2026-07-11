import "server-only";

import {
  compareLocalMarket,
  loadLocalMarketDataset,
  type LocalMarketDataset,
  type LocalOffer,
} from "@labmind/lab-crawlers/src/local-market";
import { DEFAULT_CANONICAL_TESTS } from "@labmind/lab-crawlers/src/catalog-comparison";
import type { LabLocation } from "@labmind/lab-crawlers/src/geo-service";
import { normalizeProviderName } from "@labmind/lab-crawlers/src/provider-scraper";
import type {
  DbCanonicalPriceComparison,
  DbMarketQualityStats,
  DbPriceComparisonOffer,
  DbProviderCandidate,
  DbProviderDiscoveryQuery,
  DbProviderDiscoveryRun,
  DbProviderTestMatchResult,
  DbProviderTestMatchStatusItem,
  DbProviderTestMatchQueueItem,
  DbScraperRunListItem,
  MonetizationEventInput,
} from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";

const PROVIDERS = {
  dnkom: { id: "demo-provider-dnkom", code: "dnkom", name: "DNKOM" },
  gemotest: { id: "demo-provider-gemotest", code: "gemotest", name: "Гемотест" },
  invitro: { id: "demo-provider-invitro", code: "invitro", name: "INVITRO" },
  cmd: { id: "demo-provider-cmd", code: "cmd", name: "CMD" },
} as const;

const REGIONS = {
  dnkom: { id: "demo-region-dnkom-moscow", code: "moscow", name: "Москва", city: "Москва" },
  gemotest: { id: "demo-region-gemotest-moskva", code: "moskva", name: "Москва", city: "Москва" },
  invitro: { id: "demo-region-invitro-moscow", code: "moscow", name: "Москва", city: "Москва" },
  cmd: { id: "demo-region-cmd-msk", code: "msk", name: "Москва", city: "Москва" },
} as const;

let cachedDataset: LocalMarketDataset | undefined;

export class LocalDemoRepository {
  private readonly dataset: LocalMarketDataset;

  constructor() {
    cachedDataset ??= loadLocalMarketDataset({ city: "Москва", includeFixtures: true });
    this.dataset = cachedDataset;
  }

  async findCanonicalTestBySearch(testSearch: string): Promise<DbCanonicalPriceComparison["canonical_test"] | undefined> {
    const normalized = normalizeProviderName(testSearch);
    const canonical = DEFAULT_CANONICAL_TESTS.find((test) => {
      const values = [test.id, test.code, test.nameRu, test.nameEn ?? "", ...test.aliases];
      return values.some((value) => normalizeProviderName(value) === normalized);
    });

    return canonical ? mapCanonical(canonical) : undefined;
  }

  async listCanonicalTests(): Promise<Array<DbCanonicalPriceComparison["canonical_test"]>> {
    return DEFAULT_CANONICAL_TESTS.map(mapCanonical);
  }

  async compareCanonicalTestPricesFromDb(canonicalTestId: string, cityName: string): Promise<DbCanonicalPriceComparison> {
    const canonical = DEFAULT_CANONICAL_TESTS.find((test) => test.id === canonicalTestId || test.code === canonicalTestId);
    const comparison = compareLocalMarket({
      dataset: this.dataset,
      test: canonical?.nameRu ?? canonicalTestId,
      canonicalTests: DEFAULT_CANONICAL_TESTS,
    });

    const canonicalTest = comparison.canonicalTest ?? canonical ?? DEFAULT_CANONICAL_TESTS[0];
    const offers = comparison.offers.map(mapOffer);

    return {
      canonical_test: mapCanonical(canonicalTest),
      city: cityName,
      offers,
      unmatched_provider_tests: comparison.unmatched.slice(0, 30).map((test, index) => ({
        provider: getProvider(test.providerCode),
        provider_test_id: buildProviderTestId(test.providerCode, test.externalCode, test.sourceUrl, index),
        provider_test_name: test.name,
        provider_test_code: test.externalCode,
        source_url: test.sourceUrl,
        match_reason: "local_demo_unmatched",
      })),
      auto_match_suggestion: offers.length > 0 ? undefined : "Local demo dataset has no matched offers for this canonical test.",
    };
  }

  async listLabLocations(input: { city?: string; providerIds?: string[] } = {}): Promise<LabLocation[]> {
    return DEMO_LOCATIONS
      .filter((location) => !input.city || location.city === input.city)
      .filter((location) => !input.providerIds?.length || input.providerIds.includes(location.provider_id));
  }

  async getMarketQualityStats(): Promise<DbMarketQualityStats> {
    const matched = this.dataset.tests.filter((test) => test.canonicalCode).length;
    return {
      providers_count: Object.keys(PROVIDERS).length,
      canonical_tests_count: DEFAULT_CANONICAL_TESTS.length,
      provider_tests_count: this.dataset.tests.length,
      provider_tests_matched_count: matched,
      provider_tests_unmatched_count: this.dataset.tests.length - matched,
      provider_test_prices_count: this.dataset.prices.length,
      promotions_count: this.dataset.promotions.length,
      promotion_items_count: this.dataset.promotionItems.length,
      scraper_runs_count: this.dataset.snapshots.length,
      match_status_counts: {
        auto_matched: matched,
        unmatched: this.dataset.tests.length - matched,
      },
    };
  }

  async listProviderTestsForMatchQueue(input: { providerCode: string; limit?: number }): Promise<DbProviderTestMatchQueueItem[]> {
    return this.dataset.tests
      .filter((test) => test.providerCode === input.providerCode && !test.canonicalCode)
      .slice(0, input.limit ?? 100)
      .map((test, index) => ({
        provider: getProvider(test.providerCode),
        provider_test_id: buildProviderTestId(test.providerCode, test.externalCode, test.sourceUrl, index),
        provider_test_name: test.name,
        provider_test_code: test.externalCode,
        source_url: test.sourceUrl,
      }));
  }

  async autoMatchProviderTestsFromDb(input: { providerCode: string; cityName?: string; write?: boolean; limit?: number }): Promise<DbProviderTestMatchResult> {
    return {
      provider: input.providerCode,
      city: input.cityName,
      mode: input.write ? "write" : "dry-run",
      candidates: [],
      blocked_candidates: [],
      matched_count: 0,
      blocked_count: 0,
      updated_count: 0,
    };
  }

  async listMatchedProviderTests(input: { providerCode: string; limit?: number }): Promise<DbProviderTestMatchStatusItem[]> {
    return this.dataset.tests
      .filter((test) => test.providerCode === input.providerCode && test.canonicalCode)
      .slice(0, input.limit ?? 50)
      .map((test, index) => {
        const canonical = DEFAULT_CANONICAL_TESTS.find((item) => item.code === test.canonicalCode);
        return {
          provider: getProvider(test.providerCode),
          provider_test_id: buildProviderTestId(test.providerCode, test.externalCode, test.sourceUrl, index),
          provider_test_name: test.name,
          provider_test_code: test.externalCode,
          source_url: test.sourceUrl,
          match_status: test.matchStatus === "manual_matched" ? "manual_matched" : "auto_matched",
          match_confidence: test.matchConfidence ?? 0.9,
          matched_at: test.fetchedAt,
          canonical_test: canonical ? {
            id: canonical.id,
            code: canonical.code,
            name_ru: canonical.nameRu,
          } : undefined,
        };
      });
  }

  async listScraperRuns(): Promise<DbScraperRunListItem[]> {
    return this.dataset.snapshots.map((snapshot, index) => ({
      id: `demo-run-${snapshot.provider}-${index}`,
      provider: {
        code: snapshot.provider,
        name: getProvider(snapshot.provider).name,
        display_name: getProvider(snapshot.provider).name,
      },
      region: {
        code: snapshot.region,
        name: snapshot.city,
        city: snapshot.city,
      },
      run_type: "local_fixture",
      run_source: "ci",
      status: "completed",
      started_at: snapshot.fetchedAt,
      finished_at: snapshot.fetchedAt,
      stats: {
        tests: snapshot.tests.length,
        prices: snapshot.prices.length,
        promotions: snapshot.promotions.length,
        promotion_items: snapshot.promotionItems.length,
      },
      error: null,
    }));
  }

  async listProviderCandidates(input: { city?: string; status?: string; source?: string; limit?: number } = {}): Promise<DbProviderCandidate[]> {
    return DEMO_DISCOVERY_CANDIDATES
      .filter((candidate) => !input.city || candidate.city === input.city)
      .filter((candidate) => !input.status || candidate.status === input.status)
      .filter((candidate) => !input.source || candidate.source_type === input.source)
      .slice(0, input.limit ?? 100);
  }

  async listProviderDiscoveryRuns(limit = 50): Promise<DbProviderDiscoveryRun[]> {
    return DEMO_DISCOVERY_RUNS.slice(0, limit);
  }

  async listProviderDiscoveryQueries(input: { city?: string; enabled?: boolean; limit?: number } = {}): Promise<DbProviderDiscoveryQuery[]> {
    return DEMO_DISCOVERY_QUERIES
      .filter((query) => !input.city || query.city === input.city)
      .filter((query) => input.enabled === undefined || query.enabled === input.enabled)
      .slice(0, input.limit ?? 100);
  }

  async logMonetizationEvent(input: MonetizationEventInput): Promise<void> {
    console.info("local demo monetization event", {
      eventType: input.eventType,
      providerCode: input.providerCode,
      city: input.city,
      utmSource: input.utmSource,
      utmCampaign: input.utmCampaign,
    });
  }
}

function mapCanonical(test: typeof DEFAULT_CANONICAL_TESTS[number]): DbCanonicalPriceComparison["canonical_test"] {
  return {
    id: test.id,
    code: test.code,
    name_ru: test.nameRu,
    name_en: test.nameEn,
    aliases: test.aliases,
  };
}

function mapOffer(offer: LocalOffer): DbPriceComparisonOffer {
  const provider = getProvider(offer.providerCode);
  return {
    provider,
    region: getRegion(offer.providerCode),
    provider_test_id: buildProviderTestId(offer.providerCode, offer.providerTestCode, offer.sourceUrl),
    provider_test_name: offer.providerTestName,
    provider_test_code: offer.providerTestCode,
    offer_type: offer.offerType === "promo" ? "promo" : "regular",
    offer_source: "provider_test_prices",
    regular_price_rub: offer.regularPriceRub,
    promo_price_rub: offer.promoPriceRub,
    effective_price_rub: offer.effectivePriceRub,
    biomaterial_price_rub: offer.biomaterialPriceRub,
    total_price_rub: offer.totalPriceRub,
    source_url: offer.sourceUrl,
    fetched_at: offer.fetchedAt,
  };
}

function getProvider(providerCode: string): DbPriceComparisonOffer["provider"] {
  return PROVIDERS[providerCode as keyof typeof PROVIDERS] ?? {
    id: `demo-provider-${providerCode}`,
    code: providerCode,
    name: providerCode,
  };
}

function getRegion(providerCode: string): DbPriceComparisonOffer["region"] {
  return REGIONS[providerCode as keyof typeof REGIONS] ?? {
    id: `demo-region-${providerCode}`,
    code: "moscow",
    name: "Москва",
    city: "Москва",
  };
}

function buildProviderTestId(providerCode: string, code: string | undefined, sourceUrl: string | undefined, index = 0): string {
  return [
    "demo",
    providerCode,
    code || normalizeProviderName(sourceUrl || String(index)).slice(0, 32) || index,
  ].join("-");
}

const DEMO_LOCATIONS: LabLocation[] = [
  {
    id: "demo-location-dnkom-center",
    provider_id: PROVIDERS.dnkom.id,
    lab_region_id: REGIONS.dnkom.id,
    name: "ДНКОМ, центр Москвы",
    address: "Москва, Тверская улица, 18",
    city: "Москва",
    lat: 55.765347,
    lng: 37.60509,
    geo_hash: "ucfv0",
    coverage_radius_km: 5,
    pickup_type: "walk_in",
    source_url: "https://dnkom.ru/",
    raw_payload: { seed: "local_demo" },
  },
  {
    id: "demo-location-dnkom-southwest",
    provider_id: PROVIDERS.dnkom.id,
    lab_region_id: REGIONS.dnkom.id,
    name: "ДНКОМ, юго-запад",
    address: "Москва, Ленинский проспект, 68/10",
    city: "Москва",
    lat: 55.689815,
    lng: 37.542687,
    geo_hash: "ucftf",
    coverage_radius_km: 5,
    pickup_type: "walk_in",
    source_url: "https://dnkom.ru/",
    raw_payload: { seed: "local_demo" },
  },
  {
    id: "demo-location-gemotest-center",
    provider_id: PROVIDERS.gemotest.id,
    lab_region_id: REGIONS.gemotest.id,
    name: "Гемотест, центр Москвы",
    address: "Москва, Мясницкая улица, 24/7с1",
    city: "Москва",
    lat: 55.764341,
    lng: 37.635951,
    geo_hash: "ucfv1",
    coverage_radius_km: 5,
    pickup_type: "walk_in",
    source_url: "https://gemotest.ru/moskva/",
    raw_payload: { seed: "local_demo" },
  },
  {
    id: "demo-location-gemotest-west",
    provider_id: PROVIDERS.gemotest.id,
    lab_region_id: REGIONS.gemotest.id,
    name: "Гемотест, запад",
    address: "Москва, Кутузовский проспект, 30",
    city: "Москва",
    lat: 55.742059,
    lng: 37.532092,
    geo_hash: "ucftv",
    coverage_radius_km: 5,
    pickup_type: "walk_in",
    source_url: "https://gemotest.ru/moskva/",
    raw_payload: { seed: "local_demo" },
  },
  {
    id: "demo-location-invitro-center",
    provider_id: PROVIDERS.invitro.id,
    lab_region_id: REGIONS.invitro.id,
    name: "INVITRO, центр Москвы",
    address: "Москва, улица Арбат, 20",
    city: "Москва",
    lat: 55.751597,
    lng: 37.592945,
    geo_hash: "ucftz",
    coverage_radius_km: 5,
    pickup_type: "walk_in",
    source_url: "https://www.invitro.ru/moscow/",
    raw_payload: { seed: "local_demo" },
  },
  {
    id: "demo-location-invitro-north",
    provider_id: PROVIDERS.invitro.id,
    lab_region_id: REGIONS.invitro.id,
    name: "INVITRO, север",
    address: "Москва, Ленинградский проспект, 74",
    city: "Москва",
    lat: 55.805369,
    lng: 37.516644,
    geo_hash: "ucfvm",
    coverage_radius_km: 5,
    pickup_type: "walk_in",
    source_url: "https://www.invitro.ru/moscow/",
    raw_payload: { seed: "local_demo" },
  },
];

const DEMO_DISCOVERY_QUERIES: DbProviderDiscoveryQuery[] = [
  {
    id: "demo-discovery-query-moscow-labs",
    query: "лаборатория анализов",
    city: "Москва",
    source: "manual",
    vertical: "lab_tests",
    priority: 10,
    enabled: true,
    last_run_at: null,
    raw_payload: { seed: "local_demo" },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "demo-discovery-query-dolgoprudny-labs",
    query: "лаборатория анализов Долгопрудный",
    city: "Долгопрудный",
    source: "manual",
    vertical: "lab_tests",
    priority: 10,
    enabled: true,
    last_run_at: null,
    raw_payload: { seed: "local_demo" },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

const DEMO_DISCOVERY_CANDIDATES: DbProviderCandidate[] = [
  {
    id: "demo-provider-candidate-cmd",
    name: "CMD",
    normalized_name: "cmd",
    website_url: "https://www.cmd-online.ru/",
    domain: "cmd-online.ru",
    phone: "+7 495 788-00-01",
    address: "Москва",
    city: "Москва",
    source_type: "manual_seed",
    confidence: 0.96,
    status: "duplicate",
    matched_provider_id: PROVIDERS.cmd.id,
    duplicate_of_candidate_id: null,
    raw_payload: {
      duplicate_hint: "known provider domain: cmd-online.ru",
      suggested_action: "duplicate",
    },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    matched_provider: {
      id: PROVIDERS.cmd.id,
      code: PROVIDERS.cmd.code,
      name: PROVIDERS.cmd.name,
      display_name: PROVIDERS.cmd.name,
    },
  },
  {
    id: "demo-provider-candidate-nixor",
    name: "Никсор Клиник",
    normalized_name: "никсор клиник",
    website_url: "https://nixorclinic.ru/",
    domain: "nixorclinic.ru",
    phone: null,
    address: "Долгопрудный",
    city: "Долгопрудный",
    source_type: "manual_seed",
    confidence: 0.78,
    status: "needs_review",
    matched_provider_id: null,
    duplicate_of_candidate_id: null,
    raw_payload: {
      suggested_action: "review",
    },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

const DEMO_DISCOVERY_RUNS: DbProviderDiscoveryRun[] = [
  {
    id: "demo-discovery-run-1",
    query_id: DEMO_DISCOVERY_QUERIES[0].id,
    city: "Москва",
    source: "manual",
    status: "completed",
    run_source: "ci",
    started_at: new Date(0).toISOString(),
    finished_at: new Date(0).toISOString(),
    stats: {
      candidates: 1,
      duplicates: 1,
      needs_review: 0,
    },
    error: null,
    raw_payload: { seed: "local_demo" },
    query: {
      id: DEMO_DISCOVERY_QUERIES[0].id,
      query: DEMO_DISCOVERY_QUERIES[0].query,
      source: DEMO_DISCOVERY_QUERIES[0].source,
      city: DEMO_DISCOVERY_QUERIES[0].city,
    },
  },
];
