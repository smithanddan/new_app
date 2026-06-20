import type {
  LabPromotionRecord,
  ProviderCode,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from '../catalog-types.js';
import type {
  CatalogSyncResult,
  PromotionSyncResult,
  ProviderScraper,
  ScraperContext,
} from '../provider-scraper.js';
import {
  CMD_KARYOTYPE_SEARCH_TERMS,
  CMD_MOSCOW_CATALOG_URL,
  buildCmdAnalyzeSearchUrl,
  parseCmdCatalogHtml,
} from './cmd.parser.js';

type CmdLoadedPage = {
  html: string;
  sourceUrl: string;
  origin: 'live' | 'fixture' | 'fixture_fallback';
  strategy: 'catalog' | 'targeted_search';
};

type CmdPageFailure = {
  sourceUrl: string;
  strategy: 'catalog' | 'targeted_search';
  error: string;
};

export type CmdLiveScraperOptions = {
  catalogUrls?: string[];
  searchUrls?: string[];
  fixtureCatalogHtml?: string;
  fixtureSearchHtmls?: Array<{ html: string; sourceUrl?: string }>;
  maxCatalogItems?: number;
  pageTimeoutMs?: number;
  useFixturesOnly?: boolean;
};

export class CmdLiveScraper implements ProviderScraper {
  readonly providerCode: ProviderCode = 'cmd';

  private readonly catalogUrls: string[];
  private readonly searchUrls: string[];
  private readonly maxCatalogItems: number;
  private readonly pageTimeoutMs: number;
  private readonly useFixturesOnly: boolean;

  constructor(private readonly options: CmdLiveScraperOptions = {}) {
    this.catalogUrls = options.catalogUrls?.length ? options.catalogUrls : [CMD_MOSCOW_CATALOG_URL];
    this.searchUrls = options.searchUrls?.length
      ? options.searchUrls
      : CMD_KARYOTYPE_SEARCH_TERMS.map((term) => buildCmdAnalyzeSearchUrl(term));
    this.maxCatalogItems = options.maxCatalogItems ?? 75;
    this.pageTimeoutMs = options.pageTimeoutMs ?? 30_000;
    this.useFixturesOnly = options.useFixturesOnly ?? false;
  }

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const { pages, failures } = await this.loadPages();
    const parsedPages = pages.map((page) => parseCmdCatalogHtml(page.html, context, {
      fetchedAt,
      maxItems: this.maxCatalogItems,
      sourceUrl: page.sourceUrl,
    }));
    const tests = dedupeByExternalId(parsedPages.flatMap((page) => page.tests));
    const prices = dedupePrices(parsedPages.flatMap((page) => page.prices));
    const karyotypeMatches = parsedPages.flatMap((page) => page.karyotypeProbe.matches);

    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      tests,
      prices,
      rawPayload: {
        mode: this.useFixturesOnly ? 'cmd_fixture_html' : 'cmd_live_html',
        provider: this.providerCode,
        catalogUrls: this.catalogUrls,
        searchUrls: this.searchUrls,
        searchTerms: CMD_KARYOTYPE_SEARCH_TERMS,
        pages: parsedPages.map((page, index) => ({
          sourceUrl: pages[index]?.sourceUrl,
          origin: pages[index]?.origin,
          strategy: pages[index]?.strategy,
          cardsSeen: page.cardsSeen,
          parsedCount: page.parsedCount,
          karyotypeProbe: page.karyotypeProbe,
        })),
        failures,
        karyotypeProbe: {
          status: karyotypeMatches.length > 0 ? 'found' : 'not_found',
          matches: karyotypeMatches,
        },
        note: karyotypeMatches.length > 0
          ? 'Karyotype candidates were found in captured CMD catalog/search pages.'
          : 'Karyotype was not found in captured CMD catalog/search pages; dry-run should surface this without failing.',
      },
    };
  }

  async syncPrices(_context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]> {
    return tests
      .map((test) => extractPrice(test))
      .filter((price): price is ProviderTestPriceRecord => price !== undefined);
  }

  async syncPromotions(context: ScraperContext): Promise<PromotionSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const promotions: LabPromotionRecord[] = [];
    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      promotions,
      promotionItems: [],
      rawPayload: {
        mode: 'cmd_promotions_placeholder',
        provider: this.providerCode,
        note: 'CMD catalog ingestion v1 parses tests and prices only.',
      },
    };
  }

  private async loadPages(): Promise<{ pages: CmdLoadedPage[]; failures: CmdPageFailure[] }> {
    const fixturePages: CmdLoadedPage[] = [
      this.options.fixtureCatalogHtml ? {
        html: this.options.fixtureCatalogHtml,
        sourceUrl: this.catalogUrls[0] ?? CMD_MOSCOW_CATALOG_URL,
        origin: 'fixture',
        strategy: 'catalog',
      } : undefined,
      ...(this.options.fixtureSearchHtmls ?? []).map((page) => ({
        html: page.html,
        sourceUrl: page.sourceUrl ?? CMD_MOSCOW_CATALOG_URL,
        origin: 'fixture' as const,
        strategy: 'targeted_search' as const,
      })),
    ].filter((page): page is CmdLoadedPage => page !== undefined);

    if (this.useFixturesOnly) {
      return { pages: fixturePages, failures: [] };
    }

    const pages: CmdLoadedPage[] = [];
    const failures: CmdPageFailure[] = [];
    for (const target of [
      ...this.catalogUrls.map((url) => ({ url, strategy: 'catalog' as const })),
      ...this.searchUrls.map((url) => ({ url, strategy: 'targeted_search' as const })),
    ]) {
      try {
        pages.push({
          html: await fetchText(target.url, this.pageTimeoutMs),
          sourceUrl: target.url,
          origin: 'live',
          strategy: target.strategy,
        });
      } catch (error) {
        failures.push({
          sourceUrl: target.url,
          strategy: target.strategy,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (pages.length > 0) {
      return { pages, failures };
    }

    if (fixturePages.length === 0) {
      throw new Error(`CMD fetch failed for all pages: ${failures.map((failure) => failure.error).join('; ')}`);
    }

    return {
      pages: fixturePages.map((page) => ({ ...page, origin: 'fixture_fallback' as const })),
      failures,
    };
  }
}

function extractPrice(test: ProviderTestRecord): ProviderTestPriceRecord | undefined {
  const rawPayload = test.rawPayload as { price?: ProviderTestPriceRecord } | undefined;
  return rawPayload?.price;
}

function dedupeByExternalId(tests: ProviderTestRecord[]): ProviderTestRecord[] {
  const seen = new Set<string>();
  return tests.filter((test) => {
    const key = test.externalId ?? test.sourceUrl;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupePrices(prices: ProviderTestPriceRecord[]): ProviderTestPriceRecord[] {
  const seen = new Set<string>();
  return prices.filter((price) => {
    const key = [
      price.externalId,
      price.externalCode,
      price.regularPriceRub,
      price.effectivePriceRub,
      price.sourceUrl,
    ].join('|');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 LabMindBot/1.0 (+https://labmind.local)',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`CMD fetch failed: ${response.status} ${response.statusText} ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
