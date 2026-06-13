import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  getMarketSummary,
} from '../index.js';
import type { ProductMarketSummary } from '../product-layer.js';

const args = parseArgs(process.argv.slice(2));

if (!args.test) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers compare:market -- --test "Ферритин" --city "Москва" [--format table|json]');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const summary = await getMarketSummary({
  repository,
  test: args.test,
  city: args.city ?? 'Москва',
});

if (args.format === 'json') {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printMarketSummary(summary, args.test, args.city ?? 'Москва');
}

function printMarketSummary(summary: ProductMarketSummary | null, test: string, city: string) {
  console.log(`Market view: ${test} / ${city}`);

  if (!summary) {
    console.log('Нет рыночных данных');
    return;
  }

  printRows([
    {
      'Metric': 'min',
      'Value': formatRub(summary.min_price_rub),
      'Provider': summary.cheapest.provider.name,
      'Position': summary.cheapest.provider_test_name,
      'URL': summary.cheapest.source_url ?? '-',
    },
    {
      'Metric': 'max',
      'Value': formatRub(summary.max_price_rub),
      'Provider': '-',
      'Position': '-',
      'URL': '-',
    },
    {
      'Metric': 'avg',
      'Value': formatRub(summary.avg_price_rub),
      'Provider': '-',
      'Position': '-',
      'URL': '-',
    },
    {
      'Metric': 'offers',
      'Value': String(summary.offers_count),
      'Provider': '-',
      'Position': '-',
      'URL': '-',
    },
  ]);

  console.log('\nDistribution by provider:');
  printRows(summary.provider_distribution.map((provider) => ({
    'Provider': provider.provider.name,
    'Offers': String(provider.offers_count),
    'Min': formatRub(provider.min_price_rub),
    'Max': formatRub(provider.max_price_rub),
    'Avg': formatRub(provider.avg_price_rub),
  })));
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
  return value === undefined ? '-' : `${value}`;
}

function parseArgs(values: string[]): { city?: string; test?: string; format: 'table' | 'json' } {
  const parsed: { city?: string; test?: string; format: 'table' | 'json' } = { format: 'table' };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--city') {
      parsed.city = values[index + 1];
      index += 1;
    } else if (value === '--test') {
      parsed.test = values[index + 1];
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
