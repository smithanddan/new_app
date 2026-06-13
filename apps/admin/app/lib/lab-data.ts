import "server-only";

import {
  getBasket,
  getCompareMatrix,
  parseTestList,
  type BasketMode,
} from "@labmind/lab-crawlers/src/product-layer";
import { createLabCrawlerSupabaseClient } from "@labmind/lab-crawlers/src/supabase-client";
import { LabCatalogRepository } from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";

export const DEFAULT_CITY = "Москва";

export function getRepository() {
  return new LabCatalogRepository(createLabCrawlerSupabaseClient());
}

export async function getComparePageData(input: { test?: string; city?: string }) {
  const repository = getRepository();
  const city = input.city || DEFAULT_CITY;

  return getCompareMatrix({
    repository,
    city,
    test: input.test || "Глюкоза",
  });
}

export async function getBasketPageData(input: { tests?: string; city?: string; mode?: string }) {
  const repository = getRepository();
  const city = input.city || DEFAULT_CITY;
  const tests = parseTestList(input.tests || "Глюкоза,ТТГ,Ферритин");
  const mode: BasketMode = input.mode === "single-provider" ? "single-provider" : "per-test";

  return getBasket({
    repository,
    city,
    tests,
    mode,
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
