import "server-only";

import {
  getBasket,
  getBasketOptimization,
  getCompareMatrix,
  getQualityReport,
  parseTestList,
  type BasketMode,
} from "@labmind/lab-crawlers/src/product-layer";
import type { GeoPoint } from "@labmind/lab-crawlers/src/geo-service";
import { createLabCrawlerSupabaseClient } from "@labmind/lab-crawlers/src/supabase-client";
import {
  LabCatalogRepository,
  type DbProviderCandidate,
  type DbProviderDiscoveryQuery,
  type DbProviderDiscoveryRun,
  type DbLabSearchResult,
  type DbLabSearchSuggestion,
} from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";
import { normalizeProviderName } from "@labmind/lab-crawlers/src/provider-scraper";
import { LocalDemoRepository } from "./local-demo-repository";

export const DEFAULT_CITY = "Москва";
export type LabDataSource = "supabase" | "local_demo";

export function getRepository(): LabCatalogRepository {
  if (shouldUseLocalDemo()) {
    return new LocalDemoRepository() as unknown as LabCatalogRepository;
  }

  return new LabCatalogRepository(createLabCrawlerSupabaseClient());
}

export function getLabDataSource(): LabDataSource {
  return shouldUseLocalDemo() ? "local_demo" : "supabase";
}

export async function getComparePageData(input: {
  test?: string;
  city?: string;
  lat?: string;
  lng?: string;
  sort?: string;
}) {
  const city = input.city || DEFAULT_CITY;
  const userLocation = parseGeoPoint(input);

  return withLocalFallback(() => getCompareMatrix({
    repository: getRepository(),
    city,
    test: input.test || "Глюкоза",
    userLocation,
    sort: input.sort === "distance" ? "distance" : "price",
  }), () => getCompareMatrix({
    repository: new LocalDemoRepository() as unknown as LabCatalogRepository,
    city,
    test: input.test || "Глюкоза",
    userLocation,
    sort: input.sort === "distance" ? "distance" : "price",
  }));
}

export async function getBasketPageData(input: {
  tests?: string;
  city?: string;
  mode?: string;
  lat?: string;
  lng?: string;
  sort?: string;
}) {
  const city = input.city || DEFAULT_CITY;
  const tests = parseTestList(input.tests || "Глюкоза,ТТГ,Ферритин");
  const userLocation = parseGeoPoint(input);

  if (!input.mode || input.mode === "optimization") {
    return withLocalFallback(() => getBasketOptimization({
      repository: getRepository(),
      city,
      tests,
      userLocation,
      sort: input.sort === "distance" ? "distance" : "price",
    }), () => getBasketOptimization({
      repository: new LocalDemoRepository() as unknown as LabCatalogRepository,
      city,
      tests,
      userLocation,
      sort: input.sort === "distance" ? "distance" : "price",
    }));
  }

  const mode: BasketMode = input.mode === "single-provider" ? "single-provider" : "per-test";

  return withLocalFallback(() => getBasket({
    repository: getRepository(),
    city,
    tests,
    mode,
    userLocation,
    sort: input.sort === "distance" ? "distance" : "price",
  }), () => getBasket({
    repository: new LocalDemoRepository() as unknown as LabCatalogRepository,
    city,
    tests,
    mode,
    userLocation,
    sort: input.sort === "distance" ? "distance" : "price",
  }));
}

export async function getLabSearchPageData(input: {
  q?: string;
  city?: string;
  limit?: string;
}): Promise<DbLabSearchResult> {
  const query = input.q || "";
  const city = input.city || DEFAULT_CITY;
  const requestedLimit = Number(input.limit || 8);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(25, requestedLimit)) : 8;

  return withLocalFallback(
    () => getRepository().searchLabTestsFromDb({ query, cityName: city, limit }),
    () => getLocalLabSearchPageData({ query, city, limit }),
  );
}

export async function getMatchPageData(input: { provider?: string; city?: string; limit?: string }) {
  const repository = getRepository();
  const provider = input.provider || "dnkom";
  const city = input.city || DEFAULT_CITY;
  const limit = Number(input.limit || 100);
  const load = async (repository: LabCatalogRepository) => Promise.all([
    repository.listProviderTestsForMatchQueue({ providerCode: provider, cityName: city, limit }),
    repository.autoMatchProviderTestsFromDb({ providerCode: provider, cityName: city, limit }),
    repository.listMatchedProviderTests({ providerCode: provider, cityName: city, limit: Math.min(limit, 50) }),
  ]);
  const [queue, candidates, matched] = await withLocalFallback(
    () => load(getRepository()),
    () => load(new LocalDemoRepository() as unknown as LabCatalogRepository),
  );

  return {
    provider,
    city,
    queue,
    candidates,
    matched,
  };
}

export async function getRunsPageData(input: { limit?: string }) {
  return withLocalFallback(
    () => getRepository().listScraperRuns(Number(input.limit || 50)),
    () => (new LocalDemoRepository() as unknown as LabCatalogRepository).listScraperRuns(Number(input.limit || 50)),
  );
}

