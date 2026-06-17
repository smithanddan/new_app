import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProviderCode, ProviderTestPriceRecord, ProviderTestRecord } from './catalog-types.js';
import { DnkomLiveScraper } from './adapters/dnkom-live.scraper.js';
import { GemotestLiveScraper } from './adapters/gemotest-live.scraper.js';
import { GEMOTEST_MOSCOW_CATALOG_SECTION_URLS } from './adapters/gemotest.parser.js';
import { InvitroApiScraper } from './adapters/invitro-api.scraper.js';
import {
  createExpansionProviderScraper,
  getExpansionProviderConfig,
  type ExpansionProviderCode,
} from './adapters/provider-expansion.scraper.js';
import type {
  CatalogSyncResult,
  PromotionSyncResult,
  ProviderScraper,
  ScraperContext,
} from './provider-scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

export type CrawlerProviderKey = 'dnkom' | 'gemotest' | 'invitro' | ExpansionProviderCode;

export type CrawlerTransport = {
  mode: 'http' | 'playwright';
  fallback?: 'playwright';
};

export interface ProviderAdapter {
  providerCode: CrawlerProviderKey;
  buildContext(region: string): ScraperContext;
  crawlCatalog(context: ScraperContext): Promise<CatalogSyncResult>;
  crawlPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]>;
  crawlPromotions(context: ScraperContext): Promise<PromotionSyncResult>;
}

class ScraperProviderAdapter implements ProviderAdapter {
  constructor(
    readonly providerCode: CrawlerProviderKey,
    private readonly scraper: ProviderScraper,
    private readonly contextFactory: (region: string) => ScraperContext,
  ) {}

  buildContext(region: string): ScraperContext {
    return this.contextFactory(region);
  }

  crawlCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    return this.scraper.syncCatalog(context);
  }

  crawlPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]> {
    return this.scraper.syncPrices(context, tests);
  }

  crawlPromotions(context: ScraperContext): Promise<PromotionSyncResult> {
    return this.scraper.syncPromotions(context);
  }
}

export function createProviderAdapter(provider: CrawlerProviderKey): ProviderAdapter {
  if (provider === 'dnkom') {
    return new ScraperProviderAdapter(provider, createDnkomScraper(), createDnkomContext);
  }

  if (provider === 'gemotest') {
    return new ScraperProviderAdapter(provider, createGemotestScraper(), createGemotestContext);
  }

  if (provider === 'invitro') {
    return new ScraperProviderAdapter(provider, createInvitroScraper(), createInvitroContext);
  }

  return new ScraperProviderAdapter(provider, createExpansionProviderScraper(provider), createExpansionProviderContext(provider));
}

export function buildCrawlerTransport(provider: ProviderCode): CrawlerTransport {
  return provider === 'dnkom' || provider === 'gemotest' || provider === 'invitro'
    ? { mode: 'playwright' }
    : { mode: 'http', fallback: 'playwright' };
}

export function resolveProviderRegion(provider: CrawlerProviderKey, region: string): string {
  const normalized = region.toLocaleLowerCase('ru-RU');
  if (normalized === 'москва' || normalized === 'moscow' || normalized === 'moskva') {
    if (provider === 'gemotest' || provider === 'helix' || provider === 'citilab') {
      return 'moskva';
    }
    if (provider === 'cmd' || provider === 'kdl') {
      return 'msk';
    }
    return 'moscow';
  }

  return region;
}

function createDnkomScraper(): DnkomLiveScraper {
  const fixturesDir = path.join(packageRoot, 'fixtures/dnkom');
  const detailUrl = 'https://dnkom.ru/analizy-i-tseny/po-tipu/issledovanie-urovnya-glyukozy-metodom-nepreryvnogo-monitorirovaniya-datchik-lumiflex-linx-do-16-sutok/';
  const actionUrl = 'https://dnkom.ru/actions/biokhimiya_krovi/';

  return new DnkomLiveScraper({
    maxCatalogItems: Number(process.env.DNKOM_SYNC_LIMIT ?? 25),
    maxPromotionItems: Number(process.env.DNKOM_SYNC_PROMO_LIMIT ?? 8),
    fixtureCatalogHtml: readFixture(fixturesDir, 'catalog-live.html'),
    fixtureActionsHtml: readFixture(fixturesDir, 'actions-live.html'),
    fixtureDetailHtmlByUrl: {
      [detailUrl]: readFixture(fixturesDir, 'detail-glucose-monitor.html') ?? '',
      [actionUrl]: readFixture(fixturesDir, 'action-biochemistry.html') ?? '',
    },
    useFixturesOnly: process.env.DNKOM_FIXTURE_ONLY === '1',
  });
}

