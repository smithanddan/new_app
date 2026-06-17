import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CanonicalTestRecord,
  LabPromotionItemRecord,
  LabPromotionRecord,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from './catalog-types.js';
import {
  DEFAULT_CANONICAL_TESTS,
  autoMatchProviderTests,
  matchProviderTestToCanonical,
} from './catalog-comparison.js';
import {
  DNKOM_ACTIONS_URL,
  parseDnkomActionsHtml,
  parseDnkomCatalogHtml,
} from './adapters/dnkom.parser.js';
import { parseGemotestCatalogHtml } from './adapters/gemotest.parser.js';
import {
  parseInvitroApiCatalogJson,
  parseInvitroApiPromotionsJson,
} from './adapters/invitro.parser.js';
import { effectivePriceRub, normalizeProviderName, type ScraperContext } from './provider-scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

export type LocalMarketSnapshot = {
  provider: string;
  region: string;
  city: string;
  fetchedAt: string;
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  promotions: LabPromotionRecord[];
  promotionItems: LabPromotionItemRecord[];
  rawPayload?: unknown;
};

export type LocalMarketDataset = {
  city: string;
  snapshots: LocalMarketSnapshot[];
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  promotions: LabPromotionRecord[];
  promotionItems: LabPromotionItemRecord[];
};

export type LocalOffer = {
  canonicalCode: string;
  canonicalName: string;
  providerCode: string;
  providerName: string;
  providerTestName: string;
  providerTestCode?: string;
  regularPriceRub?: number;
  promoPriceRub?: number;
  effectivePriceRub: number;
  biomaterialPriceRub: number;
  totalPriceRub: number;
  offerType: ProviderTestPriceRecord['offerType'];
  sourceUrl: string;
  fetchedAt: string;
};

export type LocalCompareResult = {
  city: string;
  test: string;
  canonicalTest: CanonicalTestRecord | null;
  offers: LocalOffer[];
  unmatched: ProviderTestRecord[];
};

export type LocalBasketResult = {
  city: string;
  requestedTests: string[];
  selected: Array<{
    test: string;
    offer: LocalOffer;
  }>;
  totalRub: number | null;
  missing: Array<{
    test: string;
    reason: 'canonical_test_not_found' | 'no_offers';
  }>;
};

export function getDefaultInvitroSnapshotPath(city = 'moscow'): string {
  return path.join(packageRoot, 'fixtures/invitro', `snapshot-${city}-latest.json`);
}

export function loadLocalMarketDataset(input: {
  city?: string;
  invitroSnapshotPath?: string;
  includeFixtures?: boolean;
} = {}): LocalMarketDataset {
  const city = input.city ?? 'Москва';
  const includeFixtures = input.includeFixtures ?? true;
  const snapshots: LocalMarketSnapshot[] = [];

  if (includeFixtures) {
    snapshots.push(loadDnkomFixtureSnapshot());
    snapshots.push(loadGemotestFixtureSnapshot());
  }

  const invitroSnapshotPath = input.invitroSnapshotPath ?? getDefaultInvitroSnapshotPath('moscow');
  if (fs.existsSync(invitroSnapshotPath)) {
    snapshots.push(readJsonFile<LocalMarketSnapshot>(invitroSnapshotPath));
  } else if (includeFixtures) {
    snapshots.push(loadInvitroApiFixtureSnapshot());
  }

  const tests = autoMatchProviderTests(snapshots.flatMap((snapshot) => snapshot.tests), DEFAULT_CANONICAL_TESTS);
  return {
    city,
    snapshots,
    tests,
    prices: snapshots.flatMap((snapshot) => snapshot.prices),
    promotions: snapshots.flatMap((snapshot) => snapshot.promotions),
    promotionItems: snapshots.flatMap((snapshot) => snapshot.promotionItems),
  };
}

export function compareLocalMarket(input: {
  dataset: LocalMarketDataset;
  test: string;
  canonicalTests?: CanonicalTestRecord[];
}): LocalCompareResult {
  const canonicalTests = input.canonicalTests ?? DEFAULT_CANONICAL_TESTS;
  const canonicalTest = resolveCanonicalTest(input.test, canonicalTests);
  if (!canonicalTest) {
    return {
      city: input.dataset.city,
      test: input.test,
      canonicalTest: null,
      offers: [],
      unmatched: input.dataset.tests,
    };
  }

  const matchedTests = input.dataset.tests.filter((test) => test.canonicalCode === canonicalTest.code);
  const testByPriceKey = buildTestLookup(matchedTests);
  const offers = dedupeLocalOffers(input.dataset.prices
    .map((price) => {
      const test = findTestForPrice(price, testByPriceKey);
      if (!test) {
        return undefined;
      }

      return mapLocalOffer(canonicalTest, test, price);
    })
    .filter((offer): offer is LocalOffer => offer !== undefined))
    .sort((a, b) => a.totalPriceRub - b.totalPriceRub || a.effectivePriceRub - b.effectivePriceRub);

  return {
    city: input.dataset.city,
    test: input.test,
    canonicalTest,
    offers,
    unmatched: input.dataset.tests.filter((test) => !test.canonicalCode),
  };
}

