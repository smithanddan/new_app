import type {
  DbCanonicalPriceComparison,
  DbPriceComparisonOffer,
} from './supabase-lab-catalog.repository.js';
import type { LabCatalogRepository } from './supabase-lab-catalog.repository.js';

export const DEFAULT_PRODUCT_TESTS = [
  'Общий анализ крови',
  'Общий анализ мочи',
  'Глюкоза',
  'ТТГ',
  'Ферритин',
  'Креатинин',
  'Холестерин общий',
  'Витамин D',
  'Биохимия крови',
];

export type ProductOffer = {
  provider: DbPriceComparisonOffer['provider'];
  region: DbPriceComparisonOffer['region'];
  provider_test_id: string;
  provider_test_name: string;
  provider_test_code?: string;
  offer_type: DbPriceComparisonOffer['offer_type'];
  offer_source: DbPriceComparisonOffer['offer_source'];
  promotion_title?: string;
  valid_from?: string;
  valid_to?: string;
  regular_price_rub?: number;
  promo_price_rub?: number;
  effective_price_rub?: number;
  biomaterial_price_rub: number;
  total_price_rub?: number;
  source_url?: string;
  fetched_at: string;
};

export type ProductCompareRow = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'] | null;
  offers_count: number;
  cheapest: ProductOffer | null;
  offers: ProductOffer[];
  unmatched_provider_tests: DbCanonicalPriceComparison['unmatched_provider_tests'];
  error?: 'canonical_test_not_found';
};

export type ProductCompareMatrix = {
  city: string;
  tests_count: number;
  rows: ProductCompareRow[];
};

export type BasketMode = 'per-test' | 'single-provider';

export type BasketSelectedItem = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'] | null;
  offer: ProductOffer;
};

export type BasketMissingItem = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'] | null;
  error: 'canonical_test_not_found' | 'no_offers' | 'provider_missing_offer';
};

export type PerTestBasket = {
  city: string;
  mode: 'per-test';
  requested_tests: string[];
  selected: BasketSelectedItem[];
  total_price_rub: number | null;
  missing: BasketMissingItem[];
};

export type SingleProviderBasket = {
  city: string;
  mode: 'single-provider';
  requested_tests: string[];
  selected_provider: ProviderBasketOption | null;
  provider_options: ProviderBasketOption[];
};

export type ProviderBasketOption = {
  provider: ProductOffer['provider'] | { code: string };
  selected: BasketSelectedItem[];
  total_price_rub: number | null;
  missing: BasketMissingItem[];
  complete: boolean;
};

type BasketComparison = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'] | null;
  offers: ProductOffer[];
  error?: 'canonical_test_not_found';
};

export async function getCompareMatrix(input: {
  repository: LabCatalogRepository;
  city: string;
  tests?: string[];
  test?: string;
}): Promise<ProductCompareMatrix> {
  const tests = input.test ? [input.test] : input.tests ?? DEFAULT_PRODUCT_TESTS;
  const rows: ProductCompareRow[] = [];

  for (const testSearch of tests) {
    const canonical = await input.repository.findCanonicalTestBySearch(testSearch);

    if (!canonical) {
      rows.push({
        test: testSearch,
        canonical_test: null,
        offers_count: 0,
        cheapest: null,
        offers: [],
        unmatched_provider_tests: [],
        error: 'canonical_test_not_found',
      });
      continue;
    }

    const comparison = await input.repository.compareCanonicalTestPricesFromDb(canonical.id, input.city);
    const offers = comparison.offers.map(normalizeProductOffer);
    rows.push({
      test: testSearch,
      canonical_test: comparison.canonical_test,
      offers_count: offers.length,
      cheapest: offers[0] ?? null,
      offers,
      unmatched_provider_tests: comparison.unmatched_provider_tests,
    });
  }

  return {
    city: input.city,
    tests_count: rows.length,
    rows,
  };
}

export async function getBasket(input: {
  repository: LabCatalogRepository;
  city: string;
  tests: string[];
  mode?: BasketMode;
}): Promise<PerTestBasket | SingleProviderBasket> {
  const comparisons = await getBasketComparisons(input.repository, input.city, input.tests);

  if (input.mode === 'single-provider') {
    return {
      city: input.city,
      mode: 'single-provider',
      requested_tests: input.tests,
      ...buildSingleProviderBasket(comparisons),
    };
  }

  return {
    city: input.city,
    mode: 'per-test',
    requested_tests: input.tests,
    ...buildPerTestBasket(comparisons),
  };
}

