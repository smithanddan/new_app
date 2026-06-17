import type {
  ProviderRegionProbeResult,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from '../catalog-types.js';
import {
  INVITRO_BASE_URL,
  parseInvitroApiCatalogJson,
  parseInvitroApiPromotionsJson,
  type InvitroApiCatalogParseResult,
} from './invitro.parser.js';
import {
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

type PlaywrightModule = typeof import('playwright');

type InvitroApiScraperOptions = {
  maxCatalogItems?: number;
  maxComplexItems?: number;
  pageSize?: number;
  pageTimeoutMs?: number;
  useFixturesOnly?: boolean;
  fixturePopularJson?: unknown;
  fixtureTestsPageJson?: unknown;
  fixtureComplexesPageJson?: unknown;
  fixturePromotionsJson?: unknown;
};

type InvitroApiSession = {
  mode: 'playwright' | 'fixture';
  probe: ProviderRegionProbeResult;
  fetchJson(endpoint: string): Promise<unknown>;
  close(): Promise<void>;
};

export class InvitroApiScraper implements ProviderScraper {
  providerCode = 'invitro';

  private readonly maxCatalogItems: number;
  private readonly maxComplexItems: number;
  private readonly pageSize: number;
  private readonly pageTimeoutMs: number;
  private readonly useFixturesOnly: boolean;
  private readonly fixturePopularJson?: unknown;
  private readonly fixtureTestsPageJson?: unknown;
  private readonly fixtureComplexesPageJson?: unknown;
  private readonly fixturePromotionsJson?: unknown;
  private lastProbe?: ProviderRegionProbeResult;

  constructor(options: InvitroApiScraperOptions = {}) {
    this.maxCatalogItems = options.maxCatalogItems ?? 50;
    this.maxComplexItems = options.maxComplexItems ?? 25;
    this.pageSize = options.pageSize ?? 25;
    this.pageTimeoutMs = options.pageTimeoutMs ?? 45_000;
    this.useFixturesOnly = options.useFixturesOnly ?? false;
    this.fixturePopularJson = options.fixturePopularJson;
    this.fixtureTestsPageJson = options.fixtureTestsPageJson;
    this.fixtureComplexesPageJson = options.fixtureComplexesPageJson;
    this.fixturePromotionsJson = options.fixturePromotionsJson;
  }

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const cityId = resolveInvitroCityId(context);
    const session = await this.createSession(context);

    try {
      const catalogResults: InvitroApiCatalogParseResult[] = [];

      const popularJson = this.fixturePopularJson ?? await session.fetchJson(`/golk/tests/api/v1/popular?cityID=${cityId}`);
      catalogResults.push(parseInvitroApiCatalogJson(popularJson, context, {
        fetchedAt,
        sourceUrl: `${INVITRO_BASE_URL}/golk/tests/api/v1/popular?cityID=${cityId}`,
      }));

      const testsPages = await this.fetchCatalogPages({
        session,
        context,
        fetchedAt,
        cityId,
        endpointKind: 'tests',
        maxItems: this.maxCatalogItems,
        fixtureFirstPageJson: this.fixtureTestsPageJson,
      });
      catalogResults.push(...testsPages);

      const complexPages = await this.fetchCatalogPages({
        session,
        context,
        fetchedAt,
        cityId,
        endpointKind: 'complexes',
        maxItems: this.maxComplexItems,
        defaultKind: 'profile',
        fixtureFirstPageJson: this.fixtureComplexesPageJson,
      });
      catalogResults.push(...complexPages);

      const merged = mergeCatalogResults(catalogResults);
      const breakdown = {
        popular: catalogResults[0]?.parsedCount ?? 0,
        tests: testsPages.reduce((sum, result) => sum + result.parsedCount, 0),
        complexes: complexPages.reduce((sum, result) => sum + result.parsedCount, 0),
      };

      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        fetchedAt,
        tests: merged.tests,
        prices: merged.prices,
        rawPayload: {
          mode: session.mode,
          cityId,
          maxCatalogItems: this.maxCatalogItems,
          maxComplexItems: this.maxComplexItems,
          pageSize: this.pageSize,
          breakdown,
          parsedCount: merged.tests.length,
          pricesCount: merged.prices.length,
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
    const cityId = resolveInvitroCityId(context);
    const session = await this.createSession(context);

    try {
      const endpoint = `/golk/cms/cms-proxy/promotions/filtered?targetPage=home&cityId=${cityId}&depth=3`;
      const promotionsJson = this.fixturePromotionsJson ?? await session.fetchJson(endpoint);
      const parsed = parseInvitroApiPromotionsJson(promotionsJson, context, {
        fetchedAt,
        sourceUrl: `${INVITRO_BASE_URL}${endpoint}`,
      });

      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        fetchedAt,
        promotions: parsed.promotions,
        promotionItems: [],
        rawPayload: {
          mode: session.mode,
          cityId,
          promotionsParsed: parsed.promotions.length,
          sourceUrl: `${INVITRO_BASE_URL}${endpoint}`,
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

  private async fetchCatalogPages(input: {
    session: InvitroApiSession;
    context: ScraperContext;
    fetchedAt: string;
    cityId: string;
    endpointKind: 'tests' | 'complexes';
    maxItems: number;
    defaultKind?: ProviderTestRecord['kind'];
    fixtureFirstPageJson?: unknown;
  }): Promise<InvitroApiCatalogParseResult[]> {
    if (input.maxItems <= 0) {
      return [];
    }

    const results: InvitroApiCatalogParseResult[] = [];
    const pagesCount = Math.max(1, Math.ceil(input.maxItems / this.pageSize));

    for (let pageIndex = 0; pageIndex < pagesCount; pageIndex += 1) {
      const offset = pageIndex * this.pageSize;
      const endpoint = `/golk/tests/api/v1/${input.endpointKind}?cityID=${input.cityId}&limit=${this.pageSize}&offset=${offset}`;
      const payload = pageIndex === 0 && input.fixtureFirstPageJson !== undefined
        ? input.fixtureFirstPageJson
        : await input.session.fetchJson(endpoint);
      const parsed = parseInvitroApiCatalogJson(payload, input.context, {
        fetchedAt: input.fetchedAt,
        sourceUrl: `${INVITRO_BASE_URL}${endpoint}`,
        defaultKind: input.defaultKind,
        maxItems: Math.max(0, input.maxItems - sumParsed(results)),
      });
      results.push(parsed);

      if (sumParsed(results) >= input.maxItems || parsed.parsedCount === 0) {
        break;
      }

      if (input.session.mode === 'fixture') {
        break;
      }
    }

    return results;
  }

  private async createSession(context: ScraperContext): Promise<InvitroApiSession> {
    if (this.useFixturesOnly) {
      const probe = createFixtureProbe(context, 'fixtures_only');
      this.lastProbe = probe;
      return {
        mode: 'fixture',
        probe,
        fetchJson: async (endpoint) => {
          throw new Error(`INVITRO fixture session has no fixture for endpoint: ${endpoint}`);
        },
        close: async () => undefined,
      };
    }

    const playwright: PlaywrightModule = await import('playwright');
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: context.userAgent ?? 'Mozilla/5.0 lab-crawlers-invitro-api/1.0',
    });
    const notes = [
      'INVITRO catalog is loaded through /golk/tests/api/v1 endpoints from browser context.',
      'Direct non-browser API requests may return the GMonit shell instead of JSON.',
    ];
    try {
      await page.goto(`${INVITRO_BASE_URL}/analizes`, { waitUntil: 'domcontentloaded', timeout: this.pageTimeoutMs });
    } catch (error) {
      notes.push(`Shell bootstrap timed out or failed; continuing with browser context: ${error instanceof Error ? error.message : String(error)}`);
      try {
        await page.goto(INVITRO_BASE_URL, { waitUntil: 'commit', timeout: 10_000 });
        notes.push('Fallback shell bootstrap committed on INVITRO base URL.');
      } catch (fallbackError) {
        notes.push(`Fallback shell bootstrap also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }
    await page.waitForTimeout(1_500);
    const cookies = await page.context().cookies().catch(() => []);
    const localStorage = await page.evaluate(() => Object.fromEntries(Object.entries(window.localStorage))).catch(() => ({}));

    const probe: ProviderRegionProbeResult = {
      providerCode: 'invitro',
      regionCode: context.region.code,
      detectedCity: context.region.city,
      cookies: cookies
        .filter((cookie) => /city|geo|location|session|token/i.test(cookie.name))
        .map((cookie) => ({
          name: cookie.name,
          valuePreview: cookie.value.slice(0, 24),
          domain: cookie.domain,
        })),
      localStorage,
      networkRequests: [],
      notes,
      rawPayload: {
        mode: 'playwright',
        cityId: resolveInvitroCityId(context),
      },
    };
    this.lastProbe = probe;

    return {
      mode: 'playwright',
      probe,
      fetchJson: async (endpoint) => page.evaluate(async (path) => {
        const response = await fetch(path, { headers: { accept: 'application/json' } });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`INVITRO API ${path} failed with ${response.status}: ${text.slice(0, 300)}`);
        }

        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`INVITRO API ${path} returned non-JSON: ${text.slice(0, 300)}`);
        }
      }, endpoint.startsWith('http') ? endpoint : `${INVITRO_BASE_URL}${endpoint}`),
      close: async () => {
        await browser.close();
      },
    };
  }
}

function mergeCatalogResults(results: InvitroApiCatalogParseResult[]): {
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
} {
  const tests: ProviderTestRecord[] = [];
  const prices: ProviderTestPriceRecord[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    for (let index = 0; index < result.tests.length; index += 1) {
      const test = result.tests[index];
      const price = result.prices[index];
      const key = `${test.kind}:${test.externalCode ?? test.externalId ?? test.sourceUrl}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      tests.push(test);
      if (price) {
        prices.push(price);
      }
    }
  }

  return { tests, prices };
}

function sumParsed(results: InvitroApiCatalogParseResult[]): number {
  return results.reduce((sum, result) => sum + result.parsedCount, 0);
}

function resolveInvitroCityId(context: ScraperContext): string {
  return context.region.providerCityId || 'f1c3c4f0-3426-4cda-8449-e5d326e02f97';
}

function createFixtureProbe(context: ScraperContext, reason: string): ProviderRegionProbeResult {
  return {
    providerCode: 'invitro',
    regionCode: context.region.code,
    detectedCity: context.region.city,
    cookies: [],
    localStorage: {},
    networkRequests: [],
    notes: [`Using INVITRO API JSON fixtures: ${reason}`],
    rawPayload: { mode: 'fixture', reason },
  };
}

function isPricePayload(value: unknown): value is { price: ProviderTestPriceRecord } {
  return typeof value === 'object' && value !== null && 'price' in value;
}
