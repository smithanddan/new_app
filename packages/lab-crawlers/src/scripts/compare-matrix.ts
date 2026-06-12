import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
} from '../index.js';

const DEFAULT_TESTS = [
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

const args = parseArgs(process.argv.slice(2));
const cityName = args.city;

if (!cityName) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers compare:matrix -- --city "Москва" [--tests "Глюкоза,ТТГ"]');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const tests = args.tests ?? DEFAULT_TESTS;
const rows = [];

for (const testSearch of tests) {
  const canonical = await repository.findCanonicalTestBySearch(testSearch);

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

  const comparison = await repository.compareCanonicalTestPricesFromDb(canonical.id, cityName);
  rows.push({
    test: testSearch,
    canonical_test: comparison.canonical_test,
    offers_count: comparison.offers.length,
    cheapest: summarizeOffer(comparison.offers[0]),
    offers: comparison.offers.map(summarizeOffer),
    unmatched_provider_tests: comparison.unmatched_provider_tests,
  });
}

console.log(JSON.stringify({
  city: cityName,
  tests_count: rows.length,
  rows,
}, null, 2));

function summarizeOffer(offer: Awaited<ReturnType<LabCatalogRepository['compareCanonicalTestPricesFromDb']>>['offers'][number] | undefined) {
  if (!offer) {
    return null;
  }

  return {
    provider: offer.provider,
    region: offer.region,
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
    biomaterial_price_rub: offer.biomaterial_price_rub,
    total_price_rub: offer.total_price_rub,
    source_url: offer.source_url,
    fetched_at: offer.fetched_at,
  };
}

function parseArgs(values: string[]): { city?: string; tests?: string[] } {
  const parsed: { city?: string; tests?: string[] } = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--city') {
      parsed.city = values[index + 1];
      index += 1;
    } else if (value === '--tests') {
      parsed.tests = values[index + 1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return parsed;
}
