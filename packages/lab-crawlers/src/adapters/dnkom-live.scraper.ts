import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProviderRegionProbeResult, ProviderTestPriceRecord, ProviderTestRecord } from '../catalog-types.js';
import {
  DNKOM_ACTIONS_URL,
  DNKOM_CATALOG_URL,
  extractDnkomCurrentCity,
  parseDnkomActionLinks,
  parseDnkomActionsHtml,
  parseDnkomCatalogHtml,
  parseDnkomCatalogLinks,
} from './dnkom.parser.js';
import {
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

type PlaywrightModule = typeof import('playwright');

type DnkomLiveScraperOptions = {
  maxCatalogItems?: number;
  maxPromotionItems?: number;
  fixtureCatalogHtml?: string;
  fixtureActionsHtml?: string;
  fixtureDetailHtmlByUrl?: Record<string, string>;
  useFixturesOnly?: boolean;
  snapshotDir?: string;
};

type DnkomPageResult = {
  html: string;
  url: string;
};

type DnkomSession = {
  mode: 'playwright' | 'fixture';
  catalogHtml?: string;
  actionsHtml?: string;
  probe: ProviderRegionProbeResult;
  getHtml(url: string): Promise<string | undefined>;
  close(): Promise<void>;
};

export class DnkomLiveScraper implements ProviderScraper {
  providerCode = 'dnkom';

  private readonly maxCatalogItems: number;
  private readonly maxPromotionItems: number;
  private readonly fixtureCatalogHtml?: string;
  private readonly fixtureActionsHtml?: string;
  private readonly fixtureDetailHtmlByUrl: Record<string, string>;
  private readonly useFixturesOnly: boolean;
  private readonly snapshotDir: string;
  private lastProbe?: ProviderRegionProbeResult;

  constructor(options: DnkomLiveScraperOptions = {}) {
    this.maxCatalogItems = options.maxCatalogItems ?? 30;
    this.maxPromotionItems = options.maxPromotionItems ?? 10;
    this.fixtureCatalogHtml = options.fixtureCatalogHtml;
    this.fixtureActionsHtml = options.fixtureActionsHtml;
    this.fixtureDetailHtmlByUrl = options.fixtureDetailHtmlByUrl ?? {};
    this.useFixturesOnly = options.useFixturesOnly ?? false;
    this.snapshotDir = options.snapshotDir ?? path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../fixtures/dnkom',
    );
  }

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const session = await this.createSession(context);

    try {
      const catalogHtml = session.catalogHtml ?? this.fixtureCatalogHtml;

      if (!catalogHtml) {
        throw new Error('DnkomLiveScraper could not load catalog HTML and no fixture was provided');
      }

      const catalog = parseDnkomCatalogHtml(catalogHtml, context, {
        fetchedAt,
        maxItems: this.maxCatalogItems,
        sourceUrl: DNKOM_CATALOG_URL,
      });
      const links = catalog.productsSeen === 0
        ? parseDnkomCatalogLinks(catalogHtml).slice(0, this.maxCatalogItems)
        : [];
      const detailPages = catalog.productsSeen === 0
        ? await this.loadDetailPages(session, links)
        : [];
      const parsedCatalog = catalog.productsSeen > 0
        ? catalog
        : parseDnkomCatalogHtml(catalogHtml, context, {
          fetchedAt,
          maxItems: this.maxCatalogItems,
          sourceUrl: DNKOM_CATALOG_URL,
          detailHtmlByUrl: Object.fromEntries(detailPages.map((page) => [page.url, page.html])),
        });

      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        fetchedAt,
        tests: parsedCatalog.tests,
        prices: parsedCatalog.prices,
        rawPayload: {
          mode: session.mode,
          catalogUrl: DNKOM_CATALOG_URL,
          productsSeen: parsedCatalog.productsSeen,
          linksSeen: links.length,
          parsedCount: parsedCatalog.parsedCount,
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
    const session = await this.createSession(context);

    try {
      const actionsHtml = session.actionsHtml ?? this.fixtureActionsHtml;

      if (!actionsHtml) {
        throw new Error('DnkomLiveScraper could not load actions HTML and no fixture was provided');
      }

      const actionLinks = parseDnkomActionLinks(actionsHtml).slice(0, this.maxPromotionItems);
      const actionPages = await this.loadDetailPages(session, actionLinks);
      const parsed = parseDnkomActionsHtml(actionsHtml, context, {
        fetchedAt,
        maxItems: this.maxPromotionItems,
        detailHtmlByUrl: Object.fromEntries(actionPages.map((page) => [page.url, page.html])),
      });

      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        fetchedAt,
        promotions: parsed.promotions,
        promotionItems: parsed.promotionItems,
        rawPayload: {
          mode: session.mode,
          actionsUrl: DNKOM_ACTIONS_URL,
          linksSeen: parsed.links.length,
          parsedCount: parsed.parsedCount,
          probe: this.lastProbe,
        },
      };
    } finally {
      await session.close();
    }
  }

  async probeRegion(context: ScraperContext): Promise<ProviderRegionProbeResult> {
    const session = await this.createSession(context);
    try {
      return session.probe;
    } finally {
      await session.close();
    }
  }

  private async createSession(context: ScraperContext): Promise<DnkomSession> {
    if (this.useFixturesOnly) {
      const probe = createFixtureProbe(context, 'fixtures_only');
      this.lastProbe = probe;
      return {
        mode: 'fixture',
        catalogHtml: this.fixtureCatalogHtml,
        actionsHtml: this.fixtureActionsHtml,
        probe,
        getHtml: async (url: string) => this.fixtureDetailHtmlByUrl[url],
        close: async () => undefined,
      };
    }

    let browser: Awaited<ReturnType<PlaywrightModule['chromium']['launch']>> | undefined;

    try {
      const playwright = await import('playwright') as PlaywrightModule;
      browser = await playwright.chromium.launch({ headless: true });
      const browserContext = await browser.newContext({
        userAgent: context.userAgent ?? 'LabMindBot/0.1 (+contact@example.com)',
        locale: 'ru-RU',
      });
      const page = await browserContext.newPage();
      const networkRequests: ProviderRegionProbeResult['networkRequests'] = [];

      page.on('request', (request) => {
        const url = request.url();
        if (isRelevantDnkomRequest(url)) {
          networkRequests.push({ url, method: request.method() });
        }
      });
      page.on('response', (response) => {
        const found = networkRequests.find((request) => request.url === response.url());
        if (found) {
          found.responseStatus = response.status();
        }
      });

      await page.goto(DNKOM_CATALOG_URL, { waitUntil: 'commit', timeout: 15_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
      await page.getByText('Да').first().click({ timeout: 3_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      const catalogHtml = await page.content();
      await this.saveSnapshot('catalog-live.html', catalogHtml);

      await page.goto(DNKOM_ACTIONS_URL, { waitUntil: 'commit', timeout: 15_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      const actionsHtml = await page.content();
      await this.saveSnapshot('actions-live.html', actionsHtml);

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
        detectedCity: extractDnkomCurrentCity(catalogHtml) ?? context.region.city,
        cookies: cookies
          .filter((cookie) => /geoip|city|location|region/i.test(cookie.name))
          .map((cookie) => ({
            name: cookie.name,
            valuePreview: cookie.value.slice(0, 80),
            domain: cookie.domain,
          })),
        localStorage,
        networkRequests: networkRequests.slice(0, 30),
        notes: ['Dnkom live probe opened catalog and actions pages with Playwright.'],
        rawPayload: { mode: 'playwright' },
      };
      this.lastProbe = probe;

      return {
        mode: 'playwright',
        catalogHtml,
        actionsHtml,
        probe,
        getHtml: async (url: string) => {
          const response = await browserContext.request.get(url, { timeout: 12_000 });
          return response.ok() ? response.text() : undefined;
        },
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
        catalogHtml: this.fixtureCatalogHtml,
        actionsHtml: this.fixtureActionsHtml,
        probe,
        getHtml: async (url: string) => this.fixtureDetailHtmlByUrl[url],
        close: async () => undefined,
      };
    }
  }

  private async loadDetailPages(
    session: Pick<DnkomSession, 'getHtml'>,
    links: Array<{ url: string; text: string }>,
  ): Promise<DnkomPageResult[]> {
    const pages: DnkomPageResult[] = [];

    for (const link of links) {
      const html = await session.getHtml(link.url);
      if (html) {
        pages.push({ html, url: link.url });
      }
    }

    return pages;
  }

  private async saveSnapshot(fileName: string, html: string): Promise<void> {
    if (this.useFixturesOnly) {
      return;
    }

    await mkdir(this.snapshotDir, { recursive: true });
    await writeFile(path.join(this.snapshotDir, fileName), html, 'utf8');
  }
}

function isRelevantDnkomRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isDnkomHost = parsed.hostname === 'dnkom.ru' || parsed.hostname.endsWith('.dnkom.ru');
    return isDnkomHost && /city|region|location|price|catalog|action|geo/i.test(url);
  } catch {
    return false;
  }
}

function createFixtureProbe(context: ScraperContext, reason: string): ProviderRegionProbeResult {
  return {
    providerCode: 'dnkom',
    regionCode: context.region.code,
    detectedCity: context.region.city,
    cookies: [],
    localStorage: {},
    networkRequests: [],
    notes: [`Using Dnkom HTML fixtures: ${reason}`],
    rawPayload: { mode: 'fixture', reason },
  };
}

function isPricePayload(value: unknown): value is { price: ProviderTestPriceRecord } {
  return typeof value === 'object' && value !== null && 'price' in value;
}
