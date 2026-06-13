import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  getBasket,
  parseTestList,
} from '../index.js';
import type {
  BasketMode,
  BasketSelectedItem,
  PerTestBasket,
  ProviderBasketOption,
  SingleProviderBasket,
} from '../product-layer.js';

type OutputFormat = 'table' | 'json';

const args = parseArgs(process.argv.slice(2));

if (!args.city || args.tests.length === 0) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers cheapest:basket -- --city "Москва" --tests "Глюкоза,ТТГ,Ферритин" [--mode per-test|single-provider] [--format table|json]');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const output = await getBasket({
  repository,
  city: args.city,
  tests: args.tests,
  mode: args.mode,
});

if (args.format === 'json') {
  console.log(JSON.stringify(output, null, 2));
} else if (output.mode === 'single-provider') {
  printSingleProviderBasketTable(output);
} else {
  printPerTestBasketTable(output);
}

function printPerTestBasketTable(output: PerTestBasket) {
  console.log(`Корзина: ${output.requested_tests.join(', ')}`);
  console.log(`Город: ${output.city}`);
  console.log(`Режим: ${output.mode}`);
  printSelectedRows(output.selected);
  console.log(`TOTAL BASKET: ${output.total_price_rub ?? '-'} RUB`);

  if (output.missing.length > 0) {
    console.log('\nНе найдено:');
    printRows(output.missing.map((item) => ({
      'Анализ': item.test,
      'Причина': item.error,
    })));
  }
}

function printSingleProviderBasketTable(output: SingleProviderBasket) {
  console.log(`Корзина: ${output.requested_tests.join(', ')}`);
  console.log(`Город: ${output.city}`);
  console.log(`Режим: ${output.mode}`);

  const selectedProvider = output.selected_provider;
  if (!selectedProvider) {
    console.log('Нет лаборатории, которая покрывает всю корзину.');
  } else {
    console.log(`Выбрана лаборатория: ${formatProviderName(selectedProvider.provider)}`);
    printSelectedRows(selectedProvider.selected);
    console.log(`TOTAL BASKET: ${selectedProvider.total_price_rub ?? '-'} RUB`);
  }

  console.log('\nВарианты по лабораториям:');
  printProviderOptions(output.provider_options, output.requested_tests.length);
}

function printSelectedRows(selected: BasketSelectedItem[]) {
  printRows(selected.map((item) => ({
    'Анализ': item.test,
    'Лаборатория': item.offer.provider.name,
    'Позиция': item.offer.provider_test_name,
    'Код': item.offer.provider_test_code ?? '-',
    'Анализ цена': formatRub(item.offer.effective_price_rub),
    'Забор': formatRub(item.offer.biomaterial_price_rub),
    'Итого': formatRub(item.offer.total_price_rub),
    'URL': item.offer.source_url ?? '-',
  })));
}

function printProviderOptions(options: ProviderBasketOption[], testsCount: number) {
  printRows(options.map((providerOption) => ({
    'Лаборатория': formatProviderName(providerOption.provider),
    'Итого': formatRub(providerOption.total_price_rub ?? undefined),
    'Покрытие': `${providerOption.selected.length}/${testsCount}`,
    'Не хватает': providerOption.missing.map((item) => item.test).join(', ') || '-',
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

function formatProviderName(provider: { code: string; name?: string }): string {
  return provider.name ?? provider.code;
}

function formatRub(value: number | undefined): string {
  return value === undefined ? '-' : `${value}`;
}

function parseArgs(values: string[]): { city?: string; tests: string[]; mode: BasketMode; format: OutputFormat } {
  const parsed: { city?: string; tests: string[]; mode: BasketMode; format: OutputFormat } = {
    tests: [],
    mode: 'per-test',
    format: 'table',
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--city') {
      parsed.city = values[index + 1];
      index += 1;
    } else if (value === '--tests') {
      parsed.tests = parseTestList(values[index + 1]);
      index += 1;
    } else if (value === '--mode') {
      const mode = values[index + 1];
      if (mode !== 'per-test' && mode !== 'single-provider') {
        throw new Error('--mode must be either per-test or single-provider');
      }
      parsed.mode = mode;
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
