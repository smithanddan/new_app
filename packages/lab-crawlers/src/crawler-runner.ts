import type {
  LabPromotionItemRecord,
  LabPromotionRecord,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from './catalog-types.js';
import type { LabCatalogRepository } from './supabase-lab-catalog.repository.js';
import {
  buildCrawlerTransport,
  createProviderAdapter,
  resolveProviderRegion,
  type CrawlerProviderKey,
  type CrawlerTransport,
  type ProviderAdapter,
} from './crawler-adapters.js';

export type CrawlerRunMode = 'dry-run' | 'write';
export type CrawlerRunProviderInput = CrawlerProviderKey | 'all';

export type CrawlerRunnerInput = {
  provider: CrawlerRunProviderInput;
  region: string;
  mode?: CrawlerRunMode;
  command?: string;
};

export type CrawlerProviderRunReport = {
  provider: CrawlerProviderKey;
  region: string;
  mode: CrawlerRunMode;
  transport: CrawlerTransport;
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

export type CrawlerRunReport = {
  provider: CrawlerRunProviderInput;
  region: string;
  mode: CrawlerRunMode;
  runs: CrawlerProviderRunReport[];
  totals: {
    catalogParsed: number;
    pricesParsed: number;
    promotionsParsed: number;
    promotionItemsParsed: number;
    providerTestsUpserted: number;
    pricesInserted: number;
    promotionsUpserted: number;
    promotionItemsUpserted: number;
    errorsCount: number;
  };
  errors: string[];
};

export class CrawlerRunner {
  constructor(private readonly repository?: LabCatalogRepository) {}

  async run(input: CrawlerRunnerInput): Promise<CrawlerRunReport> {
    const mode = input.mode ?? 'dry-run';
    const providers = input.provider === 'all'
      ? (['dnkom', 'gemotest'] satisfies CrawlerProviderKey[])
      : [input.provider];
    const runs: CrawlerProviderRunReport[] = [];

    for (const provider of providers) {
      const adapter = createProviderAdapter(provider);
      runs.push(await this.runProvider({
        adapter,
        provider,
        region: resolveProviderRegion(provider, input.region),
        mode,
        command: input.command ?? 'crawler:run',
      }));
    }

    return {
      provider: input.provider,
      region: input.region,
      mode,
      runs,
      totals: sumRunTotals(runs),
      errors: runs.flatMap((run) => run.errors.map((error) => `${run.provider}: ${error}`)),
    };
  }

  private async runProvider(input: {
    adapter: ProviderAdapter;
    provider: CrawlerProviderKey;
    region: string;
    mode: CrawlerRunMode;
    command: string;
  }): Promise<CrawlerProviderRunReport> {
    const context = input.adapter.buildContext(input.region);
    const transport = buildCrawlerTransport(input.provider);
    const catalog = await input.adapter.crawlCatalog(context);
    const prices = await input.adapter.crawlPrices(context, catalog.tests);
    const promotions = await input.adapter.crawlPromotions(context);
    const report: CrawlerProviderRunReport = {
      provider: input.provider,
      region: catalog.regionCode,
      mode: input.mode,
      transport,
      scraper_run_id: null,
      catalogParsed: catalog.tests.length,
      pricesParsed: prices.length,
      promotionsParsed: promotions.promotions.length,
      promotionItemsParsed: promotions.promotionItems.length,
      providerTestsUpserted: input.mode === 'dry-run' ? catalog.tests.length : 0,
      pricesInserted: input.mode === 'dry-run' ? prices.length : 0,
      promotionsUpserted: input.mode === 'dry-run' ? promotions.promotions.length : 0,
      promotionItemsUpserted: input.mode === 'dry-run' ? promotions.promotionItems.length : 0,
      errorsCount: 0,
      errors: [],
    };

    if (input.mode === 'write') {
      if (!this.repository) {
        throw new Error('CrawlerRunner write mode requires a LabCatalogRepository');
      }

      await this.writeProviderRun({
        report,
        catalogTests: catalog.tests,
        prices,
        promotions: promotions.promotions,
        promotionItems: promotions.promotionItems,
        catalogRawPayload: catalog.rawPayload,
        promotionsRawPayload: promotions.rawPayload,
        command: input.command,
      });
    }

    report.errorsCount = report.errors.length;
    return report;
  }

  private async writeProviderRun(input: {
    report: CrawlerProviderRunReport;
    catalogTests: ProviderTestRecord[];
    prices: ProviderTestPriceRecord[];
    promotions: LabPromotionRecord[];
    promotionItems: LabPromotionItemRecord[];
    catalogRawPayload: unknown;
    promotionsRawPayload: unknown;
    command: string;
  }): Promise<void> {
    const repository = this.repository as LabCatalogRepository;
    const ids = await repository.getProviderRegionIds(input.report.provider, input.report.region);
    const scraperRun = await repository.createScraperRun({
      providerId: ids.providerId,
      labRegionId: ids.labRegionId,
      runType: 'sync_catalog',
      rawPayload: sanitizeCrawlerPayload({
        command: input.command,
        transport: input.report.transport,
        catalog: input.catalogRawPayload,
        promotions: input.promotionsRawPayload,
      }),
    });
    input.report.scraper_run_id = scraperRun.id;

    const providerTestIdsByExternalId = new Map<string, string>();
    const providerTestIdsByExternalCode = new Map<string, string>();

    for (const test of input.catalogTests) {
      try {
        const result = await repository.upsertProviderTest({
          providerId: ids.providerId,
          test,
        });
        if (test.externalId) {
          providerTestIdsByExternalId.set(test.externalId, result.id);
        }
        if (test.externalCode) {
          providerTestIdsByExternalCode.set(test.externalCode, result.id);
        }
        input.report.providerTestsUpserted += 1;
        await repository.logScraperRunItem({
          scraperRunId: scraperRun.id,
          providerTestId: result.id,
          entityType: 'provider_test',
          sourceUrl: test.sourceUrl,
          status: 'success',
          message: result.action,
          rawPayload: sanitizeCrawlerPayload(test.rawPayload),
        });
      } catch (error) {
        await this.logError(scraperRun.id, input.report, 'provider_test', test.sourceUrl, error, test.rawPayload);
      }
    }

    const priceKeys = new Set<string>();
    for (const price of input.prices) {
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
          rawPayload: sanitizeCrawlerPayload(price.rawPayload),
        });
        continue;
      }

      priceKeys.add(priceKey);

      if (!providerTestId) {
        await this.logError(scraperRun.id, input.report, 'price', price.sourceUrl, new Error('provider_test not found for price'), price.rawPayload);
        continue;
      }

      try {
        await repository.insertProviderTestPrice({
          providerId: ids.providerId,
          labRegionId: ids.labRegionId,
          providerTestId,
          price,
        });
        input.report.pricesInserted += 1;
        await repository.logScraperRunItem({
          scraperRunId: scraperRun.id,
          providerTestId,
          entityType: 'price',
          sourceUrl: price.sourceUrl,
          status: 'success',
          rawPayload: sanitizeCrawlerPayload(price.rawPayload),
        });
      } catch (error) {
        await this.logError(scraperRun.id, input.report, 'price', price.sourceUrl, error, price.rawPayload);
      }
    }

    const promotionIdsByExternalId = new Map<string, string>();
    for (const promotion of input.promotions) {
      try {
        const result = await repository.upsertPromotion({
          providerId: ids.providerId,
          labRegionId: ids.labRegionId,
          promotion,
        });
        if (promotion.externalId) {
          promotionIdsByExternalId.set(promotion.externalId, result.id);
        }
        input.report.promotionsUpserted += 1;
        await repository.logScraperRunItem({
          scraperRunId: scraperRun.id,
          entityType: 'promotion',
          sourceUrl: promotion.sourceUrl,
          status: 'success',
          message: result.action,
          rawPayload: sanitizeCrawlerPayload(promotion.rawPayload),
        });
      } catch (error) {
        await this.logError(scraperRun.id, input.report, 'promotion', promotion.sourceUrl, error, promotion.rawPayload);
      }
    }

    for (const item of input.promotionItems) {
      const promotionId = item.promotionExternalId ? promotionIdsByExternalId.get(item.promotionExternalId) : undefined;

      if (!promotionId) {
        await this.logError(scraperRun.id, input.report, 'promotion_item', item.sourceUrl, new Error('promotion not found for promotion item'), item.rawPayload);
        continue;
      }

      try {
        const providerTestId = item.externalId ? providerTestIdsByExternalCode.get(item.externalId) : undefined;
        const result = await repository.upsertPromotionItem({
          promotionId,
          providerTestId,
          item,
        });
        input.report.promotionItemsUpserted += 1;
        await repository.logScraperRunItem({
          scraperRunId: scraperRun.id,
          providerTestId,
          entityType: 'promotion_item',
          sourceUrl: item.sourceUrl,
          status: 'success',
          message: result.action,
          rawPayload: sanitizeCrawlerPayload(item.rawPayload),
        });
      } catch (error) {
        await this.logError(scraperRun.id, input.report, 'promotion_item', item.sourceUrl, error, item.rawPayload);
      }
    }

    await repository.finishScraperRun({
      scraperRunId: scraperRun.id,
      status: input.report.errors.length === 0 ? 'success' : 'partial',
      stats: buildRunStats(input.report),
      error: input.report.errors.length === 0 ? undefined : input.report.errors.join('\n'),
    });
  }

  private async logError(
    scraperRunId: string,
    report: CrawlerProviderRunReport,
    entityType: 'provider_test' | 'price' | 'promotion' | 'promotion_item' | 'region' | 'unknown',
    sourceUrl: string | undefined,
    error: unknown,
    rawPayload: unknown,
  ): Promise<void> {
    const repository = this.repository as LabCatalogRepository;
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(`${entityType}: ${message}`);
    await repository.logScraperRunItem({
      scraperRunId,
      entityType,
      sourceUrl,
      status: 'failed',
      message,
      rawPayload: sanitizeCrawlerPayload(rawPayload),
    });
  }
}

