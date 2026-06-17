import {
  buildLocalBasket,
  loadLocalMarketDataset,
  parseTestList,
} from '../index.js';
import type { LocalBasketResult } from '../local-market.js';

type OutputFormat = 'table' | 'json';

const args = parseArgs(process.argv.slice(2));
const dataset = loadLocalMarketDataset({
  city: args.city,
  invitroSnapshotPath: args.invitroSnapshot,
});
const output = buildLocalBasket({
  dataset,
  tests: args.tests,
});

if (args.format === 'json') {
  console.log(JSON.stringify(output, null, 2));
} else {
  printBasket(output);
}

function printBasket(output: LocalBasketResult): void {
  console.log(`Локальная корзина: ${output.requestedTests.join(', ')} / ${output.city}`);
  if (output.selected.length > 0) {
    printRows(output.selected.map((item) => ({
      'Анализ': item.test,
      'Лаборатория': item.offer.providerName,
      'Позиция': item.offer.providerTestName,
      'Цена': formatRub(item.offer.effectivePriceRub),
      'Забор': formatRub(item.offer.biomaterialPriceRub),
      'Итог': formatRub(item.offer.totalPriceRub),
      'Ссылка': item.offer.sourceUrl,
    })));
  }
  console.log(`TOTAL: ${output.totalRub === null ? 'incomplete' : `${output.totalRub} RUB`}`);

  if (output.missing.length > 0) {
    console.log('\nMissing');
    printRows(output.missing.map((item) => ({
      'Анализ': item.test,
      'Причина': item.reason,
    })));
  }
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
  tests: string[];
  invitroSnapshot?: string;
  format: OutputFormat;
} {
  const normalized = values.filter((item) => item !== '--');
  const getValue = (name: string) => {
    const index = normalized.indexOf(name);
    return index === -1 ? undefined : normalized[index + 1];
  };
  const testsValue = getValue('--tests');
  if (!testsValue) {
    throw new Error('Usage: pnpm --filter @labmind/lab-crawlers basket:local -- --tests "Глюкоза,ТТГ,Ферритин" [--format json]');
  }
  const rawFormat = getValue('--format');
  const format: OutputFormat = rawFormat === 'json' ? 'json' : 'table';
  if (rawFormat && rawFormat !== 'table' && rawFormat !== 'json') {
    throw new Error('--format must be table or json');
  }

  return {
    city: getValue('--city') ?? 'Москва',
    tests: parseTestList(testsValue),
    invitroSnapshot: getValue('--invitro-snapshot'),
    format,
  };
}
