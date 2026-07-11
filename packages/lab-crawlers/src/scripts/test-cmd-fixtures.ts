import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CMD_MOSCOW_CATALOG_URL,
  parseCmdAnalyzeCard,
  parseCmdCatalogHtml,
} from '../adapters/cmd.parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(packageRoot, 'fixtures/cmd');
const fetchedAt = '2026-06-19T00:00:00.000Z';
const context = {
  providerCode: 'cmd',
  fetchedAt,
  region: {
    code: 'msk',
    city: 'Москва',
    urlPrefix: '/analizy-i-tseny/katalog-analizov/msk',
  },
} as const;

const catalogHtml = readFixture('catalog-msk.html');
const catalog = parseCmdCatalogHtml(catalogHtml, context, {
  fetchedAt,
  maxItems: 40,
  sourceUrl: CMD_MOSCOW_CATALOG_URL,
});

assert.ok(catalog.tests.length > 0, 'CMD catalog fixture should parse provider tests');
assert.equal(catalog.tests.length, catalog.prices.length, 'CMD catalog fixture should parse one price per parsed test');

const alt = catalog.tests.find((test) => test.externalCode === '090014');
const altPrice = catalog.prices.find((price) => price.externalCode === '090014');
assert.ok(alt, 'ALT fixture should parse provider test');
assert.match(alt.name, /Аланинаминотрансфераза/i);
assert.equal(alt.turnaroundTime, '1 к.д.');
assert.equal(alt.sourceUrl, 'https://www.cmd-online.ru/analizy-i-tseny/katalog-analizov/msk/alanin-aminotransferaza-alt-alat-alanine-aminotransferase-alt-gpt_090014/');
assert.equal(altPrice?.regularPriceRub, 350);
assert.equal(altPrice?.effectivePriceRub, 350);
assert.equal(altPrice?.offerType, 'regular');
assert.ok(alt.rawPayload, 'provider test rawPayload should be kept');
assert.ok(altPrice?.rawPayload, 'price rawPayload should be kept');

const rawCard = catalogHtml.match(/<article\b[^>]*class=["'][^"']*analyze-item[^"']*["'][^>]*>[\s\S]*?<\/article>/i)?.[0];
assert.ok(rawCard, 'fixture should contain an analyze card');
const productCard = parseCmdAnalyzeCard(rawCard);
assert.ok(productCard?.name, 'single CMD card should parse a name');
assert.ok(productCard?.effectivePriceRub, 'single CMD card should parse a price');

const karyotypeHtml = readFixture('search-karyotype.html');
const karyotypeCatalog = parseCmdCatalogHtml(karyotypeHtml, context, {
  fetchedAt,
  sourceUrl: `${CMD_MOSCOW_CATALOG_URL}?q=${encodeURIComponent('кариотип')}`,
});
const karyotype = karyotypeCatalog.tests.find((test) => test.externalCode === '190204');
const karyotypePrice = karyotypeCatalog.prices.find((price) => price.externalCode === '190204');
assert.equal(karyotypeCatalog.karyotypeProbe.status, 'found');
assert.equal(karyotype?.canonicalCode, 'KARYOTYPE');
assert.equal(karyotype?.name, 'Исследование кариотипа (Кариотипирование)');
assert.equal(karyotype?.turnaroundTime, '12-25 к.д.');
assert.equal(karyotypePrice?.regularPriceRub, 8290);
assert.equal(karyotypePrice?.effectivePriceRub, 8290);

const emptyProbe = parseCmdCatalogHtml('<html><body><p>Ничего не найдено</p></body></html>', context, { fetchedAt });
assert.equal(emptyProbe.karyotypeProbe.status, 'not_found');
assert.equal(emptyProbe.tests.length, 0);

assertNoCentsKeys(catalog);
assertNoCentsKeys(karyotypeCatalog);

console.log(JSON.stringify({
  status: 'ok',
  fixtures: [
    path.relative(packageRoot, path.join(fixturesDir, 'catalog-msk.html')),
    path.relative(packageRoot, path.join(fixturesDir, 'search-karyotype.html')),
  ],
  catalogItems: catalog.tests.length,
  prices: catalog.prices.length,
  karyotypeProbe: karyotypeCatalog.karyotypeProbe,
  alt: {
    provider_test_code: alt.externalCode,
    provider_test_name: alt.name,
    regularPriceRub: altPrice?.regularPriceRub,
    effectivePriceRub: altPrice?.effectivePriceRub,
    sourceUrl: altPrice?.sourceUrl,
  },
  karyotype: {
    provider_test_code: karyotype?.externalCode,
    provider_test_name: karyotype?.name,
    canonicalCode: karyotype?.canonicalCode,
    regularPriceRub: karyotypePrice?.regularPriceRub,
    effectivePriceRub: karyotypePrice?.effectivePriceRub,
    sourceUrl: karyotypePrice?.sourceUrl,
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
