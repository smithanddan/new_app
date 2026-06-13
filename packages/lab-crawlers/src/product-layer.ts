import type {
  DbCanonicalPriceComparison,
  DbMarketQualityStats,
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
  is_cheapest: boolean;
};

export type ProductProviderGroup = {
  provider: ProductOffer['provider'];
  offers: ProductOffer[];
  cheapest: ProductOffer;
};

export type ProductCompareRow = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'] | null;
  offers_count: number;
  cheapest: ProductOffer | null;
  offers: ProductOffer[];
  provider_groups: ProductProviderGroup[];
  market_summary: ProductMarketSummary | null;
  unmatched_provider_tests: DbCanonicalPriceComparison['unmatched_provider_tests'];
  error?: 'canonical_test_not_found';
};

export type ProductCompareMatrix = {
  city: string;
  tests_count: number;
  rows: ProductCompareRow[];
};

export type BasketMode = 'per-test' | 'single-provider';

export type ProductMarketSummary = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'];
  city: string;
  offers_count: number;
  min_price_rub: number;
  max_price_rub: number;
  avg_price_rub: number;
  median_price_rub: number;
  promo_offers_count: number;
  regular_offers_count: number;
  promo_ratio: number;
  cheapest: ProductOffer;
  most_expensive: ProductOffer;
  price_spread_rub: number;
  price_spread_percent: number | null;
  promo_effect_rub: number | null;
  provider_distribution: Array<{
    provider: ProductOffer['provider'];
    offers_count: number;
    min_price_rub: number;
    max_price_rub: number;
    avg_price_rub: number;
  }>;
};

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
  single_provider_best: ProviderBasketOption | null;
  savings_vs_single_provider_rub: number | null;
  missing: BasketMissingItem[];
};

export type SingleProviderBasket = {
  city: string;
  mode: 'single-provider';
  requested_tests: string[];
  selected_provider: ProviderBasketOption | null;
  provider_options: ProviderBasketOption[];
  per_test_total_price_rub: number | null;
  savings_vs_single_provider_rub: number | null;
};

export type ProviderBasketOption = {
  provider: ProductOffer['provider'] | { code: string };
  selected: BasketSelectedItem[];
  total_price_rub: number | null;
  missing: BasketMissingItem[];
  complete: boolean;
};

export type BasketCostMatrixRow = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'] | null;
  provider: ProductOffer['provider'];
  offer: ProductOffer;
  test_price_rub: number;
  biomaterial_price_rub: number;
  line_total_rub: number;
};

export type BasketRouteItem = {
  test: string;
  canonical_test: DbCanonicalPriceComparison['canonical_test'] | null;
  offer: ProductOffer;
  test_price_rub: number;
  biomaterial_price_rub: number;
};

export type BasketRouteProviderGroup = {
  provider: ProductOffer['provider'];
  items: BasketRouteItem[];
  tests_total_rub: number;
  biomaterial_fee_rub: number;
  total_rub: number;
};

export type BasketRouteOption = {
  strategy: 'single_provider' | 'split_provider';
  available: boolean;
  provider_count: number;
  total_rub: number | null;
  tests_total_rub: number | null;
  biomaterial_total_rub: number | null;
  groups: BasketRouteProviderGroup[];
  missing: BasketMissingItem[];
};

export type BasketOptimizationRecommendation = {
  strategy: 'single_provider' | 'split_provider' | 'unavailable';
  total_rub: number | null;
  savings_rub: number | null;
  route_penalty_rub: number;
  why: string;
};

export type BasketOptimizationResult = {
  city: string;
  requested_tests: string[];
  provider_penalty_rub: number;
  cost_matrix: BasketCostMatrixRow[];
  single_provider_option: BasketRouteOption;
  split_provider_option: BasketRouteOption;
  recommendation: BasketOptimizationRecommendation;
  missing: BasketMissingItem[];
};

