import {
  compareLocalMarket,
  loadLocalMarketDataset,
} from '../index.js';
import type { LocalCompareResult, LocalOffer } from '../local-market.js';

type OutputFormat = 'table' | 'json';

const args = parseArgs(process.argv.slice(2));
const dataset = loadLocalMarketDataset({
  city: args.city,
  invitroSnapshotPath: args.invitroSnapshot,
});
const output = compareLocalMarket({
  dataset,
  test: args.test,
});

if (args.format === 'json') {
  console.log(JSON.stringify({
    ...output,
    unmatched_count: output.unmatched.length,
    unmatched: output.unmatched.slice(0, 20).map((test) => ({
      providerCode: test.providerCode,
      externalCode: test.externalCode,
      name: test.name,
      kind: test.kind,
      sourceUrl: test.sourceUrl,
    })),
  }, null, 2));
} else {
  printCompare(output);
}

function printCompare(output: LocalCompareResult): void {
  console.log(`Локальное сравнение: ${output.test} / ${output.city}`);
  console.log(`Canonical: ${output.canonicalTest?.nameRu ?? 'не найден'}`);
  if (output.offers.length === 0) {
    console.log('Нет предложений в локальном dataset.');
    return;
  }

  printRows(output.offers.map((offer, index) => ({
    'Best': index === 0 ? 'yes' : '',
    'Лаборатория': formatProvider(offer),
    'Позиция': offer.providerTestName,
    'Код': offer.providerTestCode ?? '-',
    'Цена': formatRub(offer.effectivePriceRub),
    'Забор': formatRub(offer.biomaterialPriceRub),
    'Итог': formatRub(offer.totalPriceRub),
    'Тип': offer.offerType,
    'Условия': offer.specialConditions.join('; ') || '-',
    'Ссылка': offer.sourceUrl,
  })));
}

function formatProvider(offer: LocalOffer): string {
  return offer.offerType === 'promo' ? `${offer.providerName} (promo)` : offer.providerName;
}

function printRows(rows: Array<Record<string, string>>): void {
  const headers = Object.keys(rows[0] ?? {});
  if (headers.length === 0) {
    console.log('Нет данных');
    return;
  }
  const widths = headers.map((header) => Math.max(header.length, ...rows.map((row) => row[header].length)));
  console.log(headers.map((header, index) => header.padEnd(widths[index])).join('  '));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) {
    console.log(headers.map((header, index) => row[header].padEnd(widths[index])).join('  '));
  }
}

function formatRub(value: number | undefined): string {
  return value === undefined ? '-' : `${value}`;
}

function parseArgs(values: string[]): {
  city: string;
  test: string;
  invitroSnapshot?: string;
  format: OutputFormat;
} {
  const normalized = values.filter((item) => item !== '--');
  const getValue = (name: string) => {
    const index = normalized.indexOf(name);
    return index === -1 ? undefined : normalized[index + 1];
  };
  const test = getValue('--test') ?? normalized.find((value, index) => !value.startsWith('--') && !normalized[index - 1]?.startsWith('--'));
  if (!test) {
    throw new Error('Usage: pnpm --filter @labmind/lab-crawlers compare:local -- --test "Глюкоза" [--format json]');
  }

  const rawFormat = getValue('--format');
  const format: OutputFormat = rawFormat === 'json' ? 'json' : 'table';
  if (rawFormat && rawFormat !== 'table' && rawFormat !== 'json') {
    throw new Error('--format must be table or json');
  }

  return {
    city: getValue('--city') ?? 'Москва',
    test,
    invitroSnapshot: getValue('--invitro-snapshot'),
    format,
  };
}
