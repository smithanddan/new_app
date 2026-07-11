import { chromium } from 'playwright';
import type { Page } from 'playwright';
import {
  INVITRO_BASE_URL,
  parseInvitroApiCatalogJson,
} from '../adapters/invitro.parser.js';

type OutputFormat = 'json' | 'table';
type SearchKind = 'analysis' | 'profile';

type Args = {
  query: string;
  city: string;
  format: OutputFormat;
  limit: number;
};

type SearchPreviewItem = {
  uuid?: string;
  title?: string;
  bitrixId?: string;
  categoryBitrixId?: string;
  subcategoryBitrixId?: string;
};

type SearchPreviewGroup = {
  key?: string;
  title?: string;
  total?: number;
  items?: SearchPreviewItem[];
};

type SearchPreviewPayload = {
  groups?: SearchPreviewGroup[];
  searchButton?: string;
};

type SearchIdsPayload = {
  group?: string;
  ids?: string[];
};

type SearchResultRef = {
  kind: SearchKind;
  uuid: string;
  title?: string;
  bitrixId?: string;
};

type EnrichedSearchItem = {
  kind: SearchKind;
  uuid: string;
  title: string;
  bitrixId?: string;
  providerTestCode?: string;
  providerTestName?: string;
  regularPriceRub?: number;
  effectivePriceRub?: number;
  biomaterialPriceRub?: number;
  biomaterial?: string;
  preparation?: string;
  turnaroundTime?: string;
  offerType?: string;
  specialConditions: string[];
  sourceUrl?: string;
  detailEndpoint: string;
};

const args = parseArgs(process.argv.slice(2));
const report = await searchInvitro(args);

if (args.format === 'json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  printTable(report);
}

async function searchInvitro(args: Args) {
  const cityId = resolveCityId(args.city);
  const fetchedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 lab-crawlers-invitro-search/1.0',
    });
    await page.goto(`${INVITRO_BASE_URL}/analizes`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1_500);

    const encodedQuery = encodeURIComponent(args.query);
    const previewEndpoint = `/golk/search/api/v1/search/preview?q=${encodedQuery}&cityId=${cityId}`;
    const suggestionsEndpoint = `/golk/search/api/v1/search/suggestions?q=${encodedQuery}&limit=20`;
    const analysesEndpoint = `/golk/search/api/v1/search/analyses?q=${encodedQuery}&cityId=${cityId}`;
    const complexesEndpoint = `/golk/search/api/v1/search/complexes?q=${encodedQuery}&cityId=${cityId}`;
    const preview = await fetchJson<SearchPreviewPayload>(page, previewEndpoint);
    const suggestions = await fetchJson<Array<{ hint?: string }>>(page, suggestionsEndpoint);
    const analyses = await fetchJson<SearchIdsPayload>(page, analysesEndpoint);
    const complexes = await fetchJson<SearchIdsPayload>(page, complexesEndpoint);
    const detailLimit = Math.min(Math.max(args.limit * 3, 10), 25);
    const searchRefs = buildSearchRefs(preview, analyses.ids ?? [], complexes.ids ?? [], detailLimit);

    const enriched: EnrichedSearchItem[] = [];
    for (const item of searchRefs) {
      const detail = await fetchDetail(page, item, cityId);
      if (detail) {
        enriched.push(detail);
      }
    }
    const rankedItems = rankSearchItems(enriched, args.query).slice(0, args.limit);

    return {
      provider: 'invitro',
      city: args.city,
      cityId,
      query: args.query,
      mode: 'search',
      fetchedAt,
      endpoints: {
        preview: `${INVITRO_BASE_URL}${previewEndpoint}`,
        suggestions: `${INVITRO_BASE_URL}${suggestionsEndpoint}`,
        analyses: `${INVITRO_BASE_URL}${analysesEndpoint}`,
        complexes: `${INVITRO_BASE_URL}${complexesEndpoint}`,
      },
      suggestions: suggestions.map((item) => item.hint).filter((hint): hint is string => !!hint),
      previewTotals: preview.groups?.map((group) => ({
        key: group.key,
        title: group.title,
        total: group.total ?? 0,
        returned: group.items?.length ?? 0,
      })) ?? [],
      ids: {
        analyses: analyses.ids ?? [],
        complexes: complexes.ids ?? [],
      },
      items: rankedItems,
    };
  } finally {
    await browser.close();
  }
}