export type ProductQualityReport = {
  city: string;
  stats: DbMarketQualityStats;
  canonical_coverage: {
    tests_count: number;
    with_offers_count: number;
    without_offers_count: number;
    rows: ProductCompareRow[];
  };
  provider_coverage: Array<{
    provider: ProductOffer['provider'];
    tests_count: number;
    offers_count: number;
    cheapest_count: number;
  }>;
  price_spreads: Array<{
    test: string;
    cheapest: ProductOffer;
    most_expensive: ProductOffer;
    spread_rub: number;
    spread_percent: number | null;
  }>;
  promo_rows: Array<{
    test: string;
    offer: ProductOffer;
  }>;
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
        provider_groups: [],
        market_summary: null,
        unmatched_provider_tests: [],
        error: 'canonical_test_not_found',
      });
      continue;
    }

    const comparison = await input.repository.compareCanonicalTestPricesFromDb(canonical.id, input.city);
    const offers = markCheapest(comparison.offers.map(normalizeProductOffer));
    rows.push({
      test: testSearch,
      canonical_test: comparison.canonical_test,
      offers_count: offers.length,
      cheapest: offers[0] ?? null,
      offers,
      provider_groups: groupOffersByProvider(offers),
      market_summary: buildMarketSummary({
        test: testSearch,
        canonicalTest: comparison.canonical_test,
        city: input.city,
        offers,
      }),
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
  const perTestBasket = buildPerTestBasket(comparisons);
  const singleProviderBasket = buildSingleProviderBasket(comparisons);
  const savings = calculateSavings(perTestBasket.total_price_rub, singleProviderBasket.selected_provider?.total_price_rub ?? null);

  if (input.mode === 'single-provider') {
    return {
      city: input.city,
      mode: 'single-provider',
      requested_tests: input.tests,
      ...singleProviderBasket,
      per_test_total_price_rub: perTestBasket.total_price_rub,
      savings_vs_single_provider_rub: savings,
    };
  }

  return {
    city: input.city,
    mode: 'per-test',
    requested_tests: input.tests,
    ...perTestBasket,
    single_provider_best: singleProviderBasket.selected_provider,
    savings_vs_single_provider_rub: savings,
  };
}

export async function getBasketOptimization(input: {
  repository: LabCatalogRepository;
  city: string;
  tests: string[];
  providerPenaltyRub?: number;
}): Promise<BasketOptimizationResult> {
  const providerPenaltyRub = input.providerPenaltyRub ?? 300;
  const comparisons = await getBasketComparisons(input.repository, input.city, input.tests);
  const costMatrix = buildCostMatrix(comparisons);
  const missing = comparisons
    .filter((comparison) => comparison.offers.length === 0)
    .map<BasketMissingItem>((comparison) => ({
      test: comparison.test,
      canonical_test: comparison.canonical_test,
      error: comparison.error ?? 'no_offers',
    }));
  const singleProviderOption = buildSingleProviderRouteOption(comparisons);
  const splitProviderOption = buildSplitProviderRouteOption(comparisons);
  const recommendation = buildBasketRecommendation(singleProviderOption, splitProviderOption, providerPenaltyRub);

  return {
    city: input.city,
    requested_tests: input.tests,
    provider_penalty_rub: providerPenaltyRub,
    cost_matrix: costMatrix,
    single_provider_option: singleProviderOption,
    split_provider_option: splitProviderOption,
    recommendation,
    missing,
  };
}

export async function getMarketSummary(input: {
  repository: LabCatalogRepository;
  city: string;
  test: string;
}): Promise<ProductMarketSummary | null> {
  const matrix = await getCompareMatrix({
    repository: input.repository,
    city: input.city,
    test: input.test,
  });

  return matrix.rows[0]?.market_summary ?? null;
}

export async function getQualityReport(input: {
  repository: LabCatalogRepository;
  city: string;
  tests?: string[];
}): Promise<ProductQualityReport> {
  const [stats, matrix] = await Promise.all([
    input.repository.getMarketQualityStats(),
    getCompareMatrix({
      repository: input.repository,
      city: input.city,
      tests: input.tests ?? DEFAULT_PRODUCT_TESTS,
    }),
  ]);

  const providerCoverage = buildProviderCoverage(matrix.rows);
  const priceSpreads = matrix.rows
    .map((row) => buildPriceSpread(row))
    .filter((spread): spread is ProductQualityReport['price_spreads'][number] => spread !== null)
    .sort((a, b) => b.spread_rub - a.spread_rub);
  const promoRows = matrix.rows.flatMap((row) => row.offers
    .filter((offer) => offer.offer_type === 'promo' || offer.promo_price_rub !== undefined)
    .map((offer) => ({ test: row.test, offer })));

  return {
    city: input.city,
    stats,
    canonical_coverage: {
      tests_count: matrix.rows.length,
      with_offers_count: matrix.rows.filter((row) => row.offers_count > 0).length,
      without_offers_count: matrix.rows.filter((row) => row.offers_count === 0).length,
      rows: matrix.rows,
    },
    provider_coverage: providerCoverage,
    price_spreads: priceSpreads,
    promo_rows: promoRows,
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
    is_cheapest: false,
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
      offers: markCheapest(comparison.offers.map(normalizeProductOffer))
        .filter((offer) => offer.total_price_rub !== undefined),
    });
  }

  return comparisons;
}

