export type RawLabTest = {
  providerCode: string;
  externalTestId?: string;
  name: string;
  url: string;
  rawPrice?: string | number;
  rawCity?: string;
  rawBiomaterial?: string;
  rawTurnaroundTime?: string;
  rawPreparation?: string;
};

export type NormalizedLabTest = {
  providerCode: string;
  externalTestId?: string;
  name: string;
  code?: string;
  price?: number;
  regularPrice?: number;
  promoPrice?: number;
  effectivePrice?: number;
  currency?: 'RUB';
  city?: string;
  regionCode?: string;
  biomaterial?: string;
  preparation?: string;
  turnaroundTime?: string;
  offerType?: 'regular' | 'promo' | 'cashback' | 'package' | 'unknown';
  promotionTitle?: string;
  promotionUrl?: string;
  validFrom?: string;
  validTo?: string;
  sourceUrl: string;
  checkedAt: string;
};

export type CrawlQuery = {
  query: string;
  city?: string;
};

export type CrawlRunResult = {
  providerCode: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'partial' | 'failed';
  tests: NormalizedLabTest[];
  errors: string[];
};

export type PriceComparisonRow = {
  code: string;
  name: string;
  city?: string;
  offers: Array<{
    providerCode: string;
    price: number;
    currency: 'RUB';
    regularPrice?: number;
    promoPrice?: number;
    offerType?: NormalizedLabTest['offerType'];
    promotionTitle?: string;
    validFrom?: string;
    validTo?: string;
    sourceUrl: string;
    turnaroundTime?: string;
    biomaterial?: string;
    checkedAt: string;
  }>;
  cheapest?: {
    providerCode: string;
    price: number;
    currency: 'RUB';
  };
};

export interface LabCrawlerAdapter {
  providerCode: string;
  searchTests(query: string, city?: string): Promise<RawLabTest[]>;
  getTestDetails(url: string): Promise<unknown>;
  normalize(raw: unknown): Promise<NormalizedLabTest>;
}

