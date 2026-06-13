import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GemotestLiveScraper,
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
} from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '../..');
const fixturesDir = path.join(packageRoot, 'fixtures/gemotest');

const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');
const dryRun = args.has('--dry-run') || !writeMode;

if (writeMode && args.has('--dry-run')) {
  throw new Error('Use either --dry-run or --write, not both');
}

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

type SyncReport = {
  provider: 'gemotest';
  region: 'moskva';
  mode: 'dry-run' | 'write';
  scraper_run_id: string | null;
  catalogParsed: number;
  pricesParsed: number;
  promotionsParsed: number;
  promotionItemsParsed: number;
  providerTestsUpserted: number;
  pricesInserted: number;
  promotionsUpserted: number;
  promotionItemsUpserted: number;
  errorsCount: number;
  errors: string[];
};

const context = {
  providerCode: 'gemotest',
  region: {
    code: 'moskva',
    city: 'Москва',
    urlPrefix: '/moskva',
  },
};
const scraper = new GemotestLiveScraper({
  maxCatalogItems: Number(process.env.GEMOTEST_SYNC_LIMIT ?? 50),
  fixtureCatalogHtml: readFixture('catalog-moskva.html'),
  fixtureCatalogHtmls: readFixturePages(),
  catalogUrls: readCatalogUrls(),
  useFixturesOnly: process.env.GEMOTEST_FIXTURE_ONLY === '1',
});

const catalog = await scraper.syncCatalog(context);
const promotions = await scraper.syncPromotions(context);
const report: SyncReport = {
  provider: 'gemotest',
  region: 'moskva',
  mode: dryRun ? 'dry-run' : 'write',
  scraper_run_id: null,
  catalogParsed: catalog.tests.length,
  pricesParsed: catalog.prices.length,
  promotionsParsed: promotions.promotions.length,
  promotionItemsParsed: promotions.promotionItems.length,
  providerTestsUpserted: dryRun ? catalog.tests.length : 0,
  pricesInserted: dryRun ? catalog.prices.length : 0,
  promotionsUpserted: dryRun ? promotions.promotions.length : 0,
  promotionItemsUpserted: dryRun ? promotions.promotionItems.length : 0,
  errorsCount: 0,
  errors: [],
};

if (!dryRun) {
  const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
  const ids = await repository.getProviderRegionIds(catalog.providerCode, catalog.regionCode);
  const scraperRun = await repository.createScraperRun({
    providerId: ids.providerId,
    labRegionId: ids.labRegionId,
    runType: 'sync_catalog',
    rawPayload: {
      command: 'sync:gemotest',
      catalog: catalog.rawPayload,
      promotions: promotions.rawPayload,
    },
  });
  report.scraper_run_id = scraperRun.id;

  const providerTestIdsByExternalId = new Map<string, string>();

  for (const test of catalog.tests) {
    try {
      const result = await repository.upsertProviderTest({
        providerId: ids.providerId,
        test,
      });
      if (test.externalId) {
        providerTestIdsByExternalId.set(test.externalId, result.id);
      }
      report.providerTestsUpserted += 1;
      await repository.logScraperRunItem({
        scraperRunId: scraperRun.id,
        providerTestId: result.id,
        entityType: 'provider_test',
        sourceUrl: test.sourceUrl,
        status: 'success',
        message: result.action,
        rawPayload: test.rawPayload,
      });
    } catch (error) {
      await logError(repository, scraperRun.id, report, 'provider_test', test.sourceUrl, error, test.rawPayload);
    }
  }

  const priceKeys = new Set<string>();
  for (const price of catalog.prices) {
    const providerTestId = price.externalId ? providerTestIdsByExternalId.get(price.externalId) : undefined;
    const priceKey = [
      providerTestId,
      price.externalCode,
      price.regularPriceRub,
      price.promoPriceRub,
      price.effectivePriceRub,
      price.biomaterialPriceRub,
      price.sourceUrl,
      price.fetchedAt,
    ].join('|');

    if (priceKeys.has(priceKey)) {
      await repository.logScraperRunItem({
        scraperRunId: scraperRun.id,
        providerTestId,
        entityType: 'price',
        sourceUrl: price.sourceUrl,
        status: 'skipped',
        message: 'duplicate price within scraper_run',
        rawPayload: price.rawPayload,
      });
      continue;
    }

    priceKeys.add(priceKey);

    if (!providerTestId) {
      await logError(repository, scraperRun.id, report, 'price', price.sourceUrl, new Error('provider_test not found for price'), price.rawPayload);
      continue;
    }

    try {
      await repository.insertProviderTestPrice({
        providerId: ids.providerId,
        labRegionId: ids.labRegionId,
        providerTestId,
        price,
      });
      report.pricesInserted += 1;
      await repository.logScraperRunItem({
        scraperRunId: scraperRun.id,
        providerTestId,
        entityType: 'price',
        sourceUrl: price.sourceUrl,
        status: 'success',
        rawPayload: price.rawPayload,
      });
    } catch (error) {
      await logError(repository, scraperRun.id, report, 'price', price.sourceUrl, error, price.rawPayload);
    }
  }

  await repository.finishScraperRun({
    scraperRunId: scraperRun.id,
    status: report.errors.length === 0 ? 'success' : 'partial',
    stats: {
      catalogParsed: report.catalogParsed,
      pricesParsed: report.pricesParsed,
      promotionsParsed: report.promotionsParsed,
      promotionItemsParsed: report.promotionItemsParsed,
      providerTestsUpserted: report.providerTestsUpserted,
      pricesInserted: report.pricesInserted,
      promotionsUpserted: report.promotionsUpserted,
      promotionItemsUpserted: report.promotionItemsUpserted,
      errorsCount: report.errors.length,
    },
    error: report.errors.length === 0 ? undefined : report.errors.join('\n'),
  });
}

report.errorsCount = report.errors.length;
console.log(JSON.stringify(report, null, 2));

async function logError(
  repository: LabCatalogRepository,
  scraperRunId: string,
  report: SyncReport,
  entityType: 'provider_test' | 'price' | 'promotion' | 'promotion_item' | 'region' | 'unknown',
  sourceUrl: string | undefined,
  error: unknown,
  rawPayload: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  report.errors.push(`${entityType}: ${message}`);
  await repository.logScraperRunItem({
    scraperRunId,
    entityType,
    sourceUrl,
    status: 'failed',
    message,
    rawPayload,
  });
}
