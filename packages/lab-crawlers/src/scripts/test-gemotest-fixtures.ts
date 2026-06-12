import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseGemotestCatalogHtml,
  parseGemotestProductCard,
} from '../adapters/gemotest.parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(packageRoot, 'fixtures/gemotest');
const fetchedAt = '2026-06-12T00:00:00.000Z';
const context = {
  providerCode: 'gemotest',
  fetchedAt,
  region: {
    code: 'moskva',
    city: 'Москва',
    urlPrefix: '/moskva',
  },
} as const;

const catalogHtml = readFixture('catalog-moskva.html');
const catalog = parseGemotestCatalogHtml(catalogHtml, context, {
  fetchedAt,
  maxItems: 20,
});

assert.equal(catalog.tests.length, 11, 'catalog fixture should parse provider tests');
assert.equal(catalog.prices.length, 11, 'catalog fixture should parse prices');

const glucose = catalog.tests.find((test) => test.externalCode === '1.14.2');
const glucosePrice = catalog.prices.find((price) => price.externalCode === '1.14.2');
assert.ok(glucose, 'glucose fixture should parse provider test');
assert.equal(glucose.name, 'Глюкоза по суперцене');
assert.ok(glucose.sourceUrl.startsWith('https://gemotest.ru/moskva/catalog/'));
assert.ok(glucose.rawPayload, 'provider test rawPayload should be kept');
assert.equal(glucosePrice?.regularPriceRub, 340);
assert.equal(glucosePrice?.promoPriceRub, 310);
assert.equal(glucosePrice?.effectivePriceRub, 310);
assert.equal(glucosePrice?.biomaterialPriceRub, 330);
assert.equal(glucosePrice?.offerType, 'promo');
assert.ok(glucosePrice?.rawPayload, 'price rawPayload should be kept');

const rawCard = catalogHtml.match(/<article\b[^>]*data-gemotest-product\b[^>]*>[\s\S]*?<\/article>/i)?.[0];
assert.ok(rawCard, 'fixture should contain a product card');
const productCard = parseGemotestProductCard(rawCard);
assert.equal(productCard?.name, 'Общий анализ мочи');
assert.equal(productCard?.regularPriceRub, 400);

assertNoCentsKeys(catalog);

console.log(JSON.stringify({
  status: 'ok',
  fixtures: [
    path.relative(packageRoot, path.join(fixturesDir, 'catalog-moskva.html')),
  ],
  catalogItems: catalog.tests.length,
  prices: catalog.prices.length,
  firstCatalogItem: {
    provider_test_code: catalog.tests[0]?.externalCode,
    provider_test_name: catalog.tests[0]?.name,
    regularPriceRub: catalog.prices[0]?.regularPriceRub,
    effectivePriceRub: catalog.prices[0]?.effectivePriceRub,
    biomaterialPriceRub: catalog.prices[0]?.biomaterialPriceRub,
    sourceUrl: catalog.prices[0]?.sourceUrl,
  },
  glucose: {
    provider_test_code: glucose.externalCode,
    provider_test_name: glucose.name,
    regularPriceRub: glucosePrice?.regularPriceRub,
    promoPriceRub: glucosePrice?.promoPriceRub,
    effectivePriceRub: glucosePrice?.effectivePriceRub,
    biomaterialPriceRub: glucosePrice?.biomaterialPriceRub,
    sourceUrl: glucosePrice?.sourceUrl,
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