function markCheapest(offers: ProductOffer[]): ProductOffer[] {
  const sorted = [...offers].sort((a, b) => (a.total_price_rub ?? Number.POSITIVE_INFINITY) - (b.total_price_rub ?? Number.POSITIVE_INFINITY));
  const cheapestTotal = sorted[0]?.total_price_rub;

  return sorted.map((offer) => ({
    ...offer,
    is_cheapest: cheapestTotal !== undefined && offer.total_price_rub === cheapestTotal,
  }));
}

function groupOffersByProvider(offers: ProductOffer[]): ProductProviderGroup[] {
  const byProvider = new Map<string, ProductOffer[]>();

  for (const offer of offers) {
    const existing = byProvider.get(offer.provider.code) ?? [];
    existing.push(offer);
    byProvider.set(offer.provider.code, existing);
  }

  return [...byProvider.values()]
    .map((providerOffers) => {
      const sorted = [...providerOffers].sort((a, b) => (a.total_price_rub ?? Number.POSITIVE_INFINITY) - (b.total_price_rub ?? Number.POSITIVE_INFINITY));
      return {
        provider: sorted[0].provider,
        offers: sorted,
        cheapest: sorted[0],
      };
    })
    .sort((a, b) => (a.cheapest.total_price_rub ?? Number.POSITIVE_INFINITY) - (b.cheapest.total_price_rub ?? Number.POSITIVE_INFINITY));
}

function buildMarketSummary(input: {
  test: string;
  canonicalTest: DbCanonicalPriceComparison['canonical_test'];
  city: string;
  offers: ProductOffer[];
}): ProductMarketSummary | null {
  const pricedOffers = input.offers.filter((offer) => offer.total_price_rub !== undefined);
  if (pricedOffers.length === 0) {
    return null;
  }

  const totals = pricedOffers.map((offer) => offer.total_price_rub as number);
  const cheapest = pricedOffers[0];
  const mostExpensive = pricedOffers[pricedOffers.length - 1];
  const provider_distribution = groupOffersByProvider(pricedOffers).map((group) => {
    const providerTotals = group.offers.map((offer) => offer.total_price_rub as number);
    return {
      provider: group.provider,
      offers_count: group.offers.length,
      min_price_rub: Math.min(...providerTotals),
      max_price_rub: Math.max(...providerTotals),
      avg_price_rub: average(providerTotals),
    };
  });

  return {
    test: input.test,
    canonical_test: input.canonicalTest,
    city: input.city,
    offers_count: pricedOffers.length,
    min_price_rub: Math.min(...totals),
    max_price_rub: Math.max(...totals),
    avg_price_rub: average(totals),
    median_price_rub: median(totals),
    promo_offers_count: pricedOffers.filter(isPromoOffer).length,
    regular_offers_count: pricedOffers.filter((offer) => !isPromoOffer(offer)).length,
    promo_ratio: ratio(pricedOffers.filter(isPromoOffer).length, pricedOffers.length),
    cheapest,
    most_expensive: mostExpensive,
    price_spread_rub: (mostExpensive.total_price_rub as number) - (cheapest.total_price_rub as number),
    price_spread_percent: (cheapest.total_price_rub ?? 0) === 0
      ? null
      : Math.round((((mostExpensive.total_price_rub as number) - (cheapest.total_price_rub as number)) / (cheapest.total_price_rub as number)) * 100),
    promo_effect_rub: calculatePromoEffect(pricedOffers),
    provider_distribution,
  };
}

function buildCostMatrix(comparisons: BasketComparison[]): BasketCostMatrixRow[] {
  return comparisons.flatMap((comparison) => comparison.offers.map((offer) => ({
    test: comparison.test,
    canonical_test: comparison.canonical_test,
    provider: offer.provider,
    offer,
    test_price_rub: offer.effective_price_rub ?? 0,
    biomaterial_price_rub: offer.biomaterial_price_rub,
    line_total_rub: (offer.effective_price_rub ?? 0) + offer.biomaterial_price_rub,
  })));
}

