import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  getBasketOptimization,
  parseTestList,
} from '../index.js';
import type {
  BasketOptimizationResult,
  BasketRouteOption,
  BasketRouteProviderGroup,
} from '../product-layer.js';

type OutputFormat = 'table' | 'json';

const args = parseArgs(process.argv.slice(2));

if (!args.city || args.tests.length === 0) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers cheapest:basket -- --city "Москва" --tests "Глюкоза,ТТГ,Ферритин" [--provider-penalty-rub 300] [--format table|json]');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const output = await getBasketOptimization({
  repository,
  city: args.city,
  tests: args.tests,
  providerPenaltyRub: args.providerPenaltyRub,
});

if (args.format === 'json') {
  console.log(JSON.stringify(output, null, 2));
} else {
  printBasketOptimization(output);
}

function printBasketOptimization(output: BasketOptimizationResult) {
  console.log(`Корзина: ${output.requested_tests.join(', ')}`);
  console.log(`Город: ${output.city}`);
  console.log(`Route penalty: ${output.provider_penalty_rub} RUB per extra provider`);

  printRouteOption('OPTION A — SINGLE PROVIDER', output.single_provider_option);
  printRouteOption('OPTION B — SPLIT PROVIDERS', output.split_provider_option);

  const singleTotal = output.single_provider_option.total_rub;
  const splitTotal = output.split_provider_option.total_rub;
  const savings = singleTotal !== null && splitTotal !== null ? singleTotal - splitTotal : output.recommendation.savings_rub;

  console.log('\nFINAL RECOMMENDATION');
  printRows([{
    'Best option': formatStrategy(output.recommendation.strategy),
    'Total': formatRub(output.recommendation.total_rub ?? undefined),
    'Savings': formatRub(savings ?? undefined),
    'Route penalty': formatRub(output.recommendation.route_penalty_rub),
    'Why': output.recommendation.why,
  }]);

  if (output.missing.length > 0) {
    console.log('\nMissing');
    printRows(output.missing.map((item) => ({
      'Анализ': item.test,
      'Причина': item.error,
    })));
  }
}

function printRouteOption(title: string, option: BasketRouteOption) {
  console.log(`\n${title}`);

  if (!option.available) {
    console.log('Недоступно для полного набора.');
    if (option.missing.length > 0) {
      printRows(option.missing.map((item) => ({
        'Анализ': item.test,
        'Причина': item.error,
      })));
    }
    return;
  }

  printRows([{
    'Total': formatRub(option.total_rub ?? undefined),
    'Tests': formatRub(option.tests_total_rub ?? undefined),
    'Biomaterial': formatRub(option.biomaterial_total_rub ?? undefined),
    'Providers': String(option.provider_count),
  }]);
  printRows(option.groups.map(formatProviderGroup));
}

function formatProviderGroup(group: BasketRouteProviderGroup): Record<string, string> {
  return {
    'Lab': group.provider.name,
    'Tests': group.items.map((item) => item.test).join(', '),
    'Total': formatRub(group.total_rub),
    'Breakdown': [
      `tests ${formatRub(group.tests_total_rub)}`,
      `biomaterial ${formatRub(group.biomaterial_fee_rub)}`,
    ].join(' + '),
  };
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

function formatStrategy(strategy: string): string {
  if (strategy === 'single_provider') {
    return 'single provider';
  }
  if (strategy === 'split_provider') {
    return 'split providers';
  }
  return 'unavailable';
}

function formatRub(value: number | undefined): string {
  return value === undefined ? '-' : `${value} RUB`;
}

function parseArgs(values: string[]): {
  city?: string;
  tests: string[];
  providerPenaltyRub?: number;
  format: OutputFormat;
} {
  const parsed: {
    city?: string;
    tests: string[];
    providerPenaltyRub?: number;
    format: OutputFormat;
  } = {
    tests: [],
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
    } else if (value === '--provider-penalty-rub') {
      parsed.providerPenaltyRub = Number(values[index + 1]);
      index += 1;
    } else if (value === '--mode') {
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