export function sanitizeCrawlerPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeCrawlerPayload);
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && value.length > 1000
      ? `${value.slice(0, 1000)}…`
      : value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (/^(html|body|bodyText|body_text|content|document)$/i.test(key)) {
      sanitized[key] = '[omitted]';
    } else {
      sanitized[key] = sanitizeCrawlerPayload(nestedValue);
    }
  }

  return sanitized;
}

function buildRunStats(report: CrawlerProviderRunReport) {
  return {
    catalogParsed: report.catalogParsed,
    pricesParsed: report.pricesParsed,
    promotionsParsed: report.promotionsParsed,
    promotionItemsParsed: report.promotionItemsParsed,
    providerTestsUpserted: report.providerTestsUpserted,
    pricesInserted: report.pricesInserted,
    promotionsUpserted: report.promotionsUpserted,
    promotionItemsUpserted: report.promotionItemsUpserted,
    errorsCount: report.errors.length,
    transport: report.transport,
  };
}

function sumRunTotals(runs: CrawlerProviderRunReport[]): CrawlerRunReport['totals'] {
  return runs.reduce<CrawlerRunReport['totals']>((totals, run) => ({
    catalogParsed: totals.catalogParsed + run.catalogParsed,
    pricesParsed: totals.pricesParsed + run.pricesParsed,
    promotionsParsed: totals.promotionsParsed + run.promotionsParsed,
    promotionItemsParsed: totals.promotionItemsParsed + run.promotionItemsParsed,
    providerTestsUpserted: totals.providerTestsUpserted + run.providerTestsUpserted,
    pricesInserted: totals.pricesInserted + run.pricesInserted,
    promotionsUpserted: totals.promotionsUpserted + run.promotionsUpserted,
    promotionItemsUpserted: totals.promotionItemsUpserted + run.promotionItemsUpserted,
    errorsCount: totals.errorsCount + run.errors.length,
  }), {
    catalogParsed: 0,
    pricesParsed: 0,
    promotionsParsed: 0,
    promotionItemsParsed: 0,
    providerTestsUpserted: 0,
    pricesInserted: 0,
    promotionsUpserted: 0,
    promotionItemsUpserted: 0,
    errorsCount: 0,
  });
}
