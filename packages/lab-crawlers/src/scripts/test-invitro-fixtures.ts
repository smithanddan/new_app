import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseInvitroApiCatalogJson,
  parseInvitroApiPromotionsJson,
  parseInvitroActionsHtml,
  parseInvitroCatalogCard,
  parseInvitroCatalogHtml,
} from '../adapters/invitro.parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(packageRoot, 'fixtures/invitro');
const fetchedAt = '2026-06-16T00:00:00.000Z';
const context = {
  providerCode: 'invitro',
  fetchedAt,
  region: {
    code: 'moscow',
    city: 'Москва',
    urlPrefix: '/moscow',
  },
} as const;

const catalogHtml = readFixture('playwright-analizes.html');
const catalog = parseInvitroCatalogHtml(catalogHtml, context, {
  fetchedAt,
  sourceUrl: 'https://www.invitro.ru/analizes',
});

assert.equal(catalog.tests.length, 5, 'catalog fixture should parse visible popular tests');
assert.equal(catalog.prices.length, 5, 'catalog fixture should parse visible popular prices');

const ferritin = catalog.tests.find((test) => /ферритин/i.test(test.name));
const ferritinPrice = catalog.prices.find((price) => price.externalCode === ferritin?.externalCode);
assert.ok(ferritin, 'ferritin should be parsed from INVITRO visible catalog');
assert.equal(ferritin.externalCode, '2245');
assert.equal(ferritinPrice?.regularPriceRub, 935);
assert.equal(ferritinPrice?.effectivePriceRub, 935);
assert.equal(ferritinPrice?.offerType, 'regular');
assert.ok(ferritin.sourceUrl.includes('/analizes/for-doctors/2572/2245/'));
assert.ok(ferritin.rawPayload, 'provider test rawPayload should be kept');
assert.ok(ferritinPrice?.rawPayload, 'price rawPayload should be kept');

const biochemistry = catalog.tests.find((test) => /биохимия крови/i.test(test.name));
assert.ok(biochemistry, 'profile card should be parsed');
assert.equal(biochemistry.kind, 'profile');

const rawCard = catalogHtml.match(/<a\b[^>]*href=["'][^"']*\/analizes\/for-doctors\/2572\/2245\/?["'][^>]*>[\s\S]*?<\/a>/i)?.[0];
assert.ok(rawCard, 'fixture should contain ferritin anchor card');
const parsedCard = parseInvitroCatalogCard(rawCard);
assert.equal(parsedCard?.name, 'Ферритин (Ferritin)');
assert.equal(parsedCard?.regularPriceRub, 935);

const actionsHtml = readFixture('playwright-moscow-ak.html');
const actions = parseInvitroActionsHtml(actionsHtml, context, {
  fetchedAt,
  sourceUrl: 'https://www.invitro.ru/moscow/ak/',
});

assert.ok(actions.links.length > 100, 'actions fixture should expose regional action links');
assert.ok(actions.promotions.length >= 7, 'actions fixture should parse visible promo cards');
const homeVisitPromo = actions.promotions.find((promotion) => promotion.title === 'Выезд за 1 рубль');
assert.ok(homeVisitPromo, 'home visit promo should be parsed');
assert.ok(homeVisitPromo.description?.includes('2490'), 'promo description should include threshold');

const apiPopular = parseInvitroApiCatalogJson(readJsonFixture('api-popular.json'), context, {
  fetchedAt,
});
assert.equal(apiPopular.tests.length, 5, 'popular API fixture should parse tests');
assert.equal(apiPopular.prices.length, 5, 'popular API fixture should parse prices');

const apiTests = parseInvitroApiCatalogJson(readJsonFixture('api-tests-page-1.json'), context, {
  fetchedAt,
});
assert.equal(apiTests.tests.length, 25, 'tests API fixture should parse first page tests');
assert.equal(apiTests.prices.length, 25, 'tests API fixture should parse first page prices');
const glucose = apiTests.tests.find((test) => test.externalCode === '16');
const glucosePrice = apiTests.prices.find((price) => price.externalCode === '16');
assert.ok(glucose, 'glucose should be parsed from INVITRO API fixture');
assert.equal(glucose.name, 'Глюкоза (в крови) (Glucose)');
assert.equal(glucosePrice?.regularPriceRub, 370);
assert.equal(glucosePrice?.effectivePriceRub, 370);
assert.equal(glucosePrice?.biomaterialPriceRub, 310);
assert.ok(glucose.biomaterial, 'glucose should include biomaterial service title when API provides it');
assert.ok(glucose.turnaroundTime, 'glucose should include turnaround time when API provides deadline');
assert.ok(glucose.sourceUrl.includes('/analizes/for-doctors/481/2212/'));