export function buildLocalBasket(input: {
  dataset: LocalMarketDataset;
  tests: string[];
}): LocalBasketResult {
  const selected: LocalBasketResult['selected'] = [];
  const missing: LocalBasketResult['missing'] = [];

  for (const test of input.tests) {
    const comparison = compareLocalMarket({ dataset: input.dataset, test });
    if (!comparison.canonicalTest) {
      missing.push({ test, reason: 'canonical_test_not_found' });
      continue;
    }
    const cheapest = comparison.offers[0];
    if (!cheapest) {
      missing.push({ test, reason: 'no_offers' });
      continue;
    }
    selected.push({ test: comparison.canonicalTest.nameRu, offer: cheapest });
  }

  return {
    city: input.dataset.city,
    requestedTests: input.tests,
    selected,
    totalRub: missing.length > 0 ? null : selected.reduce((sum, item) => sum + item.offer.totalPriceRub, 0),
    missing,
  };
}

export function writeLocalMarketSnapshot(filePath: string, snapshot: LocalMarketSnapshot): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

function loadDnkomFixtureSnapshot(): LocalMarketSnapshot {
  const fetchedAt = '2026-06-11T00:00:00.000Z';
  const context = createContext('dnkom', 'moscow', fetchedAt);
  const fixturesDir = path.join(packageRoot, 'fixtures/dnkom');
  const catalog = parseDnkomCatalogHtml(readText(path.join(fixturesDir, 'catalog-live.html')), context, {
    fetchedAt,
    maxItems: 25,
  });
  const actionDetailUrl = `${DNKOM_ACTIONS_URL}biokhimiya_krovi/`;
  const actions = parseDnkomActionsHtml(readText(path.join(fixturesDir, 'actions-live.html')), context, {
    fetchedAt,
    maxItems: 8,
    detailHtmlByUrl: {
      [actionDetailUrl]: readText(path.join(fixturesDir, 'action-biochemistry.html')),
    },
  });

  return {
    provider: 'dnkom',
    region: 'moscow',
    city: 'Москва',
    fetchedAt,
    tests: catalog.tests,
    prices: catalog.prices,
    promotions: actions.promotions,
    promotionItems: actions.promotionItems,
  };
}

function loadGemotestFixtureSnapshot(): LocalMarketSnapshot {
  const fetchedAt = '2026-06-12T00:00:00.000Z';
  const context = createContext('gemotest', 'moskva', fetchedAt, '/moskva');
  const catalog = parseGemotestCatalogHtml(
    readText(path.join(packageRoot, 'fixtures/gemotest/catalog-moskva.html')),
    context,
    { fetchedAt, maxItems: 20 },
  );

  return {
    provider: 'gemotest',
    region: 'moskva',
    city: 'Москва',
    fetchedAt,
    tests: catalog.tests,
    prices: catalog.prices,
    promotions: [],
    promotionItems: [],
  };
}

function loadInvitroApiFixtureSnapshot(): LocalMarketSnapshot {
  const fetchedAt = '2026-06-16T00:00:00.000Z';
  const context = createContext('invitro', 'moscow', fetchedAt, '/moscow');
  const fixturesDir = path.join(packageRoot, 'fixtures/invitro');
  const popular = parseInvitroApiCatalogJson(readJsonFile(path.join(fixturesDir, 'api-popular.json')), context, { fetchedAt });
  const tests = parseInvitroApiCatalogJson(readJsonFile(path.join(fixturesDir, 'api-tests-page-1.json')), context, { fetchedAt });
  const complexes = parseInvitroApiCatalogJson(readJsonFile(path.join(fixturesDir, 'api-complexes-page-1.json')), context, {
    fetchedAt,
    defaultKind: 'profile',
  });
  const promotions = parseInvitroApiPromotionsJson(readJsonFile(path.join(fixturesDir, 'api-promotions-home.json')), context, { fetchedAt });

  return {
    provider: 'invitro',
    region: 'moscow',
    city: 'Москва',
    fetchedAt,
    tests: [...popular.tests, ...tests.tests, ...complexes.tests],
    prices: [...popular.prices, ...tests.prices, ...complexes.prices],
    promotions: promotions.promotions,
    promotionItems: [],
  };
}

