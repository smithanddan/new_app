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

const output = {
  city: cityName,
  tests_count: rows.length,
  rows,
};

if (args.format === 'json') {
  console.log(JSON.stringify(output, null, 2));
} else {
  printTable(output);
}

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

function printTable(output: {
  city: string;
  tests_count: number;
  rows: Array<{
    test: string;
    offers_count: number;
    cheapest: ReturnType<typeof summarizeOffer>;
    error?: string;
  }>;
}) {
  const tableRows = output.rows.map((row) => ({
    'Анализ': row.test,
    'Лаборатория': row.cheapest?.provider.name ?? '-',
    'Позиция': row.cheapest?.provider_test_name ?? row.error ?? 'нет предложений',
    'Код': row.cheapest?.provider_test_code ?? '-',
    'Обычная': formatRub(row.cheapest?.regular_price_rub),
    'Акция': formatRub(row.cheapest?.promo_price_rub),
    'Забор': formatRub(row.cheapest?.biomaterial_price_rub),
    'Итого': formatRub(row.cheapest?.total_price_rub),
    'Источник': row.cheapest?.offer_source ?? '-',
    'URL': row.cheapest?.source_url ?? '-',
    'Предл.': String(row.offers_count),
  }));

  console.log(`Сравнение цен: ${output.city}`);
  printRows(tableRows);
}

function printRows(rows: Array<Record<string, string>>) {
  if (rows.length === 0) {
    console.log('Нет данных');
    return;
  }

  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) => Math.max(
    header.length,
    ...rows.map((row) => row[header].length),
  ));
  const separator = widths.map((width) => '-'.repeat(width)).join('  ');

  console.log(headers.map((header, index) => header.padEnd(widths[index])).join('  '));
  console.log(separator);
  for (const row of rows) {
    console.log(headers.map((header, index) => row[header].padEnd(widths[index])).join('  '));
  }
}

function formatRub(value: number | undefined): string {
  return value === undefined ? '-' : `${value} ₽`;
}

function parseArgs(values: string[]): { city?: string; tests?: string[]; format: 'table' | 'json' } {
  const parsed: { city?: string; tests?: string[]; format: 'table' | 'json' } = { format: 'table' };

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
    } else if (value === '--format') {
      const format = values[index + 1];
      if (format !== 'table' && format !== 'json') {
        throw new Error('--format must be either table or json');
      }
      parsed.format = format;
      index += 1;
    }
  }

  return parsed;
}