function buildSingleProviderRouteOption(comparisons: BasketComparison[]): BasketRouteOption {
  const providerCodes = new Set<string>();
  for (const comparison of comparisons) {
    for (const offer of comparison.offers) {
      providerCodes.add(offer.provider.code);
    }
  }

  const options = [...providerCodes]
    .map((providerCode) => buildRouteOption({
      strategy: 'single_provider',
      comparisons,
      selectOffer: (comparison) => comparison.offers.find((offer) => offer.provider.code === providerCode),
    }))
    .filter((option) => option.available)
    .sort((a, b) => (a.total_rub ?? Number.POSITIVE_INFINITY) - (b.total_rub ?? Number.POSITIVE_INFINITY));

  return options[0] ?? emptyRouteOption('single_provider', comparisons);
}

function buildSplitProviderRouteOption(comparisons: BasketComparison[]): BasketRouteOption {
  return buildRouteOption({
    strategy: 'split_provider',
    comparisons,
    selectOffer: (comparison) => comparison.offers[0],
  });
}

function buildRouteOption(input: {
  strategy: BasketRouteOption['strategy'];
  comparisons: BasketComparison[];
  selectOffer: (comparison: BasketComparison) => ProductOffer | undefined;
}): BasketRouteOption {
  const selected: BasketRouteItem[] = [];
  const missing: BasketMissingItem[] = [];

  for (const comparison of input.comparisons) {
    const offer = input.selectOffer(comparison);
    if (!offer) {
      missing.push({
        test: comparison.test,
        canonical_test: comparison.canonical_test,
        error: comparison.error ?? 'provider_missing_offer',
      });
      continue;
    }

    selected.push({
      test: comparison.test,
      canonical_test: comparison.canonical_test,
      offer,
      test_price_rub: offer.effective_price_rub ?? 0,
      biomaterial_price_rub: offer.biomaterial_price_rub,
    });
  }

  const groups = groupRouteItemsByProvider(selected);
  const testsTotal = groups.reduce((sum, group) => sum + group.tests_total_rub, 0);
  const biomaterialTotal = groups.reduce((sum, group) => sum + group.biomaterial_fee_rub, 0);

  return {
    strategy: input.strategy,
    available: missing.length === 0 && selected.length > 0,
    provider_count: groups.length,
    total_rub: missing.length === 0 ? testsTotal + biomaterialTotal : null,
    tests_total_rub: missing.length === 0 ? testsTotal : null,
    biomaterial_total_rub: missing.length === 0 ? biomaterialTotal : null,
    groups,
    missing,
  };
}

function groupRouteItemsByProvider(items: BasketRouteItem[]): BasketRouteProviderGroup[] {
  const byProvider = new Map<string, BasketRouteItem[]>();
  for (const item of items) {
    byProvider.set(item.offer.provider.code, [...(byProvider.get(item.offer.provider.code) ?? []), item]);
  }

  return [...byProvider.values()].map((providerItems) => {
    const testsTotal = providerItems.reduce((sum, item) => sum + item.test_price_rub, 0);
    const biomaterialFee = Math.max(0, ...providerItems.map((item) => item.biomaterial_price_rub));
    return {
      provider: providerItems[0].offer.provider,
      items: providerItems,
      tests_total_rub: testsTotal,
      biomaterial_fee_rub: biomaterialFee,
      total_rub: testsTotal + biomaterialFee,
    };
  }).sort((a, b) => a.provider.name.localeCompare(b.provider.name));
}

function emptyRouteOption(strategy: BasketRouteOption['strategy'], comparisons: BasketComparison[]): BasketRouteOption {
  return {
    strategy,
    available: false,
    provider_count: 0,
    total_rub: null,
    tests_total_rub: null,
    biomaterial_total_rub: null,
    groups: [],
    missing: comparisons.map((comparison) => ({
      test: comparison.test,
      canonical_test: comparison.canonical_test,
      error: comparison.error ?? 'no_offers',
    })),
  };
}