export async function getDiscoveryProvidersPageData(input: {
  city?: string;
  status?: string;
  source?: string;
  limit?: string;
}): Promise<{
  city?: string;
  status?: string;
  source?: string;
  candidates: DbProviderCandidate[];
}> {
  const city = input.city || undefined;
  const status = input.status || undefined;
  const source = input.source || undefined;
  const limit = Number(input.limit || 100);
  const load = (repository: LabCatalogRepository) => repository.listProviderCandidates({
    city,
    status,
    source,
    limit: Number.isFinite(limit) ? limit : 100,
  });

  return {
    city,
    status,
    source,
    candidates: await withLocalFallback(
      () => load(getRepository()),
      () => load(new LocalDemoRepository() as unknown as LabCatalogRepository),
    ),
  };
}

export async function getDiscoveryRunsPageData(input: { limit?: string }): Promise<{
  runs: DbProviderDiscoveryRun[];
}> {
  const limit = Number(input.limit || 50);
  const load = (repository: LabCatalogRepository) => repository.listProviderDiscoveryRuns(Number.isFinite(limit) ? limit : 50);

  return {
    runs: await withLocalFallback(
      () => load(getRepository()),
      () => load(new LocalDemoRepository() as unknown as LabCatalogRepository),
    ),
  };
}

export async function getDiscoveryQueriesPageData(input: {
  city?: string;
  enabled?: string;
  limit?: string;
}): Promise<{
  city?: string;
  enabled?: boolean;
  queries: DbProviderDiscoveryQuery[];
}> {
  const city = input.city || undefined;
  const enabled = input.enabled === "true" ? true : input.enabled === "false" ? false : undefined;
  const limit = Number(input.limit || 100);
  const load = (repository: LabCatalogRepository) => repository.listProviderDiscoveryQueries({
    city,
    enabled,
    limit: Number.isFinite(limit) ? limit : 100,
  });

  return {
    city,
    enabled,
    queries: await withLocalFallback(
      () => load(getRepository()),
      () => load(new LocalDemoRepository() as unknown as LabCatalogRepository),
    ),
  };
}

export async function getDashboardPageData(input: { city?: string }) {
  const city = input.city || DEFAULT_CITY;
  const load = async (repository: LabCatalogRepository) => Promise.all([
    getQualityReport({ repository, city }),
    repository.listScraperRuns(5),
  ]);
  const [report, runs] = await withLocalFallback(
    () => load(getRepository()),
    () => load(new LocalDemoRepository() as unknown as LabCatalogRepository),
  );

  return {
    report,
    runs,
  };
}

async function getLocalLabSearchPageData(input: {
  query: string;
  city: string;
  limit: number;
}): Promise<DbLabSearchResult> {
  const repository = new LocalDemoRepository() as unknown as LabCatalogRepository;
  const query = input.query.trim();
  if (!query) {
    return {
      query: input.query,
      city: input.city,
      resolved_test: null,
      suggestions: [],
      offers: [],
      cheapest: null,
      source_status: "empty_query",
    };
  }

  const canonical = await repository.findCanonicalTestBySearch(query);
  const suggestions = await getLocalLabSearchSuggestions(repository, query, input.limit);
  if (!canonical) {
    return {
      query,
      city: input.city,
      resolved_test: null,
      suggestions,
      offers: [],
      cheapest: null,
      source_status: suggestions.length > 0 ? "suggestions_only" : "not_found",
    };
  }

  const comparison = await repository.compareCanonicalTestPricesFromDb(canonical.id, input.city);
  const offers = comparison.offers.slice(0, input.limit);
  return {
    query,
    city: input.city,
    resolved_test: comparison.canonical_test,
    suggestions: dedupeLocalSuggestions([
      { canonical_test: comparison.canonical_test, match_reason: "exact_canonical" },
      ...suggestions,
    ]).slice(0, input.limit),
    offers,
    cheapest: offers[0] ?? null,
    source_status: "resolved",
  };
}

async function getLocalLabSearchSuggestions(
  repository: LabCatalogRepository,
  query: string,
  limit: number,
): Promise<DbLabSearchSuggestion[]> {
  const normalizedQuery = normalizeProviderName(query);
  const canonicalTests = await repository.listCanonicalTests();
  return canonicalTests
    .filter((canonical) => {
      const values = [canonical.code, canonical.name_ru, canonical.name_en ?? "", ...(canonical.aliases ?? [])];
      return values.some((value) => {
        const normalizedValue = normalizeProviderName(value);
        return normalizedValue.includes(normalizedQuery) || normalizedQuery.includes(normalizedValue);
      });
    })
    .slice(0, limit)
    .map((canonical) => ({
      canonical_test: canonical,
      match_reason: "text_suggestion",
    }));
}

function dedupeLocalSuggestions(values: DbLabSearchSuggestion[]): DbLabSearchSuggestion[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.canonical_test.id || value.canonical_test.code;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function shouldUseLocalDemo(): boolean {
  const configured = process.env.LABPRICE_DATA_SOURCE;
  if (configured === "local") {
    return true;
  }
  if (configured === "supabase") {
    return false;
  }

  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function withLocalFallback<T>(loadSupabase: () => Promise<T>, loadLocal: () => Promise<T>): Promise<T> {
  if (shouldUseLocalDemo()) {
    return loadLocal();
  }

  try {
    return await loadSupabase();
  } catch (error) {
    if (process.env.LABPRICE_DATA_SOURCE === "supabase") {
      throw error;
    }
    console.warn("Supabase data source failed, falling back to local demo dataset", error);
    return loadLocal();
  }
}

function parseGeoPoint(input: { lat?: string; lng?: string }): GeoPoint | undefined {
  if (!input.lat || !input.lng) {
    return undefined;
  }

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }

  return { lat, lng };
}
