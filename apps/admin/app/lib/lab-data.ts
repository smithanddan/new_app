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
import { LabCatalogRepository } from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";

export const DEFAULT_CITY = "Москва";

export function getRepository() {
  return new LabCatalogRepository(createLabCrawlerSupabaseClient());
}

export async function getComparePageData(input: {
  test?: string;
  city?: string;
  lat?: string;
  lng?: string;
  sort?: string;
}) {
  const repository = getRepository();
  const city = input.city || DEFAULT_CITY;
  const userLocation = parseGeoPoint(input);

  return getCompareMatrix({
    repository,
    city,
    test: input.test || "Глюкоза",
    userLocation,
    sort: input.sort === "distance" ? "distance" : "price",
  });
}

export async function getBasketPageData(input: {
  tests?: string;
  city?: string;
  mode?: string;
  lat?: string;
  lng?: string;
  sort?: string;
}) {
  const repository = getRepository();
  const city = input.city || DEFAULT_CITY;
  const tests = parseTestList(input.tests || "Глюкоза,ТТГ,Ферритин");
  const userLocation = parseGeoPoint(input);

  if (!input.mode || input.mode === "optimization") {
    return getBasketOptimization({
      repository,
      city,
      tests,
      userLocation,
      sort: input.sort === "distance" ? "distance" : "price",
    });
  }

  const mode: BasketMode = input.mode === "single-provider" ? "single-provider" : "per-test";

  return getBasket({
    repository,
    city,
    tests,
    mode,
    userLocation,
    sort: input.sort === "distance" ? "distance" : "price",
  });
}

export async function getMatchPageData(input: { provider?: string; city?: string; limit?: string }) {
  const repository = getRepository();
  const provider = input.provider || "dnkom";
  const city = input.city || DEFAULT_CITY;
  const limit = Number(input.limit || 100);
  const [queue, candidates, matched] = await Promise.all([
    repository.listProviderTestsForMatchQueue({ providerCode: provider, cityName: city, limit }),
    repository.autoMatchProviderTestsFromDb({ providerCode: provider, cityName: city, limit }),
    repository.listMatchedProviderTests({ providerCode: provider, cityName: city, limit: Math.min(limit, 50) }),
  ]);

  return {
    provider,
    city,
    queue,
    candidates,
    matched,
  };
}

export async function getRunsPageData(input: { limit?: string }) {
  const repository = getRepository();
  return repository.listScraperRuns(Number(input.limit || 50));
}

export async function getDashboardPageData(input: { city?: string }) {
  const repository = getRepository();
  const city = input.city || DEFAULT_CITY;
  const [report, runs] = await Promise.all([
    getQualityReport({ repository, city }),
    repository.listScraperRuns(5),
  ]);

  return {
    report,
    runs,
  };
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