function buildBasketRecommendation(
  singleProvider: BasketRouteOption,
  splitProvider: BasketRouteOption,
  providerPenaltyRub: number,
): BasketOptimizationRecommendation {
  if (!singleProvider.available && !splitProvider.available) {
    return {
      strategy: 'unavailable',
      total_rub: null,
      savings_rub: null,
      route_penalty_rub: 0,
      why: 'Нет полного покрытия корзины по текущим данным.',
    };
  }

  if (!singleProvider.available) {
    return {
      strategy: 'split_provider',
      total_rub: splitProvider.total_rub,
      savings_rub: null,
      route_penalty_rub: Math.max(0, splitProvider.provider_count - 1) * providerPenaltyRub,
      why: 'Single-provider маршрут недоступен, выбран split с доступным покрытием.',
    };
  }

  if (!splitProvider.available) {
    return {
      strategy: 'single_provider',
      total_rub: singleProvider.total_rub,
      savings_rub: null,
      route_penalty_rub: 0,
      why: 'Split маршрут недоступен, выбран single-provider.',
    };
  }

  const routePenalty = Math.max(0, splitProvider.provider_count - 1) * providerPenaltyRub;
  const savings = (singleProvider.total_rub as number) - (splitProvider.total_rub as number);
  const effectiveSplitTotal = (splitProvider.total_rub as number) + routePenalty;

  if (effectiveSplitTotal < (singleProvider.total_rub as number)) {
    return {
      strategy: 'split_provider',
      total_rub: splitProvider.total_rub,
      savings_rub: savings,
      route_penalty_rub: routePenalty,
      why: `Split дешевле даже с route penalty ${routePenalty} RUB.`,
    };
  }

  return {
    strategy: 'single_provider',
    total_rub: singleProvider.total_rub,
    savings_rub: savings,
    route_penalty_rub: routePenalty,
    why: savings > 0
      ? `Экономия split ${savings} RUB не превышает route penalty ${routePenalty} RUB.`
      : 'Single-provider дешевле или равен split и проще для пациента.',
  };
}

function buildProviderCoverage(rows: ProductCompareRow[]): ProductQualityReport['provider_coverage'] {
  const byProvider = new Map<string, ProductQualityReport['provider_coverage'][number]>();

  for (const row of rows) {
    for (const group of row.provider_groups) {
      const existing = byProvider.get(group.provider.code) ?? {
        provider: group.provider,
        tests_count: 0,
        offers_count: 0,
        cheapest_count: 0,
      };
      existing.tests_count += 1;
      existing.offers_count += group.offers.length;
      existing.cheapest_count += group.offers.some((offer) => offer.is_cheapest) ? 1 : 0;
      byProvider.set(group.provider.code, existing);
    }
  }

  return [...byProvider.values()]
    .sort((a, b) => b.tests_count - a.tests_count || b.cheapest_count - a.cheapest_count);
}

function buildPriceSpread(row: ProductCompareRow): ProductQualityReport['price_spreads'][number] | null {
  const pricedOffers = row.offers.filter((offer) => offer.total_price_rub !== undefined);
  const providerCodes = new Set(pricedOffers.map((offer) => offer.provider.code));
  if (pricedOffers.length < 2 || providerCodes.size < 2) {
    return null;
  }

  const cheapest = pricedOffers[0];
  const mostExpensive = pricedOffers[pricedOffers.length - 1];
  const cheapestTotal = cheapest.total_price_rub as number;
  const expensiveTotal = mostExpensive.total_price_rub as number;
  const spreadRub = expensiveTotal - cheapestTotal;

  return {
    test: row.test,
    cheapest,
    most_expensive: mostExpensive,
    spread_rub: spreadRub,
    spread_percent: cheapestTotal === 0 ? null : Math.round((spreadRub / cheapestTotal) * 100),
  };
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

function calculateSavings(perTestTotal: number | null, singleProviderTotal: number | null): number | null {
  if (perTestTotal === null || singleProviderTotal === null) {
    return null;
  }

  return singleProviderTotal - perTestTotal;
}

function average(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function ratio(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function isPromoOffer(offer: ProductOffer): boolean {
  return offer.offer_type === 'promo' || offer.promo_price_rub !== undefined;
}

function calculatePromoEffect(offers: ProductOffer[]): number | null {
  const promoTotals = offers
    .filter(isPromoOffer)
    .map((offer) => offer.total_price_rub)
    .filter((value): value is number => value !== undefined);
  const regularTotals = offers
    .filter((offer) => !isPromoOffer(offer))
    .map((offer) => offer.total_price_rub)
    .filter((value): value is number => value !== undefined);

  if (promoTotals.length === 0 || regularTotals.length === 0) {
    return null;
  }

  return Math.min(...regularTotals) - Math.min(...promoTotals);
}