function createGemotestScraper(): GemotestLiveScraper {
  const fixturesDir = path.join(packageRoot, 'fixtures/gemotest');

  return new GemotestLiveScraper({
    maxCatalogItems: Number(process.env.GEMOTEST_SYNC_LIMIT ?? 50),
    fixtureCatalogHtml: readFixture(fixturesDir, 'catalog-moskva.html'),
    fixtureCatalogHtmls: readFixturePages(fixturesDir),
    catalogUrls: readGemotestCatalogUrls(),
    pageTimeoutMs: Number(process.env.GEMOTEST_PAGE_TIMEOUT_MS ?? 45_000),
    useFixturesOnly: process.env.GEMOTEST_FIXTURE_ONLY === '1',
  });
}

function createInvitroScraper(): InvitroApiScraper {
  const fixturesDir = path.join(packageRoot, 'fixtures/invitro');
  const useFixturesOnly = process.env.INVITRO_FIXTURE_ONLY === '1';

  return new InvitroApiScraper({
    maxCatalogItems: Number(process.env.INVITRO_SYNC_LIMIT ?? 50),
    maxComplexItems: Number(process.env.INVITRO_COMPLEX_SYNC_LIMIT ?? 25),
    pageSize: Number(process.env.INVITRO_PAGE_SIZE ?? 25),
    useFixturesOnly,
    fixturePopularJson: useFixturesOnly ? readJsonFixture(fixturesDir, 'api-popular.json') : undefined,
    fixtureTestsPageJson: useFixturesOnly ? readJsonFixture(fixturesDir, 'api-tests-page-1.json') : undefined,
    fixtureComplexesPageJson: useFixturesOnly ? readJsonFixture(fixturesDir, 'api-complexes-page-1.json') : undefined,
    fixturePromotionsJson: useFixturesOnly ? readJsonFixture(fixturesDir, 'api-promotions-home.json') : undefined,
  });
}

function createDnkomContext(region: string): ScraperContext {
  return {
    providerCode: 'dnkom',
    region: {
      code: resolveProviderRegion('dnkom', region),
      city: 'Москва',
    },
  };
}

function createGemotestContext(region: string): ScraperContext {
  return {
    providerCode: 'gemotest',
    region: {
      code: resolveProviderRegion('gemotest', region),
      city: 'Москва',
      urlPrefix: '/moskva',
    },
  };
}

function createInvitroContext(region: string): ScraperContext {
  return {
    providerCode: 'invitro',
    region: {
      code: resolveProviderRegion('invitro', region),
      city: 'Москва',
      urlPrefix: '/moscow',
      providerCityId: 'f1c3c4f0-3426-4cda-8449-e5d326e02f97',
    },
  };
}

function createExpansionProviderContext(provider: ExpansionProviderCode): (region: string) => ScraperContext {
  return (region: string) => {
    const config = getExpansionProviderConfig(provider);
    return {
      providerCode: provider,
      region: {
        code: resolveProviderRegion(provider, region),
        city: 'Москва',
        urlPrefix: config.defaultUrlPrefix,
      },
    };
  };
}

function readGemotestCatalogUrls(): string[] | undefined {
  const value = process.env.GEMOTEST_CATALOG_URLS;
  if (value) {
    return value.split(',').map((url) => url.trim()).filter(Boolean);
  }

  if (process.env.GEMOTEST_USE_DEFAULT_SECTIONS === '1') {
    return GEMOTEST_MOSCOW_CATALOG_SECTION_URLS;
  }

  return undefined;
}

function readFixture(fixturesDir: string, name: string): string | undefined {
  const filePath = path.join(fixturesDir, name);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : undefined;
}

function readJsonFixture(fixturesDir: string, name: string): unknown {
  const filePath = path.join(fixturesDir, name);
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : undefined;
}

function readFixturePages(fixturesDir: string): Array<{ html: string; sourceUrl?: string }> {
  if (!fs.existsSync(fixturesDir)) {
    return [];
  }

  return fs.readdirSync(fixturesDir)
    .filter((name) => /^catalog-page-\d+\.html$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => ({ html: fs.readFileSync(path.join(fixturesDir, name), 'utf8') }));
}