const apiComplexes = parseInvitroApiCatalogJson(readJsonFixture('api-complexes-page-1.json'), context, {
  fetchedAt,
  defaultKind: 'profile',
});
assert.equal(apiComplexes.tests.length, 25, 'complexes API fixture should parse first page complexes');
assert.equal(apiComplexes.tests[0]?.kind, 'profile');

const apiPromotions = parseInvitroApiPromotionsJson(readJsonFixture('api-promotions-home.json'), context, {
  fetchedAt,
});
assert.ok(apiPromotions.promotions.length >= 10, 'promotions API fixture should parse a meaningful promotion set');
assert.ok(apiPromotions.promotions.some((promotion) => promotion.title === 'Скидка до 45%'));

const detailProduct = parseInvitroApiCatalogJson({
  id: 'bdca4fdd-0427-4e88-8a34-becd8f78aa7b',
  bitrix_id: 2245,
  code: '51',
  title: 'Ферритин (Ferritin)',
  price: 935,
  deadline: 1,
  categories: [
    { bitrix_id: 140, title: 'Биохимические исследования' },
    { bitrix_id: 2572, title: 'Белки, участвующие в обмене железа' },
  ],
  additional_services: [
    { id: '718f4d00-210d-43f1-9c9c-e97733d38972', price: 310, title: 'Взятие крови из вены' },
  ],
}, context, {
  fetchedAt,
  sourceUrl: 'https://www.invitro.ru/golk/tests/api/v1/tests/bdca4fdd-0427-4e88-8a34-becd8f78aa7b',
});
assert.equal(detailProduct.tests.length, 1, 'detail API product should parse as one test');
assert.equal(detailProduct.tests[0]?.externalCode, '51');
assert.equal(detailProduct.tests[0]?.category, 'Белки, участвующие в обмене железа');
assert.ok(detailProduct.tests[0]?.sourceUrl.includes('/analizes/for-doctors/2572/2245/'));
assert.equal(detailProduct.prices[0]?.regularPriceRub, 935);
assert.equal(detailProduct.prices[0]?.biomaterialPriceRub, 310);
assert.equal(detailProduct.tests[0]?.biomaterial, 'Взятие крови из вены');
assert.equal(detailProduct.tests[0]?.turnaroundTime, '1 дн.');

assertNoCentsKeys(catalog);
assertNoCentsKeys(actions);
assertNoCentsKeys(apiPopular);
assertNoCentsKeys(apiTests);
assertNoCentsKeys(apiComplexes);
assertNoCentsKeys(apiPromotions);

console.log(JSON.stringify({
  status: 'ok',
  fixtures: [
    path.relative(packageRoot, path.join(fixturesDir, 'playwright-analizes.html')),
    path.relative(packageRoot, path.join(fixturesDir, 'playwright-moscow-ak.html')),
    path.relative(packageRoot, path.join(fixturesDir, 'api-popular.json')),
    path.relative(packageRoot, path.join(fixturesDir, 'api-tests-page-1.json')),
    path.relative(packageRoot, path.join(fixturesDir, 'api-complexes-page-1.json')),
    path.relative(packageRoot, path.join(fixturesDir, 'api-promotions-home.json')),
  ],
  catalogItems: catalog.tests.length,
  prices: catalog.prices.length,
  promotions: actions.promotions.length,
  actionLinks: actions.links.length,
  apiTests: apiTests.tests.length,
  apiComplexes: apiComplexes.tests.length,
  apiPromotions: apiPromotions.promotions.length,
  firstCatalogItems: catalog.tests.slice(0, 5).map((test) => {
    const price = catalog.prices.find((item) => item.externalCode === test.externalCode);
    return {
      provider_test_code: test.externalCode,
      provider_test_name: test.name,
      kind: test.kind,
      regularPriceRub: price?.regularPriceRub,
      effectivePriceRub: price?.effectivePriceRub,
      sourceUrl: test.sourceUrl,
    };
  }),
  firstPromotion: {
    title: actions.promotions[0]?.title,
    description: actions.promotions[0]?.description,
    sourceUrl: actions.promotions[0]?.sourceUrl,
  },
  firstApiTest: {
    provider_test_code: glucose?.externalCode,
    provider_test_name: glucose?.name,
    regularPriceRub: glucosePrice?.regularPriceRub,
    effectivePriceRub: glucosePrice?.effectivePriceRub,
    biomaterialPriceRub: glucosePrice?.biomaterialPriceRub,
    sourceUrl: glucose?.sourceUrl,
  },
}, null, 2));

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

function readJsonFixture(name: string): unknown {
  return JSON.parse(readFixture(name));
}

function assertNoCentsKeys(value: unknown, pathLabel = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCentsKeys(item, `${pathLabel}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.ok(!/cent/i.test(key), `unexpected cents key at ${pathLabel}.${key}`);
    assertNoCentsKeys(child, `${pathLabel}.${key}`);
  }
}
