import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProviderRegionProbeResult, ProviderTestPriceRecord, ProviderTestRecord } from '../catalog-types.js';
import {
  GEMOTEST_MOSCOW_CATALOG_URL,
  parseGemotestCatalogHtml,
} from './gemotest.parser.js';
import {
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

type PlaywrightModule = typeof import('playwright');

type GemotestLiveScraperOptions = {
  maxCatalogItems?: number;
  fixtureCatalogHtml?: string;
  fixtureCatalogHtmls?: Array<{ html: string; sourceUrl?: string }>;
  catalogUrls?: string[];
  useFixturesOnly?: boolean;
  snapshotDir?: string;
};

type GemotestSession = {
  mode: 'playwright' | 'fixture';
  catalogPages: Array<{ html: string; sourceUrl: string }>;
  probe: ProviderRegionProbeResult;
  close(): Promise<void>;
};

export class GemotestLiveScraper implements ProviderScraper {
  providerCode = 'gemotest';

  private readonly maxCatalogItems: number;
  private readonly fixtureCatalogHtmls: Array<{ html: string; sourceUrl: string }>;
  private readonly catalogUrls: string[];
  private readonly useFixturesOnly: boolean;
  private readonly snapshotDir: string;
  private lastProbe?: ProviderRegionProbeResult;

  constructor(options: GemotestLiveScraperOptions = {}) {
    this.maxCatalogItems = options.maxCatalogItems ?? 50;
    this.fixtureCatalogHtmls = [
      ...(options.fixtureCatalogHtml ? [{ html: options.fixtureCatalogHtml, sourceUrl: GEMOTEST_MOSCOW_CATALOG_URL }] : []),
      ...(options.fixtureCatalogHtmls ?? []).map((page) => ({
        html: page.html,
        sourceUrl: page.sourceUrl ?? GEMOTEST_MOSCOW_CATALOG_URL,
      })),
    ];
    this.catalogUrls = options.catalogUrls?.length ? options.catalogUrls : [GEMOTEST_MOSCOW_CATALOG_URL];
    this.useFixturesOnly = options.useFixturesOnly ?? false;
    this.snapshotDir = options.snapshotDir ?? path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../fixtures/gemotest',
    );
  }

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const session = await this.createSession(context);

    try {
      const catalogPages = session.catalogPages.length > 0 ? session.catalogPages : this.fixtureCatalogHtmls;
      if (catalogPages.length === 0) {
        throw new Error('GemotestLiveScraper could not load catalog HTML and no fixture was provided');
      }

      const parsed = mergeGemotestCatalogPages(catalogPages, context, fetchedAt, this.maxCatalogItems);

      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        fetchedAt,
        tests: parsed.tests,
        prices: parsed.prices,
        rawPayload: {
          mode: session.mode,
          catalogUrls: catalogPages.map((page) => page.sourceUrl),
          pagesSeen: catalogPages.length,
          cardsSeen: parsed.cardsSeen,
          parsedCount: parsed.parsedCount,
          probe: this.lastProbe,
        },
      };
    } finally {
      await session.close();
    }
  }

  async syncPrices(_context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]> {
    return tests
      .map((test) => test.rawPayload)
      .filter(isPricePayload)
      .map((payload) => payload.price);
  }

  async syncPromotions(context: ScraperContext): Promise<PromotionSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      promotions: [],
      promotionItems: [],
      rawPayload: {
        mode: 'not_implemented',
        note: 'Gemotest MVP parser reads catalog prices only; promotions can be added later.',
      },
    };
  }

  async probeRegion(context: ScraperContext): Promise<ProviderRegionProbeResult> {
    const session = await this.createSession(context);
    try {
      return session.probe;
    } finally {
      await session.close();
    }
  }

  private async createSession(context: ScraperContext): Promise<GemotestSession> {
    if (this.useFixturesOnly) {
      const probe = createFixtureProbe(context, 'fixtures_only');
      this.lastProbe = probe;
      return {
        mode: 'fixture',
        catalogPages: this.fixtureCatalogHtmls,
        probe,
        close: async () => undefined,
      };
    }

    let browser: Awaited<ReturnType<PlaywrightModule['chromium']['launch']>> | undefined;

    try {
      const playwright = await import('playwright') as PlaywrightModule;
      browser = await playwright.chromium.launch({ headless: true });
      const browserContext = await browser.newContext({
        userAgent: context.userAgent ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        locale: 'ru-RU',
      });
      const page = await browserContext.newPage();
      const networkRequests: ProviderRegionProbeResult['networkRequests'] = [];

      page.on('request', (request) => {
        const url = request.url();
        if (isRelevantGemotestRequest(url)) {
          networkRequests.push({ url, method: request.method() });
        }
      });
      page.on('response', (response) => {
        const found = networkRequests.find((request) => request.url === response.url());
        if (found) {
          found.responseStatus = response.status();
        }
      });

      const catalogPages: Array<{ html: string; sourceUrl: string }> = [];

      for (const [index, catalogUrl] of this.catalogUrls.entries()) {
        await page.goto(catalogUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForTimeout(2_000);
        const html = await page.content();
        catalogPages.push({ html, sourceUrl: catalogUrl });
        await this.saveSnapshot(index === 0 ? 'catalog-moskva.html' : `catalog-page-${index + 1}.html`, html);

        const currentCount = mergeGemotestCatalogPages(catalogPages, context, new Date().toISOString(), this.maxCatalogItems).tests.length;
        if (currentCount >= this.maxCatalogItems) {
          break;
        }
      }

      const catalogHtml = catalogPages.map((pageHtml) => pageHtml.html).join('\n');

      const cookies = await browserContext.cookies();
      const localStorage = await page.evaluate(() => {
        const values: Record<string, string> = {};
        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index);
          if (key && /city|region|location|geo/i.test(key)) {
            values[key] = (window.localStorage.getItem(key) ?? '').slice(0, 300);
          }
        }
        return values;
      }).catch(() => ({}));

      const probe: ProviderRegionProbeResult = {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        detectedCity: /Москва/i.test(catalogHtml) ? 'Москва' : context.region.city,
        cookies: cookies
          .filter((cookie) => /geo|city|location|region/i.test(cookie.name))
          .map((cookie) => ({
            name: cookie.name,
            valuePreview: cookie.value.slice(0, 80),
            domain: cookie.domain,
          })),
        localStorage,
        networkRequests: networkRequests.slice(0, 50),
        notes: [`Gemotest live probe opened ${catalogPages.length} catalog page(s) with Playwright.`],
        rawPayload: { mode: 'playwright' },
      };
      this.lastProbe = probe;

      return {
        mode: 'playwright',
        catalogPages,
        probe,
        close: async () => {
          await browserContext.close().catch(() => undefined);
          await browser?.close().catch(() => undefined);
        },
      };
    } catch (error) {
      await browser?.close().catch(() => undefined);
      const probe = createFixtureProbe(context, error instanceof Error ? error.message : String(error));
      this.lastProbe = probe;
      return {
        mode: 'fixture',
        catalogPages: this.fixtureCatalogHtmls,
        probe,
        close: async () => undefined,
      };
    }
  }

  private async saveSnapshot(fileName: string, html: string): Promise<void> {
    if (this.useFixturesOnly) {
      return;
    }

    await mkdir(this.snapshotDir, { recursive: true });
    await writeFile(path.join(this.snapshotDir, fileName), html, 'utf8');
  }
}

