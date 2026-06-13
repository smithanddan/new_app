import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
} from '../index.js';

type BasketMode = 'per-test' | 'single-provider';
type OutputFormat = 'table' | 'json';
type Comparison = Awaited<ReturnType<LabCatalogRepository['compareCanonicalTestPricesFromDb']>>;
type Offer = Comparison['offers'][number];
type BasketComparison = {
  test: string;
  canonical_test: Comparison['canonical_test'] | null;
  offers: Offer[];
  error?: string;
};

const args = parseArgs(process.argv.slice(2));

if (!args.city || args.tests.length === 0) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers cheapest:basket -- --city "Москва" --tests "Глюкоза,ТТГ,Ферритин" [--mode per-test|single-provider] [--format table|json]');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const comparisons: BasketComparison[] = [];

for (const testSearch of args.tests) {
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

  const comparison = await repository.compareCanonicalTestPricesFromDb(canonical.id, args.city);
  comparisons.push({
    test: testSearch,
    canonical_test: comparison.canonical_test,
    offers: comparison.offers.filter((offer) => offer.total_price_rub !== undefined),
  });
}

if (args.mode === 'single-provider') {
  const output = {
    city: args.city,
    mode: 'single-provider' as const,
    requested_tests: args.tests,
    ...buildSingleProviderBasket(comparisons),
  };

  if (args.format === 'json') {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printSingleProviderBasketTable(output);
  }
} else {
  const output = {
    city: args.city,
    mode: 'per-test' as const,
    requested_tests: args.tests,
    ...buildPerTestBasket(comparisons),
  };

  if (args.format === 'json') {
    console.log(JSON.stringify(output, null, 2));
  } else {
    printPerTestBasketTable(output);
  }
}

function buildPerTestBasket(comparisons: BasketComparison[]) {
  const selected = comparisons
    .map((comparison) => {
      const cheapest = comparison.offers[0];
      return cheapest ? {
        test: comparison.test,
        canonical_test: comparison.canonical_test,
        offer: summarizeOffer(cheapest),
      } : undefined;
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  const missing = comparisons
    .filter((comparison) => comparison.offers.length === 0)
    .map((comparison) => ({
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

  const providerOptions = [...providerKeys].map((providerCode) => {
    const selected = comparisons
      .map((comparison) => {
        const offer = comparison.offers
          .filter((candidate) => candidate.provider.code === providerCode)
          .sort((a, b) => (a.total_price_rub ?? Number.POSITIVE_INFINITY) - (b.total_price_rub ?? Number.POSITIVE_INFINITY))[0];

        return offer ? {
          test: comparison.test,
          canonical_test: comparison.canonical_test,
          offer: summarizeOffer(offer),
        } : undefined;
      })
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
    const missing = comparisons
      .filter((comparison) => !comparison.offers.some((offer) => offer.provider.code === providerCode))
      .map((comparison) => ({
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

function summarizeOffer(offer: Offer) {
  return {
    provider: offer.provider,
    region: offer.region,
    provider_test_name: offer.provider_test_name,
    provider_test_code: offer.provider_test_code,
    offer_type: offer.offer_type,
    offer_source: offer.offer_source,
    regular_price_rub: offer.regular_price_rub,
    promo_price_rub: offer.promo_price_rub,
    effective_price_rub: offer.effective_price_rub,
    biomaterial_price_rub: offer.biomaterial_price_rub,
    total_price_rub: offer.total_price_rub,
    source_url: offer.source_url,
    fetched_at: offer.fetched_at,
  };
}

function printPerTestBasketTable(output: ReturnType<typeof buildPerTestBasket> & {
  city: string;
  mode: 'per-test';
  requested_tests: string[];
}) {
  console.log(`Корзина: ${output.requested_tests.join(', ')}`);
  console.log(`Город: ${output.city}`);
  console.log(`Режим: ${output.mode}`);

  console.log(`Итого: ${formatRub(output.total_price_rub ?? undefined)}`);
  printSelectedRows(output.selected);

  if (output.missing.length > 0) {
    console.log('\nНе найдено:');
    printRows(output.missing.map((item) => ({
      'Анализ': item.test,
      'Причина': item.error,
    })));
  }
}

function printSingleProviderBasketTable(output: ReturnType<typeof buildSingleProviderBasket> & {
  city: string;
  mode: 'single-provider';
  requested_tests: string[];
}) {
  console.log(`Корзина: ${output.requested_tests.join(', ')}`);
  console.log(`Город: ${output.city}`);
  console.log(`Режим: ${output.mode}`);

  const selectedProvider = output.selected_provider;
  if (!selectedProvider) {
    console.log('Нет лаборатории, которая покрывает всю корзину.');
  } else {
    console.log(`Выбрана лаборатория: ${selectedProvider.provider.name ?? selectedProvider.provider.code}`);
    console.log(`Итого: ${formatRub(selectedProvider.total_price_rub ?? undefined)}`);
    printSelectedRows(selectedProvider.selected);
  }

  const alternatives = output.provider_options.map((providerOption) => ({
    'Лаборатория': providerOption.provider.name ?? providerOption.provider.code,
    'Итого': formatRub(providerOption.total_price_rub ?? undefined),
    'Покрытие': `${providerOption.selected.length}/${output.requested_tests.length}`,
    'Не хватает': providerOption.missing.map((item) => item.test).join(', ') || '-',
  }));
  console.log('\nВарианты по лабораториям:');
  printRows(alternatives);
}

function printSelectedRows(selected: ReturnType<typeof buildPerTestBasket>['selected']) {
  printRows(selected.map((item) => ({
    'Анализ': item.test,
    'Лаборатория': item.offer.provider.name,
    'Позиция': item.offer.provider_test_name,
    'Код': item.offer.provider_test_code ?? '-',
    'Обычная': formatRub(item.offer.regular_price_rub),
    'Акция': formatRub(item.offer.promo_price_rub),
    'Забор': formatRub(item.offer.biomaterial_price_rub),
    'Итого': formatRub(item.offer.total_price_rub),
    'URL': item.offer.source_url ?? '-',
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
  return value === undefined ? '-' : `${value} ₽`;
}

function sumTotals(offers: Array<{ total_price_rub?: number }>): number | null {
  if (offers.some((offer) => offer.total_price_rub === undefined)) {
    return null;
  }

  return offers.reduce((sum, offer) => sum + (offer.total_price_rub ?? 0), 0);
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
      parsed.tests = values[index + 1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
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
