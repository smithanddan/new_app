import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  getCompareMatrix,
} from '../index.js';
import type { ProductCompareMatrix, ProductOffer } from '../product-layer.js';

const args = parseArgs(process.argv.slice(2));
const cityName = args.city ?? 'Москва';

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const output = await getCompareMatrix({
  repository,
  city: cityName,
  test: args.test,
  tests: args.tests,
});

if (args.format === 'json') {
  console.log(JSON.stringify(output, null, 2));
} else if (args.test) {
  printSingleTestTable(output);
} else {
  printMatrixTable(output);
}

function printSingleTestTable(output: ProductCompareMatrix) {
  const row = output.rows[0];
  console.log(`Сравнение цен: ${row?.test ?? '-'} / ${output.city}`);

  if (!row || row.offers.length === 0) {
    console.log(row?.error === 'canonical_test_not_found' ? 'Анализ не найден в canonical_tests' : 'Нет предложений');
    return;
  }

  printRows(row.offers.map((offer) => ({
    'Best': offer.is_cheapest ? 'yes' : '',
    'Лаборатория': formatProvider(offer),
    'Позиция': offer.provider_test_name,
    'Код': offer.provider_test_code ?? '-',
    'Анализ': formatRub(offer.effective_price_rub),
    'Забор': formatRub(offer.biomaterial_price_rub),
    'Итог': formatRub(offer.total_price_rub),
    'Тип': formatOfferType(offer),
    'Источник': offer.offer_source,
    'Ссылка': offer.source_url ?? '-',
  })));
}

function printMatrixTable(output: ProductCompareMatrix) {
  const tableRows = output.rows.map((row) => ({
    'Анализ': row.test,
    'Best': row.cheapest?.is_cheapest ? 'yes' : '',
    'Лаборатория': row.cheapest ? formatProvider(row.cheapest) : '-',
    'Позиция': row.cheapest?.provider_test_name ?? row.error ?? 'нет предложений',
    'Код': row.cheapest?.provider_test_code ?? '-',
    'Цена': formatRub(row.cheapest?.effective_price_rub),
    'Забор': formatRub(row.cheapest?.biomaterial_price_rub),
    'Итог': formatRub(row.cheapest?.total_price_rub),
    'Тип': row.cheapest ? formatOfferType(row.cheapest) : '-',
    'Источник': row.cheapest?.offer_source ?? '-',
    'Ссылка': row.cheapest?.source_url ?? '-',
    'Предл.': String(row.offers_count),
  }));

  console.log(`Сравнение цен: ${output.city}`);
  printRows(tableRows);
}

function formatProvider(offer: ProductOffer): string {
  return offer.offer_type === 'promo'
    ? `${offer.provider.name} (promo)`
    : offer.provider.name;
}

function formatOfferType(offer: ProductOffer): string {
  return offer.offer_type === 'promo' || offer.promo_price_rub !== undefined
    ? 'promo'
    : 'regular';
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

function parseArgs(values: string[]): {
  city?: string;
  test?: string;
  tests?: string[];
  format: 'table' | 'json';
} {
  const parsed: {
    city?: string;
    test?: string;
    tests?: string[];
    format: 'table' | 'json';
  } = { format: 'table' };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--city') {
      parsed.city = values[index + 1];
      index += 1;
    } else if (value === '--test') {
      parsed.test = values[index + 1];
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

  if (parsed.test && parsed.tests) {
    throw new Error('Use either --test or --tests, not both');
  }

  return parsed;
}