function mergeGemotestCatalogPages(
  pages: Array<{ html: string; sourceUrl: string }>,
  context: ScraperContext,
  fetchedAt: string,
  maxItems: number,
) {
  const testsByKey = new Map<string, ProviderTestRecord>();
  const pricesByKey = new Map<string, ProviderTestPriceRecord>();
  let cardsSeen = 0;
  let parsedCount = 0;

  for (const page of pages) {
    const remaining = Math.max(maxItems - testsByKey.size, 0);
    if (remaining === 0) {
      break;
    }

    const parsed = parseGemotestCatalogHtml(page.html, context, {
      fetchedAt,
      maxItems: remaining,
      sourceUrl: page.sourceUrl,
    });
    cardsSeen += parsed.cardsSeen;
    parsedCount += parsed.parsedCount;

    for (const test of parsed.tests) {
      const key = test.externalCode ?? test.externalId ?? test.sourceUrl ?? test.name;
      if (!testsByKey.has(key)) {
        testsByKey.set(key, test);
      }
    }

    for (const price of parsed.prices) {
      const key = price.externalCode ?? price.externalId ?? price.sourceUrl ?? JSON.stringify(price.rawPayload);
      if (!pricesByKey.has(key)) {
        pricesByKey.set(key, price);
      }
    }
  }

  return {
    tests: [...testsByKey.values()].slice(0, maxItems),
    prices: [...pricesByKey.values()].slice(0, maxItems),
    cardsSeen,
    parsedCount,
  };
}

function isRelevantGemotestRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isGemotestHost = parsed.hostname === 'gemotest.ru' || parsed.hostname.endsWith('.gemotest.ru');
    return isGemotestHost && /city|region|location|price|catalog|search|api|ajax/i.test(url);
  } catch {
    return false;
  }
}

function createFixtureProbe(context: ScraperContext, reason: string): ProviderRegionProbeResult {
  return {
    providerCode: 'gemotest',
    regionCode: context.region.code,
    detectedCity: context.region.city,
    cookies: [],
    localStorage: {},
    networkRequests: [],
    notes: [`Using Gemotest HTML fixtures: ${reason}`],
    rawPayload: { mode: 'fixture', reason },
  };
}

function isPricePayload(value: unknown): value is { price: ProviderTestPriceRecord } {
  return typeof value === 'object' && value !== null && 'price' in value;
}