function rankSearchItems(items: EnrichedSearchItem[], query: string): EnrichedSearchItem[] {
  const normalizedQuery = normalizeSearchText(query);
  return [...items].sort((left, right) => {
    const leftScore = searchRelevanceScore(left, normalizedQuery);
    const rightScore = searchRelevanceScore(right, normalizedQuery);
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return (left.effectivePriceRub ?? Number.POSITIVE_INFINITY) - (right.effectivePriceRub ?? Number.POSITIVE_INFINITY);
  });
}

function searchRelevanceScore(item: EnrichedSearchItem, normalizedQuery: string): number {
  const name = normalizeSearchText(item.providerTestName ?? item.title);
  let score = item.kind === 'profile' ? 20 : 0;
  if (name === normalizedQuery) {
    return score;
  }
  if (name.startsWith(`${normalizedQuery} `) || name.startsWith(`${normalizedQuery} (`)) {
    return score + 1;
  }
  if (name.includes(normalizedQuery)) {
    return score + 5;
  }
  return score + 10;
}

function buildSearchRefs(
  preview: SearchPreviewPayload,
  analysisIds: string[],
  complexIds: string[],
  limit: number,
): SearchResultRef[] {
  const previewByUuid = new Map(
    extractPreviewItems(preview, Number.POSITIVE_INFINITY).map((item) => [item.uuid, item]),
  );
  const refs = [
    ...analysisIds.map((uuid) => ({ uuid, kind: 'analysis' as const })),
    ...complexIds.map((uuid) => ({ uuid, kind: 'profile' as const })),
  ];

  return refs.slice(0, limit).map((ref) => {
    const previewItem = previewByUuid.get(ref.uuid);
    return {
      ...ref,
      title: previewItem?.title,
      bitrixId: previewItem?.bitrixId,
    };
  });
}

function extractPreviewItems(payload: SearchPreviewPayload, limit: number): SearchResultRef[] {
  const groups = payload.groups ?? [];
  const analyses = extractGroupItems(groups, 'analyses', 'analysis');
  const complexes = extractGroupItems(groups, 'complexes', 'profile');
  return [...analyses, ...complexes].slice(0, limit);
}

function extractGroupItems(
  groups: SearchPreviewGroup[],
  groupKey: 'analyses' | 'complexes',
  kind: SearchKind,
): SearchResultRef[] {
  const group = groups.find((item) => item.key === groupKey);
  return (group?.items ?? [])
    .filter((item) => item.uuid && item.title)
    .map((item) => ({
      uuid: item.uuid ?? '',
      kind,
      title: item.title,
      bitrixId: item.bitrixId,
    }));
}

async function fetchDetail(
  page: Page,
  item: SearchResultRef,
  cityId: string,
): Promise<EnrichedSearchItem | undefined> {
  if (!item.uuid) {
    return undefined;
  }

  const endpointKind = item.kind === 'profile' ? 'complexes' : 'tests';
  const detailEndpoint = `/golk/tests/api/v1/${endpointKind}/${item.uuid}?cityID=${cityId}`;
  const payload = await fetchJson<unknown>(page, detailEndpoint);
  const context = {
    providerCode: 'invitro',
    region: {
      code: 'moscow',
      city: 'Москва',
      urlPrefix: '/moscow',
      providerCityId: cityId,
    },
  } as const;
  const parsed = parseInvitroApiCatalogJson(payload, context, {
    sourceUrl: `${INVITRO_BASE_URL}${detailEndpoint}`,
    defaultKind: item.kind === 'profile' ? 'profile' : 'analysis',
  });
  const test = parsed.tests[0];
  const price = parsed.prices[0];

  return {
    kind: item.kind,
    uuid: item.uuid,
    title: test?.name ?? item.title ?? item.uuid,
    bitrixId: item.bitrixId,
    providerTestCode: test?.externalCode,
    providerTestName: test?.name,
    regularPriceRub: price?.regularPriceRub,
    effectivePriceRub: price?.effectivePriceRub,
    biomaterialPriceRub: price?.biomaterialPriceRub,
    biomaterial: test?.biomaterial,
    preparation: test?.preparation,
    turnaroundTime: test?.turnaroundTime,
    offerType: price?.offerType,
    specialConditions: buildSpecialConditions(test, price),
    sourceUrl: test?.sourceUrl,
    detailEndpoint: `${INVITRO_BASE_URL}${detailEndpoint}`,
  };
}