export function parseTestList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeProductOffer(offer: DbPriceComparisonOffer): ProductOffer {
  return {
    provider: offer.provider,
    region: offer.region,
    provider_test_id: offer.provider_test_id,
    provider_test_name: offer.provider_test_name,
    provider_test_code: offer.provider_test_code,
    offer_type: offer.offer_type,
    offer_source: offer.offer_source,
    promotion_title: offer.promotion_title,
    valid_from: offer.valid_from,
    valid_to: offer.valid_to,
    regular_price_rub: offer.regular_price_rub,
    promo_price_rub: offer.promo_price_rub,
    effective_price_rub: offer.effective_price_rub,
    biomaterial_price_rub: offer.biomaterial_price_rub ?? 0,
    total_price_rub: offer.effective_price_rub === undefined
      ? offer.total_price_rub
      : offer.effective_price_rub + (offer.biomaterial_price_rub ?? 0),
    source_url: offer.source_url,
    fetched_at: offer.fetched_at,
  };
}

async function getBasketComparisons(
  repository: LabCatalogRepository,
  city: string,
  tests: string[],
): Promise<BasketComparison[]> {
  const comparisons: BasketComparison[] = [];

  for (const testSearch of tests) {
    const canonical = await repository.findCanonicalTestBySearch(testSearch);

    if (!canonical) {
      comparisons.push({
        test: testSearch,
        canonical_test: null,
        offers: [],
        error: 'canonical_test_not_found',
      });
      continue;
    }

    const comparison = await repository.compareCanonicalTestPricesFromDb(canonical.id, city);
    comparisons.push({
      test: testSearch,
      canonical_test: comparison.canonical_test,
      offers: comparison.offers
        .map(normalizeProductOffer)
        .filter((offer) => offer.total_price_rub !== undefined),
    });
  }

  return comparisons;
}

function buildPerTestBasket(comparisons: BasketComparison[]) {
  const selected = comparisons
    .map((comparison) => {
      const cheapest = comparison.offers[0];
      return cheapest ? {
        test: comparison.test,
        canonical_test: comparison.canonical_test,
        offer: cheapest,
      } : undefined;
    })
    .filter((item): item is BasketSelectedItem => item !== undefined);
  const missing = comparisons
    .filter((comparison) => comparison.offers.length === 0)
    .map<BasketMissingItem>((comparison) => ({
      test: comparison.test,
      canonical_test: comparison.canonical_test,
      error: comparison.error ?? 'no_offers',
    }));

  return {
    selected,
    total_price_rub: sumTotals(selected.map((item) => item.offer)),
    missing,
  };
}

function buildSingleProviderBasket(comparisons: BasketComparison[]) {
  const providerKeys = new Set<string>();

  for (const comparison of comparisons) {
    for (const offer of comparison.offers) {
      providerKeys.add(offer.provider.code);
    }
  }

  const providerOptions = [...providerKeys].map<ProviderBasketOption>((providerCode) => {
    const selected = comparisons
      .map((comparison) => {
        const offer = comparison.offers
          .filter((candidate) => candidate.provider.code === providerCode)
          .sort((a, b) => (a.total_price_rub ?? Number.POSITIVE_INFINITY) - (b.total_price_rub ?? Number.POSITIVE_INFINITY))[0];

        return offer ? {
          test: comparison.test,
          canonical_test: comparison.canonical_test,
          offer,
        } : undefined;
      })
      .filter((item): item is BasketSelectedItem => item !== undefined);
    const missing = comparisons
      .filter((comparison) => !comparison.offers.some((offer) => offer.provider.code === providerCode))
      .map<BasketMissingItem>((comparison) => ({
        test: comparison.test,
        canonical_test: comparison.canonical_test,
        error: comparison.error ?? 'provider_missing_offer',
      }));
    const firstOffer = selected[0]?.offer;

    return {
      provider: firstOffer?.provider ?? { code: providerCode },
      selected,
      total_price_rub: sumTotals(selected.map((item) => item.offer)),
      missing,
      complete: missing.length === 0,
    };
  }).sort((a, b) => {
    if (a.complete !== b.complete) {
      return a.complete ? -1 : 1;
    }

    return (a.total_price_rub ?? Number.POSITIVE_INFINITY) - (b.total_price_rub ?? Number.POSITIVE_INFINITY);
  });

  return {
    selected_provider: providerOptions.find((provider) => provider.complete) ?? null,
    provider_options: providerOptions,
  };
}

function sumTotals(offers: Array<{ total_price_rub?: number }>): number | null {
  if (offers.some((offer) => offer.total_price_rub === undefined)) {
    return null;
  }

  return offers.reduce((sum, offer) => sum + (offer.total_price_rub ?? 0), 0);
}
