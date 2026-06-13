import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoMatchProviderTests,
  GemotestLiveScraper,
} from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(packageRoot, 'fixtures/gemotest');

function readFixture(name: string): string | undefined {
  const filePath = path.join(fixturesDir, name);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : undefined;
}

function readFixturePages(): Array<{ html: string; sourceUrl?: string }> {
  if (!fs.existsSync(fixturesDir)) {
    return [];
  }

  return fs.readdirSync(fixturesDir)
    .filter((name) => /^catalog-page-\d+\.html$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => ({ html: fs.readFileSync(path.join(fixturesDir, name), 'utf8') }));
}

function readCatalogUrls(): string[] | undefined {
  const value = process.env.GEMOTEST_CATALOG_URLS;
  if (!value) {
    return undefined;
  }

  return value.split(',').map((url) => url.trim()).filter(Boolean);
}

const scraper = new GemotestLiveScraper({
  maxCatalogItems: Number(process.env.GEMOTEST_SMOKE_LIMIT ?? 50),
  fixtureCatalogHtml: readFixture('catalog-moskva.html'),
  fixtureCatalogHtmls: readFixturePages(),
  catalogUrls: readCatalogUrls(),
  useFixturesOnly: process.env.GEMOTEST_FIXTURE_ONLY === '1',
});

const context = {
  providerCode: 'gemotest',
  region: {
    code: 'moskva',
    city: 'Москва',
    urlPrefix: '/moskva',
  },
};

const catalog = await scraper.syncCatalog(context);
const promotions = await scraper.syncPromotions(context);
const rawMode = catalog.rawPayload as {
  mode?: string;
  catalogUrls?: string[];
  pagesSeen?: number;
  cardsSeen?: number;
  parsedCount?: number;
  probe?: unknown;
};
const probe = rawMode.probe as {
  detectedCity?: string;
  cookies?: Array<{ name?: string; valuePreview?: string; domain?: string }>;
  localStorage?: Record<string, string>;
  networkRequests?: Array<{ url?: string; method?: string; responseStatus?: number }>;
  notes?: string[];
} | undefined;
const matchedTests = autoMatchProviderTests(catalog.tests);

console.log(JSON.stringify({
  provider: catalog.providerCode,
  region: catalog.regionCode,
  mode: {
    mode: rawMode.mode,
    catalogUrls: rawMode.catalogUrls,
    pagesSeen: rawMode.pagesSeen,
    cardsSeen: rawMode.cardsSeen,
    parsedCount: rawMode.parsedCount,
  },
  itemsCount: catalog.tests.length,
  first10ParsedItems: catalog.tests.slice(0, 10).map((test, index) => ({
    index: index + 1,
    externalId: test.externalId,
    externalCode: test.externalCode,
    name: test.name,
    sourceUrl: test.sourceUrl,
    price: summarizePrice(catalog.prices.find((price) => price.externalId === test.externalId)),
    match: summarizeMatch(matchedTests.find((matched) => matched.externalId === test.externalId)),
  })),
  promotionsCount: promotions.promotions.length,
  promotionItemsCount: promotions.promotionItems.length,
  regionProbe: {
    detectedCity: probe?.detectedCity,
    cookies: probe?.cookies,
    localStorage: probe?.localStorage,
    networkRequests: probe?.networkRequests?.slice(0, 15).map((request) => ({
      ...request,
      url: request.url && request.url.length > 180 ? `${request.url.slice(0, 180)}...` : request.url,
    })),
    notes: probe?.notes,
  },
}, null, 2));

function summarizePrice(price: (typeof catalog.prices)[number] | undefined) {
  if (!price) {
    return undefined;
  }

  return {
    regularPriceRub: price.regularPriceRub,
    promoPriceRub: price.promoPriceRub,
    effectivePriceRub: price.effectivePriceRub,
    biomaterialPriceRub: price.biomaterialPriceRub,
    offerType: price.offerType,
    sourceUrl: price.sourceUrl,
  };
}

function summarizeMatch(test: (typeof matchedTests)[number] | undefined) {
  if (!test?.canonicalCode) {
    return undefined;
  }

  return {
    canonicalCode: test.canonicalCode,
    matchStatus: test.matchStatus,
    matchConfidence: test.matchConfidence,
  };
}