function buildSpecialConditions(
  test: ReturnType<typeof parseInvitroApiCatalogJson>['tests'][number] | undefined,
  price: ReturnType<typeof parseInvitroApiCatalogJson>['prices'][number] | undefined,
): string[] {
  const conditions: string[] = [];

  if (test?.biomaterial) {
    conditions.push(`Биоматериал: ${test.biomaterial}`);
  }
  if (price?.biomaterialPriceRub !== undefined && price.biomaterialPriceRub > 0) {
    conditions.push(`Забор биоматериала: ${price.biomaterialPriceRub} RUB`);
  }
  if (test?.turnaroundTime) {
    conditions.push(`Срок: ${test.turnaroundTime}`);
  }
  if (test?.preparation) {
    conditions.push(`Подготовка: ${test.preparation}`);
  }
  if (price?.promoPriceRub !== undefined || price?.offerType === 'promo') {
    conditions.push('Акционная цена');
  }
  if (price?.validFrom || price?.validTo) {
    conditions.push(`Период действия: ${price.validFrom ?? 'сейчас'} - ${price.validTo ?? 'не указан'}`);
  }

  return [...new Set(conditions)];
}

async function fetchJson<T>(page: Page, endpoint: string): Promise<T> {
  return page.evaluate(async (path) => {
    const response = await fetch(path, { headers: { accept: 'application/json' } });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`INVITRO search endpoint ${path} failed with ${response.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as T;
  }, endpoint);
}

function resolveCityId(city: string): string {
  return city === 'moscow' || city === 'moskva' || city === 'Москва'
    ? 'f1c3c4f0-3426-4cda-8449-e5d326e02f97'
    : city;
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[()[\]{}.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function printTable(report: Awaited<ReturnType<typeof searchInvitro>>): void {
  console.log(`INVITRO search / ${report.city} / "${report.query}"`);
  console.log(`cityId: ${report.cityId}`);
  console.log('\nSuggestions:');
  console.log(report.suggestions.slice(0, 5).join('\n') || 'none');
  console.log('\nPreview totals:');
  console.table(report.previewTotals);
  console.log('\nItems:');
  console.table(report.items.map((item) => ({
    kind: item.kind,
    code: item.providerTestCode,
    name: item.providerTestName ?? item.title,
    regular: item.regularPriceRub,
    biomaterial: item.biomaterialPriceRub ?? 0,
    total: (item.effectivePriceRub ?? 0) + (item.biomaterialPriceRub ?? 0),
    conditions: item.specialConditions.join('; '),
    url: item.sourceUrl,
  })));
}

function parseArgs(values: string[]): Args {
  const normalized = values.filter((item) => item !== '--');
  const getValue = (name: string) => {
    const index = normalized.indexOf(name);
    return index === -1 ? undefined : normalized[index + 1];
  };
  const positional = normalized.find((value, index) => !value.startsWith('--') && !normalized[index - 1]?.startsWith('--'));
  const query = getValue('--query') ?? positional;
  if (!query) {
    throw new Error('Usage: pnpm --filter @labmind/lab-crawlers invitro:search -- --query "ферритин" [--city moscow] [--format json] [--limit 10]');
  }

  const limit = Number(getValue('--limit') ?? 10);
  return {
    query,
    city: getValue('--city') ?? 'moscow',
    format: getValue('--format') === 'json' ? 'json' : 'table',
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
  };
}
