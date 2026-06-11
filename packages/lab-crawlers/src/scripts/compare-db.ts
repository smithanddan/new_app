import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
} from '../index.js';

const args = parseArgs(process.argv.slice(2));
const testSearch = args.test;
const cityName = args.city;

if (!testSearch || !cityName) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers compare:db -- --test "Глюкоза" --city "Москва"');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const canonical = await repository.findCanonicalTestBySearch(testSearch);

if (!canonical) {
  throw new Error(`Canonical test not found for: ${testSearch}`);
}

const comparison = await repository.compareCanonicalTestPricesFromDb(canonical.id, cityName);

console.log(JSON.stringify({
  canonical_test: comparison.canonical_test,
  city: comparison.city,
  offers_count: comparison.offers.length,
  offers: comparison.offers.map((offer) => ({
    provider: offer.provider,
    region: offer.region,
    provider_test_name: offer.provider_test_name,
    provider_test_code: offer.provider_test_code,
    regular_price_rub: offer.regular_price_rub,
    promo_price_rub: offer.promo_price_rub,
    effective_price_rub: offer.effective_price_rub,
    biomaterial_price_rub: offer.biomaterial_price_rub,
    total_price_rub: offer.total_price_rub,
    source_url: offer.source_url,
    fetched_at: offer.fetched_at,
  })),
  unmatched_provider_tests: comparison.unmatched_provider_tests,
  auto_match_suggestion: comparison.auto_match_suggestion,
}, null, 2));

function parseArgs(values: string[]): { test?: string; city?: string } {
  const parsed: { test?: string; city?: string } = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--test') {
      parsed.test = values[index + 1];
      index += 1;
    } else if (value === '--city') {
      parsed.city = values[index + 1];
      index += 1;
    }
  }

  return parsed;
}
