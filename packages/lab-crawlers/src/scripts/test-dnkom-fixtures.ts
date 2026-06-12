import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DNKOM_ACTIONS_URL,
  parseDnkomActionsHtml,
  parseDnkomCatalogHtml,
  parseDnkomNextCatalogPageUrl,
  parseDnkomProductInfo,
} from '../adapters/dnkom.parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(packageRoot, 'fixtures/dnkom');
const fetchedAt = '2026-06-11T00:00:00.000Z';
const context = {
  providerCode: 'dnkom',
  fetchedAt,
  region: {
    code: 'moscow',
    city: 'Москва',
  },
} as const;

const catalogHtml = readFixture('catalog-live.html');
const actionsHtml = readFixture('actions-live.html');
const actionDetailUrl = `${DNKOM_ACTIONS_URL}biokhimiya_krovi/`;
const actionDetailHtml = readFixture('action-biochemistry.html');

const catalog = parseDnkomCatalogHtml(catalogHtml, context, {
  fetchedAt,
  maxItems: 25,
});
const actions = parseDnkomActionsHtml(actionsHtml, context, {
  fetchedAt,
  maxItems: 8,
  detailHtmlByUrl: {
    [actionDetailUrl]: actionDetailHtml,
  },
});

assert.equal(catalog.tests.length, 25, 'catalog fixture should parse first 25 provider tests');
assert.equal(catalog.prices.length, 25, 'catalog fixture should parse first 25 prices');
assert.equal(actions.promotions.length, 8, 'actions fixture should parse first 8 promotions');
assert.equal(
  parseDnkomNextCatalogPageUrl(catalogHtml),
  'https://dnkom.ru/analizy-i-tseny/po-tipu/?PAGEN_2=2',
  'catalog fixture should expose the next AJAX page URL',
);

const firstTest = catalog.tests[0];
const firstPrice = catalog.prices[0];
assert.equal(firstTest.providerCode, 'dnkom');
assert.ok(firstTest.externalCode, 'provider_test_code should be parsed');
assert.ok(firstTest.name, 'provider_test_name should be parsed');
assert.ok(firstTest.sourceUrl.startsWith('https://dnkom.ru/'), 'provider test sourceUrl should be absolute');
assert.ok(firstTest.rawPayload, 'provider test rawPayload should be kept');
assert.equal(typeof firstPrice.regularPriceRub, 'number', 'regularPriceRub should be a number of rubles');
assert.equal(firstPrice.effectivePriceRub, firstPrice.regularPriceRub, 'regular catalog effective price should equal regular price');
assert.ok(firstPrice.sourceUrl.startsWith('https://dnkom.ru/'), 'price sourceUrl should be absolute');
assert.ok(firstPrice.rawPayload, 'price rawPayload should be kept');

const promoItem = actions.promotionItems.find((item) => item.externalId === '14.196');
assert.ok(promoItem, 'biochemistry action fixture should parse a promo item');
assert.equal(promoItem.originalName, 'Биохимия базовая');
assert.equal(promoItem.promoPriceRub, 2030);
assert.equal(promoItem.effectivePriceRub, 2030);
assert.ok(promoItem.sourceUrl.startsWith('https://dnkom.ru/actions/'), 'promo item sourceUrl should be absolute');
assert.ok(promoItem.rawPayload, 'promo item rawPayload should be kept');

const biochemistryPromotion = actions.promotions.find((promotion) => promotion.externalId === actionDetailUrl);
assert.ok(biochemistryPromotion, 'biochemistry promotion should be parsed');
assert.equal(biochemistryPromotion.title, 'Биохимия крови: 8 ключевых показателей');
assert.equal(biochemistryPromotion.endsOn, '2026-08-31');
assert.equal(biochemistryPromotion.regionScope, 'Москва');
assert.ok(biochemistryPromotion.rawPayload, 'promotion rawPayload should be kept');

const rawProductInfo = catalogHtml.match(/data-product-info=(["'])([\s\S]*?)\1/i)?.[2];
assert.ok(rawProductInfo, 'fixture should contain data-product-info');
const productInfo = parseDnkomProductInfo(rawProductInfo);
assert.equal(productInfo?.id, '10.369');
assert.equal(productInfo?.name, 'Дифференциальная диагностика гриппа А, гриппа В и SARS CoV-2 , антигенный тест');
assert.equal(productInfo?.price, 1050);

assertNoCentsKeys(catalog);
assertNoCentsKeys(actions);

console.log(JSON.stringify({
  status: 'ok',
  fixtures: [
    path.relative(packageRoot, path.join(fixturesDir, 'catalog-live.html')),
    path.relative(packageRoot, path.join(fixturesDir, 'actions-live.html')),
    path.relative(packageRoot, path.join(fixturesDir, 'action-biochemistry.html')),
  ],
  catalogItems: catalog.tests.length,
  prices: catalog.prices.length,
  promotions: actions.promotions.length,
  promoItems: actions.promotionItems.length,
  firstCatalogItem: {
    provider_test_code: firstTest.externalCode,
    provider_test_name: firstTest.name,
    regularPriceRub: firstPrice.regularPriceRub,
    effectivePriceRub: firstPrice.effectivePriceRub,
    sourceUrl: firstPrice.sourceUrl,
  },
  firstPromoItem: promoItem && {
    provider_test_code: promoItem.externalId,
    provider_test_name: promoItem.originalName,
    promoPriceRub: promoItem.promoPriceRub,
    effectivePriceRub: promoItem.effectivePriceRub,
    sourceUrl: promoItem.sourceUrl,
  },
}, null, 2));

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
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
