import type {
  LabPromotionItemRecord,
  LabPromotionRecord,
  ProviderRegionProbeResult,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from '../catalog-types.js';
import {
  effectivePriceRub,
  normalizeProviderName,
  toRubles,
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

const DNKOM_BASE_URL = 'https://dnkom.ru';
const DNKOM_CATALOG_URL = `${DNKOM_BASE_URL}/analizy-i-tseny/po-tipu/`;
const DNKOM_ACTIONS_URL = `${DNKOM_BASE_URL}/actions/`;

type PlaywrightModule = typeof import('playwright');

type DnkomLiveScraperOptions = {
  maxCatalogItems?: number;
  maxPromotionItems?: number;
  fixtureCatalogHtml?: string;
  fixtureActionsHtml?: string;
  fixtureDetailHtmlByUrl?: Record<string, string>;
  useFixturesOnly?: boolean;
};

type DnkomPageResult = {
  html: string;
  url: string;
};

type DnkomProductInfo = {
  id?: string;
  name?: string;
  price?: number;
  sourceUrl?: string;
};

type RequiredDnkomProductInfo = DnkomProductInfo & {
  id: string;
  name: string;
  price: number;
};

export class DnkomLiveScraper implements ProviderScraper {
  providerCode = 'dnkom';

  private readonly maxCatalogItems: number;
  private readonly maxPromotionItems: number;
  private readonly fixtureCatalogHtml?: string;
  private readonly fixtureActionsHtml?: string;
  private readonly fixtureDetailHtmlByUrl: Record<string, string>;
  private readonly useFixturesOnly: boolean;
  private lastProbe?: ProviderRegionProbeResult;

  constructor(options: DnkomLiveScraperOptions = {}) {
    this.maxCatalogItems = options.maxCatalogItems ?? 30;
    this.maxPromotionItems = options.maxPromotionItems ?? 10;
    this.fixtureCatalogHtml = options.fixtureCatalogHtml;
    this.fixtureActionsHtml = options.fixtureActionsHtml;
    this.fixtureDetailHtmlByUrl = options.fixtureDetailHtmlByUrl ?? {};
    this.useFixturesOnly = options.useFixturesOnly ?? false;
  }

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const session = await this.createSession(context);

    try {
      const catalogHtml = session.catalogHtml ?? this.fixtureCatalogHtml;

      if (!catalogHtml) {
        throw new Error('DnkomLiveScraper could not load catalog HTML and no fixture was provided');
      }

      const productItems = parseCatalogProducts(catalogHtml, DNKOM_CATALOG_URL, context, fetchedAt)
        .slice(0, this.maxCatalogItems);
      const links = productItems.length === 0 ? parseCatalogLinks(catalogHtml).slice(0, this.maxCatalogItems) : [];
      const detailPages = productItems.length === 0 ? await this.loadDetailPages(session, links, { closeSession: false }) : [];
      const detailItems = detailPages
        .map((page) => parseCatalogDetail(page.html, page.url, context, fetchedAt))
        .filter((item): item is { test: ProviderTestRecord; price: ProviderTestPriceRecord } => item !== undefined);
      const parsedItems = productItems.length > 0 ? productItems : detailItems;

      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        fetchedAt,
        tests: parsedItems.map((item) => item.test),
        prices: parsedItems.map((item) => item.price),
        rawPayload: {
          mode: session.mode,
          catalogUrl: DNKOM_CATALOG_URL,
          productsSeen: productItems.length,
          linksSeen: links.length,
          parsedCount: parsedItems.length,
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
    const actionsHtml = session.actionsHtml ?? this.fixtureActionsHtml;

    if (!actionsHtml) {
      throw new Error('DnkomLiveScraper could not load actions HTML and no fixture was provided');
    }

    const actionLinks = parseActionLinks(actionsHtml).slice(0, this.maxPromotionItems);
    const actionPages = await this.loadDetailPages(session, actionLinks);
    const parsed = actionPages
      .map((page) => parseActionDetail(page.html, page.url, context, fetchedAt))
      .filter((item): item is { promotion: LabPromotionRecord; items: LabPromotionItemRecord[] } => item !== undefined);

    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      promotions: parsed.map((item) => item.promotion),
      promotionItems: parsed.flatMap((item) => item.items),
      rawPayload: {
        mode: session.mode,
        actionsUrl: DNKOM_ACTIONS_URL,
        linksSeen: actionLinks.length,
        parsedCount: parsed.length,
        probe: this.lastProbe,
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

  private async createSession(context: ScraperContext): Promise<{
    mode: 'playwright' | 'fixture';
    catalogHtml?: string;
    actionsHtml?: string;
    probe: ProviderRegionProbeResult;
    getHtml(url: string): Promise<string | undefined>;
    close(): Promise<void>;
  }> {
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

      await page.goto(DNKOM_ACTIONS_URL, { waitUntil: 'commit', timeout: 15_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      const actionsHtml = await page.content();

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
        detectedCity: extractCurrentCity(catalogHtml) ?? context.region.city,
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
      const activeBrowser = browser;
      const activeBrowserContext = browserContext;

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
          await activeBrowserContext.close().catch(() => undefined);
          await activeBrowser.close().catch(() => undefined);
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
    session: { getHtml(url: string): Promise<string | undefined>; close(): Promise<void> },
    links: Array<{ url: string; text: string }>,
    options: { closeSession?: boolean } = {},
  ): Promise<DnkomPageResult[]> {
    const pages: DnkomPageResult[] = [];

    try {
      for (const link of links) {
        const html = await session.getHtml(link.url);
        if (html) {
          pages.push({ html, url: link.url });
        }
      }
    } finally {
      if (options.closeSession ?? true) {
        await session.close();
      }
    }

    return pages;
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

function parseCatalogLinks(html: string): Array<{ url: string; text: string }> {
  const seen = new Set<string>();
  return extractLinks(html)
    .filter((link) => link.href.startsWith('/analizy-i-tseny/po-tipu/'))
    .filter((link) => link.href !== '/analizy-i-tseny/po-tipu/')
    .filter((link) => link.text.length > 8)
    .map((link) => ({ url: new URL(link.href, DNKOM_BASE_URL).toString(), text: link.text }))
    .filter((link) => {
      if (seen.has(link.url)) {
        return false;
      }
      seen.add(link.url);
      return true;
    });
}

function parseActionLinks(html: string): Array<{ url: string; text: string }> {
  const seen = new Set<string>();
  return extractLinks(html)
    .filter((link) => /^\/actions\/[^/]+\/$/.test(link.href))
    .filter((link) => link.text.length > 5)
    .map((link) => ({ url: new URL(link.href, DNKOM_BASE_URL).toString(), text: link.text }))
    .filter((link) => {
      if (seen.has(link.url)) {
        return false;
      }
      seen.add(link.url);
      return true;
    });
}

function parseCatalogProducts(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt: string,
): Array<{ test: ProviderTestRecord; price: ProviderTestPriceRecord }> {
  return extractProductInfos(html)
    .filter(hasRequiredProductFields)
    .map((product) => {
      const sourceUrl = product.sourceUrl ?? url;
      const regularPriceRub = toRubles(product.price);
      const price: ProviderTestPriceRecord = {
        providerCode: 'dnkom',
        regionCode: context.region.code,
        city: context.region.city,
        externalId: product.id,
        externalCode: product.id,
        currency: 'RUB',
        regularPriceRub,
        effectivePriceRub: effectivePriceRub({ regularPriceRub }),
        offerType: 'regular',
        sourceUrl,
        fetchedAt,
        rawPayload: {
          parser: 'dnkom-live-catalog-product',
          product,
          detectedCity: extractCurrentCity(html),
        },
      };

      return {
        test: {
          providerCode: 'dnkom',
          regionCode: context.region.code,
          externalId: product.id,
          externalCode: product.id,
          name: product.name,
          normalizedName: normalizeProviderName(product.name),
          kind: 'analysis',
          sourceUrl,
          matchStatus: 'unmatched',
          fetchedAt,
          rawPayload: {
            parser: 'dnkom-live-catalog-product',
            price,
            product,
          },
        },
        price,
      };
    });
}

function parseCatalogDetail(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt: string,
): { test: ProviderTestRecord; price: ProviderTestPriceRecord } | undefined {
  const product = extractFirstProductInfo(html);
  const name = cleanText(
    product?.name
      ?? matchFirst(html, /<h1[^>]*class=["'][^"']*header[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      ?? matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
      ?? '',
  ).replace(/\s+в Москве$/i, '');
  const externalCode = product?.id ?? cleanText(matchFirst(html, /<div[^>]*class=["'][^"']*code data[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ?? '');
  const regularPriceRub = toRubles(
    product?.price
      ?? matchFirst(html, /<meta\s+itemprop=["']price["']\s+content=["']([^"']+)["']/i)
      ?? matchFirst(html, /<div[^>]*class=["'][^"']*price-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i),
  );

  if (!name || regularPriceRub === undefined) {
    return undefined;
  }

  const effective = effectivePriceRub({ regularPriceRub });
  const price: ProviderTestPriceRecord = {
    providerCode: 'dnkom',
    regionCode: context.region.code,
    city: context.region.city,
    externalId: externalCode || url,
    externalCode: externalCode || undefined,
    currency: 'RUB',
    regularPriceRub,
    effectivePriceRub: effective,
    offerType: 'regular',
    sourceUrl: url,
    fetchedAt,
    rawPayload: {
      parser: 'dnkom-live-detail',
      product,
      detectedCity: extractCurrentCity(html),
    },
  };

  return {
    test: {
      providerCode: 'dnkom',
      regionCode: context.region.code,
      externalId: price.externalId,
      externalCode: price.externalCode,
      name,
      normalizedName: normalizeProviderName(name),
      kind: 'analysis',
      sourceUrl: url,
      matchStatus: 'unmatched',
      fetchedAt,
      rawPayload: {
        parser: 'dnkom-live-detail',
        price,
        product,
      },
    },
    price,
  };
}

function parseActionDetail(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt: string,
): { promotion: LabPromotionRecord; items: LabPromotionItemRecord[] } | undefined {
  const title = cleanText(
    matchFirst(html, /<h1[^>]*class=["'][^"']*(?:banner-heading|heading)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      ?? matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
      ?? matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
      ?? '',
  ).replace(/\s+в Москве.*$/i, '');
  const validTo = parseRussianDate(matchFirst(html, /до\s+(\d{2}\.\d{2}\.\d{4})/i));
  const product = extractFirstProductInfo(html);
  const itemName = cleanText(
    product?.name
      ?? matchFirst(html, /<div[^>]*class=["'][^"']*item-main-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      ?? title,
  );
  const promoPriceRub = toRubles(
    product?.price
      ?? matchFirst(html, /<div[^>]*class=["'][^"']*item-price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i),
  );
  const externalCode = product?.id ?? cleanText(matchFirst(html, /<span[^>]*class=["'][^"']*item-main-code[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ?? '');

  if (!title) {
    return undefined;
  }

  const promotion: LabPromotionRecord = {
    providerCode: 'dnkom',
    regionCode: context.region.code,
    externalId: url,
    title,
    offerType: 'promo',
    endsOn: validTo,
    regionScope: context.region.city,
    sourceUrl: url,
    fetchedAt,
    rawPayload: {
      parser: 'dnkom-live-action',
      product,
      detectedCity: extractCurrentCity(html),
    },
  };

  const items: LabPromotionItemRecord[] = promoPriceRub === undefined ? [] : [{
    promotionExternalId: promotion.externalId,
    providerCode: 'dnkom',
    regionCode: context.region.code,
    externalId: externalCode || url,
    originalName: itemName || title,
    promoPriceRub,
    effectivePriceRub: promoPriceRub,
    sourceUrl: url,
    rawPayload: {
      parser: 'dnkom-live-action-item',
      product,
    },
  }];

  return { promotion, items };
}

function extractLinks(html: string): Array<{ href: string; text: string }> {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: decodeHtml(match[1]),
      text: cleanText(match[2]),
    }));
}

function extractFirstProductInfo(html: string): DnkomProductInfo | undefined {
  return extractProductInfos(html)[0];
}

function extractProductInfos(html: string): DnkomProductInfo[] {
  return [...html.matchAll(/data-product-info=(["'])([\s\S]*?)\1/gi)]
    .map<DnkomProductInfo | undefined>((match) => {
      const raw = match[2];
      const sourceUrl = extractNearestHrefBefore(html, match.index ?? 0);
      try {
        const parsed = JSON.parse(decodeHtml(raw));
        const item = Array.isArray(parsed) ? parsed[0] : parsed;
        return {
          id: item.id === undefined ? undefined : String(item.id),
          name: item.name === undefined ? undefined : String(item.name),
          price: item.price === undefined ? undefined : Number(item.price),
          sourceUrl,
        };
      } catch {
        return undefined;
      }
    })
    .filter((item): item is DnkomProductInfo => item !== undefined);
}

function hasRequiredProductFields(product: DnkomProductInfo): product is RequiredDnkomProductInfo {
  return Boolean(product.id && product.name && product.price !== undefined);
}

function extractNearestHrefBefore(html: string, index: number): string | undefined {
  const nearby = html.slice(Math.max(0, index - 2_000), index);
  const links = [...nearby.matchAll(/href=["']([^"']+)["']/gi)];
  const href = links.at(-1)?.[1];
  return href?.startsWith('/') ? new URL(href, DNKOM_BASE_URL).toString() : href;
}

function extractCurrentCity(html: string): string | undefined {
  return cleanText(
    matchFirst(html, /<span[^>]*class=["'][^"']*(?:current-city|city-name)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ?? '',
  ) || undefined;
}

function parseRussianDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function matchFirst(html: string, pattern: RegExp, group = 1): string | undefined {
  return html.match(pattern)?.[group];
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function isPricePayload(value: unknown): value is { price: ProviderTestPriceRecord } {
  return typeof value === 'object' && value !== null && 'price' in value;
}
