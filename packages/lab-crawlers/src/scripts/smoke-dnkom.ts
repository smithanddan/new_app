import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  autoMatchProviderTests,
  compareProviderPrices,
  DnkomLiveScraper,
  GemotestScraper,
  InvitroScraper,
} from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(packageRoot, 'fixtures/dnkom');

function readFixture(name: string): string | undefined {
  const filePath = path.join(fixturesDir, name);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : undefined;
}

const detailUrl = 'https://dnkom.ru/analizy-i-tseny/po-tipu/issledovanie-urovnya-glyukozy-metodom-nepreryvnogo-monitorirovaniya-datchik-lumiflex-linx-do-16-sutok/';
const actionUrl = 'https://dnkom.ru/actions/biokhimiya_krovi/';

const scraper = new DnkomLiveScraper({
  maxCatalogItems: Number(process.env.DNKOM_SMOKE_LIMIT ?? 25),
  maxPromotionItems: Number(process.env.DNKOM_SMOKE_PROMO_LIMIT ?? 8),
  fixtureCatalogHtml: readFixture('catalog-live.html'),
  fixtureActionsHtml: readFixture('actions-live.html'),
  fixtureDetailHtmlByUrl: {
    [detailUrl]: readFixture('detail-glucose-monitor.html') ?? '',
    [actionUrl]: readFixture('action-biochemistry.html') ?? '',
  },
  useFixturesOnly: process.env.DNKOM_FIXTURE_ONLY === '1',
});

const context = {
  providerCode: 'dnkom',
  region: {
    code: 'moscow',
    city: 'Москва',
  },
};

const catalog = await scraper.syncCatalog(context);
const promotions = await scraper.syncPromotions(context);
const invitroCatalog = await new InvitroScraper().syncCatalog({
  providerCode: 'invitro',
  region: {
    code: 'moscow',
    city: 'Москва',
    urlPrefix: '/moscow',
  },
});
const gemotestCatalog = await new GemotestScraper().syncCatalog({
  providerCode: 'gemotest',
  region: {
    code: 'moscow',
    city: 'Москва',
    urlPrefix: '/moskva',
  },
});
const rawMode = catalog.rawPayload as {
  mode?: string;
  catalogUrl?: string;
  productsSeen?: number;
  linksSeen?: number;
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
const allMatchedTests = autoMatchProviderTests([
  ...catalog.tests,
  ...invitroCatalog.tests,
  ...gemotestCatalog.tests,
]);
const comparison = compareProviderPrices(allMatchedTests, [
  ...catalog.prices,
  ...invitroCatalog.prices,
  ...gemotestCatalog.prices,
]);

console.log(JSON.stringify({
  provider: catalog.providerCode,
  region: catalog.regionCode,
  mode: {
    mode: rawMode.mode,
    catalogUrl: rawMode.catalogUrl,
    productsSeen: rawMode.productsSeen,
    linksSeen: rawMode.linksSeen,
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
  first5Promotions: promotions.promotions.slice(0, 5).map((promotion) => ({
    externalId: promotion.externalId,
    title: promotion.title,
    offerType: promotion.offerType,
    startsOn: promotion.startsOn,
    endsOn: promotion.endsOn,
    regionScope: promotion.regionScope,
    sourceUrl: promotion.sourceUrl,
  })),
  first5PromoItems: promotions.promotionItems.slice(0, 5).map((item) => ({
    promotionExternalId: item.promotionExternalId,
    externalId: item.externalId,
    originalName: item.originalName,
    regularPriceRub: item.regularPriceRub,
    promoPriceRub: item.promoPriceRub,
    effectivePriceRub: item.effectivePriceRub,
    sourceUrl: item.sourceUrl,
  })),
  comparison,
  comparisonSources: {
    dnkomLiveItems: catalog.tests.length,
    invitroMockItems: invitroCatalog.tests.length,
    gemotestMockItems: gemotestCatalog.tests.length,
  },
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

function summarizeMatch(match: (typeof matchedTests)[number] | undefined) {
  if (!match) {
    return undefined;
  }

  return {
    canonicalCode: match.canonicalCode,
    matchStatus: match.matchStatus,
    matchConfidence: match.matchConfidence,
  };
}