function createContext(providerCode: string, regionCode: string, fetchedAt: string, urlPrefix?: string): ScraperContext {
  return {
    providerCode,
    fetchedAt,
    region: {
      code: regionCode,
      city: 'Москва',
      urlPrefix,
    },
  };
}

function resolveCanonicalTest(name: string, canonicalTests: CanonicalTestRecord[]): CanonicalTestRecord | undefined {
  const normalized = normalizeProviderName(name);
  return canonicalTests.find((test) => {
    const aliases = [test.code, test.nameRu, test.nameEn ?? '', ...test.aliases].filter(Boolean);
    return aliases.some((alias) => normalizeProviderName(alias) === normalized);
  }) ?? canonicalTests.find((test) => matchProviderTestToCanonical({
    providerCode: 'local',
    name,
    kind: 'analysis',
    sourceUrl: '',
    matchStatus: 'unmatched',
    fetchedAt: new Date().toISOString(),
    rawPayload: {},
  }, [test]).canonicalCode === test.code);
}

function buildTestLookup(tests: ProviderTestRecord[]): Map<string, ProviderTestRecord> {
  const lookup = new Map<string, ProviderTestRecord>();
  for (const test of tests) {
    if (test.externalId) {
      lookup.set(`${test.providerCode}:id:${test.externalId}`, test);
    }
    if (test.externalCode) {
      lookup.set(`${test.providerCode}:code:${test.externalCode}`, test);
    }
    lookup.set(`${test.providerCode}:url:${test.sourceUrl}`, test);
  }
  return lookup;
}

function findTestForPrice(price: ProviderTestPriceRecord, lookup: Map<string, ProviderTestRecord>): ProviderTestRecord | undefined {
  return (price.externalId ? lookup.get(`${price.providerCode}:id:${price.externalId}`) : undefined)
    ?? (price.externalCode ? lookup.get(`${price.providerCode}:code:${price.externalCode}`) : undefined)
    ?? lookup.get(`${price.providerCode}:url:${price.sourceUrl}`);
}

function mapLocalOffer(
  canonicalTest: CanonicalTestRecord,
  test: ProviderTestRecord,
  price: ProviderTestPriceRecord,
): LocalOffer | undefined {
  const resolvedPrice = effectivePriceRub(price);
  if (resolvedPrice === undefined) {
    return undefined;
  }
  const biomaterialPriceRub = price.biomaterialPriceRub ?? 0;

  return {
    canonicalCode: canonicalTest.code,
    canonicalName: canonicalTest.nameRu,
    providerCode: price.providerCode,
    providerName: formatProviderName(price.providerCode),
    providerTestName: test.name,
    providerTestCode: test.externalCode,
    regularPriceRub: price.regularPriceRub,
    promoPriceRub: price.promoPriceRub,
    effectivePriceRub: resolvedPrice,
    biomaterialPriceRub,
    totalPriceRub: resolvedPrice + biomaterialPriceRub,
    offerType: price.offerType,
    sourceUrl: price.sourceUrl,
    fetchedAt: price.fetchedAt,
  };
}

function dedupeLocalOffers(offers: LocalOffer[]): LocalOffer[] {
  const byKey = new Map<string, LocalOffer>();
  for (const offer of offers) {
    const key = [
      offer.providerCode,
      offer.providerTestCode ?? normalizeProviderName(offer.providerTestName),
      offer.sourceUrl,
      offer.effectivePriceRub,
      offer.offerType,
    ].join(':');
    const existing = byKey.get(key);
    if (!existing || offer.biomaterialPriceRub > existing.biomaterialPriceRub) {
      byKey.set(key, offer);
    }
  }

  return [...byKey.values()];
}

function formatProviderName(providerCode: string): string {
  if (providerCode === 'dnkom') {
    return 'DNKOM';
  }
  if (providerCode === 'gemotest') {
    return 'Гемотест';
  }
  if (providerCode === 'invitro') {
    return 'INVITRO';
  }
  return providerCode;
}

function readText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function readJsonFile<T = unknown>(filePath: string): T {
  return JSON.parse(readText(filePath)) as T;
}