const CANONICAL_TESTS: Array<{ code: string; name: string; aliases: string[] }> = [
  { code: 'GLU', name: 'Глюкоза', aliases: ['глюкоза', 'glucose', 'glu'] },
  { code: 'CHOL', name: 'Холестерин общий', aliases: ['холестерин общий', 'общий холестерин', 'cholesterol total', 'chol'] },
  { code: 'HDL', name: 'ЛПВП', aliases: ['лпвп', 'hdl', 'холестерин лпвп'] },
  { code: 'LDL', name: 'ЛПНП', aliases: ['лпнп', 'ldl', 'холестерин лпнп'] },
  { code: 'TG', name: 'Триглицериды', aliases: ['триглицериды', 'triglycerides', 'tg'] },
  { code: 'ALT', name: 'АЛТ', aliases: ['алт', 'alt', 'аланинаминотрансфераза'] },
  { code: 'AST', name: 'АСТ', aliases: ['аст', 'ast', 'аспартатаминотрансфераза'] },
  { code: 'TSH', name: 'ТТГ', aliases: ['ттг', 'tsh', 'тиреотропный гормон'] },
  { code: 'FER', name: 'Ферритин', aliases: ['ферритин', 'ferritin', 'fer'] },
];

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[()[\]{}.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchCanonicalTest(name: string): { code: string; name: string } | undefined {
  const normalized = normalizeSearchText(name);
  return CANONICAL_TESTS.find((test) => test.aliases.some((alias) => normalized.includes(normalizeSearchText(alias))));
}

export function normalizePrice(value: string | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (!value) {
    return undefined;
  }

  const match = String(value).replace(/\s+/g, '').replace(',', '.').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

export function getEffectivePrice(test: NormalizedLabTest): number | undefined {
  return test.effectivePrice ?? test.promoPrice ?? test.price ?? test.regularPrice;
}

export async function runCrawler(adapter: LabCrawlerAdapter, queries: CrawlQuery[]): Promise<CrawlRunResult> {
  const startedAt = new Date().toISOString();
  const tests: NormalizedLabTest[] = [];
  const errors: string[] = [];

  for (const item of queries) {
    try {
      const rawTests = await adapter.searchTests(item.query, item.city);

      for (const rawTest of rawTests) {
        try {
          const details = await adapter.getTestDetails(rawTest.url);
          const normalized = await adapter.normalize(details);
          tests.push(normalized);
        } catch (error) {
          errors.push(`${adapter.providerCode}:${rawTest.url}:${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      errors.push(`${adapter.providerCode}:${item.query}:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    providerCode: adapter.providerCode,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: errors.length === 0 ? 'success' : tests.length > 0 ? 'partial' : 'failed',
    tests,
    errors,
  };
}

export function comparePrices(tests: NormalizedLabTest[]): PriceComparisonRow[] {
  const groups = new Map<string, NormalizedLabTest[]>();

  for (const test of tests) {
    if (!test.code || getEffectivePrice(test) === undefined) {
      continue;
    }

    const key = `${test.code}:${test.city ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), test]);
  }

  return [...groups.values()]
    .map((items) => {
      const sorted = [...items].sort((a, b) => (getEffectivePrice(a) ?? Number.POSITIVE_INFINITY) - (getEffectivePrice(b) ?? Number.POSITIVE_INFINITY));
      const first = sorted[0];
      const firstPrice = getEffectivePrice(first);
      return {
        code: first.code ?? 'UNKNOWN',
        name: first.name,
        city: first.city,
        offers: sorted.map((item) => ({
          providerCode: item.providerCode,
          price: getEffectivePrice(item) ?? 0,
          currency: item.currency ?? 'RUB',
          regularPrice: item.regularPrice,
          promoPrice: item.promoPrice,
          offerType: item.offerType,
          promotionTitle: item.promotionTitle,
          validFrom: item.validFrom,
          validTo: item.validTo,
          sourceUrl: item.sourceUrl,
          turnaroundTime: item.turnaroundTime,
          biomaterial: item.biomaterial,
          checkedAt: item.checkedAt,
        })),
        cheapest: firstPrice === undefined ? undefined : {
          providerCode: first.providerCode,
          price: firstPrice,
          currency: first.currency ?? 'RUB',
        },
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

function sqlString(value: string | undefined): string {
  return value === undefined ? 'null' : `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number | undefined): string {
  return value === undefined ? 'null' : String(value);
}

export function renderPriceSnapshotSql(tests: NormalizedLabTest[]): string {
  const statements = tests.map((test) => {
    const externalId = test.externalTestId ?? `${test.providerCode}:${test.code ?? normalizeSearchText(test.name)}`;
    const effectivePrice = getEffectivePrice(test);
    return `with provider as (
  select id from public.lab_providers where code = ${sqlString(test.providerCode)}
), catalog_item as (
  select id from public.test_catalog_items where code = ${sqlString(test.code)}
), upsert_test as (
  insert into public.lab_tests (provider_id, catalog_item_id, external_test_id, name, code, kind, category, source_url)
  select provider.id, catalog_item.id, ${sqlString(externalId)}, ${sqlString(test.name)}, ${sqlString(test.code)}, 'analyte', null, ${sqlString(test.sourceUrl)}
  from provider
  left join catalog_item on true
  on conflict (provider_id, external_test_id) do update
  set name = excluded.name,
      code = excluded.code,
      catalog_item_id = excluded.catalog_item_id,
      source_url = excluded.source_url
  returning id
)
insert into public.lab_price_snapshots (
  lab_test_id,
  city,
  region_code,
  price,
  regular_price,
  promo_price,
  effective_price,
  currency,
  offer_type,
  promotion_title,
  promotion_url,
  valid_from,
  valid_to,
  turnaround_time,
  biomaterial,
  preparation,
  checked_at,
  raw_json
)
select
  upsert_test.id,
  ${sqlString(test.city)},
  ${sqlString(test.regionCode)},
  ${sqlNumber(effectivePrice)},
  ${sqlNumber(test.regularPrice ?? test.price)},
  ${sqlNumber(test.promoPrice)},
  ${sqlNumber(effectivePrice)},
  ${sqlString(test.currency ?? 'RUB')},
  ${sqlString(test.offerType ?? (test.promoPrice === undefined ? 'regular' : 'promo'))},
  ${sqlString(test.promotionTitle)},
  ${sqlString(test.promotionUrl)},
  ${sqlString(test.validFrom)}::date,
  ${sqlString(test.validTo)}::date,
  ${sqlString(test.turnaroundTime)},
  ${sqlString(test.biomaterial)},
  ${sqlString(test.preparation)},
  ${sqlString(test.checkedAt)}::timestamptz,
  ${sqlString(JSON.stringify(test))}::jsonb
from upsert_test;`;
  });

  return statements.join('\n\n');
}

export { createFixtureLabAdapter, fixtureLabAdapters, mockLabAdapter } from './adapters/mock.adapter.js';
export {
  autoMatchProviderTests,
  compareProviderPrices,
  DEFAULT_CANONICAL_TESTS,
  matchProviderTestToCanonical,
  type CanonicalMatchResult,
  type ProviderPriceComparisonRow,
} from './catalog-comparison.js';
export { DnkomScraper } from './adapters/dnkom.scraper.js';
export { DnkomLiveScraper } from './adapters/dnkom-live.scraper.js';
export {
  DNKOM_ACTIONS_URL,
  DNKOM_BASE_URL,
  DNKOM_CATALOG_URL,
  extractDnkomCurrentCity,
  parseDnkomActionDetailHtml,
  parseDnkomActionLinks,
  parseDnkomActionsHtml,
  parseDnkomCatalogDetailHtml,
  parseDnkomCatalogHtml,
  parseDnkomCatalogLinks,
  parseDnkomNextCatalogPageUrl,
  parseDnkomProductInfo,
  type DnkomActionsParseResult,
  type DnkomCatalogParseResult,
  type DnkomProductInfo,
} from './adapters/dnkom.parser.js';
export { GemotestScraper } from './adapters/gemotest.scraper.js';
export { GemotestLiveScraper } from './adapters/gemotest-live.scraper.js';
export {
  GEMOTEST_BASE_URL,
  GEMOTEST_MOSCOW_CATALOG_SECTION_URLS,
  GEMOTEST_MOSCOW_CATALOG_URL,
  parseGemotestCatalogHtml,
  parseGemotestProductCard,
  type GemotestCatalogParseResult,
  type GemotestProductCard,
} from './adapters/gemotest.parser.js';
export { InvitroScraper } from './adapters/invitro.scraper.js';
export type {
  CanonicalTestKind,
  CanonicalTestRecord,
  LabPromotionItemRecord,
  LabPromotionRecord,
  LabProviderRecord,
  LabRegionRecord,
  MoneyRub,
  ProviderCode,
  ProviderRegionProbeResult,
  ProviderTestMatchStatus,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from './catalog-types.js';
export {
  effectivePriceRub,
  normalizeProviderName,
  toRubles,
  type CatalogSyncResult,
  type ProviderScraper,
  type PromotionSyncResult,
  type ScraperContext,
} from './provider-scraper.js';
export {
  buildCrawlerTransport,
  createProviderAdapter,
  resolveProviderRegion,
  type CrawlerProviderKey,
  type CrawlerTransport,
  type ProviderAdapter,
} from './crawler-adapters.js';
export {
  CrawlerRunner,
  sanitizeCrawlerPayload,
  type CrawlerProviderRunReport,
  type CrawlerRunMode,
  type CrawlerRunProviderInput,
  type CrawlerRunnerInput,
  type CrawlerRunReport,
} from './crawler-runner.js';
export {
  DEFAULT_PRODUCT_TESTS,
  getBasket,
  getBasketOptimization,
  getCompareMatrix,
  getMarketSummary,
  getQualityReport,
  parseTestList,
  type BasketMode,
  type BasketCostMatrixRow,
  type BasketOptimizationRecommendation,
  type BasketOptimizationResult,
  type BasketRouteItem,
  type BasketRouteOption,
  type BasketRouteProviderGroup,
  type BasketMissingItem,
  type BasketSelectedItem,
  type PerTestBasket,
  type ProductCompareMatrix,
  type ProductCompareRow,
  type ProductMarketSummary,
  type ProductQualityReport,
  type ProductOffer,
  type ProductProviderGroup,
  type ProviderBasketOption,
  type SingleProviderBasket,
} from './product-layer.js';
export { createLabCrawlerSupabaseClient, type LabCrawlerSupabaseClient } from './supabase-client.js';
export {
  LabCatalogRepository,
  type DbCanonicalPriceComparison,
  type DbManualMatchResult,
  type DbPriceComparisonOffer,
  type DbProviderTestMatchCandidate,
  type DbProviderTestMatchQueueItem,
  type DbProviderTestMatchResult,
  type DbScraperRunListItem,
  type DbUnmatchedProviderTestSuggestion,
  type PriceInsertResult,
  type ProviderRegionIds,
  type ScraperRunResult,
  type UpsertResult,
} from './supabase-lab-catalog.repository.js';
