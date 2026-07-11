import type {
  LabPromotionRecord,
  ProviderCode,
  ProviderRegionProbeResult,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from '../catalog-types.js';
import {
  effectivePriceRub,
  toRubles,
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

export type ExpansionProviderCode = 'cmd' | 'helix' | 'kdl' | 'citilab';

type ExpansionProviderCatalogItem = {
  externalId: string;
  externalCode: string;
  name: string;
  canonicalHint: string;
  category: string;
  regularPriceRub: number;
  biomaterialPriceRub?: number;
  sourceUrl: string;
};

type ExpansionProviderConfig = {
  providerCode: ExpansionProviderCode;
  displayName: string;
  catalogUrl: string;
  promotionsUrl: string;
  defaultUrlPrefix: string;
  items: ExpansionProviderCatalogItem[];
};

const PROVIDER_CONFIGS: Record<ExpansionProviderCode, ExpansionProviderConfig> = {
  cmd: {
    providerCode: 'cmd',
    displayName: 'CMD',
    catalogUrl: 'https://www.cmd-online.ru/analizy-i-tseny/katalog-analizov/msk/',
    promotionsUrl: 'https://www.cmd-online.ru/aktsii/',
    defaultUrlPrefix: '/analizy-i-tseny/katalog-analizov/msk',
    items: [
      item('CMD-CBC-110006', '110006', 'Общий анализ крови (ОАК) + СОЭ с лейкоцитарной формулой', 'Общий анализ крови', 'Гематология', 820, 0, 'https://www.cmd-online.ru/analizy-i-tseny/katalog-analizov/msk/'),
      item('CMD-UA-110101', '110101', 'Общий анализ мочи (Urine test) с микроскопией осадка', 'Общий анализ мочи', 'Моча', 445, 0, 'https://www.cmd-online.ru/analizy-i-tseny/katalog-analizov/msk/'),
      item('CMD-GLU-MOCK', 'GLU', 'Глюкоза', 'Глюкоза', 'Биохимия', 530, 0, 'https://www.cmd-online.ru/analizy-i-tseny/katalog-analizov/msk/'),
    ],
  },
  helix: {
    providerCode: 'helix',
    displayName: 'Хеликс',
    catalogUrl: 'https://helix.ru/moskva/catalog/190-vse-analizy',
    promotionsUrl: 'https://helix.ru/moskva/actions',
    defaultUrlPrefix: '/moskva',
    items: [
      item('HELIX-FER', 'FER', 'Ферритин', 'Ферритин', 'Железо', 800, 0, 'https://helix.ru/moskva'),
      item('HELIX-VITD', 'VITD', 'Витамин D, 25-гидрокси (кальциферол)', 'Витамин D', 'Витамины', 2185, 0, 'https://helix.ru/moskva'),
      item('HELIX-TSH-MOCK', 'TSH', 'Тиреотропный гормон (ТТГ)', 'ТТГ', 'Гормоны', 690, 0, 'https://helix.ru/moskva/catalog/190-vse-analizy'),
    ],
  },
  kdl: {
    providerCode: 'kdl',
    displayName: 'KDL',
    catalogUrl: 'https://kdl.ru/analizy-i-tseny/msk',
    promotionsUrl: 'https://kdl.ru/actions',
    defaultUrlPrefix: '/analizy-i-tseny/msk',
    items: [
      item('KDL-CBC-MOCK', 'CBC', 'Общий анализ крови', 'Общий анализ крови', 'Гематология', 740, 0, 'https://kdl.ru/analizy-i-tseny/msk'),
      item('KDL-FER-MOCK', 'FER', 'Ферритин', 'Ферритин', 'Железо', 920, 0, 'https://kdl.ru/analizy-i-tseny/msk'),
      item('KDL-CREA-MOCK', 'CREA', 'Креатинин', 'Креатинин', 'Биохимия', 365, 0, 'https://kdl.ru/analizy-i-tseny/msk'),
    ],
  },
  citilab: {
    providerCode: 'citilab',
    displayName: 'СИТИЛАБ',
    catalogUrl: 'https://citilab.ru/moskva/catalog/',
    promotionsUrl: 'https://citilab.ru/moskva/actions/',
    defaultUrlPrefix: '/moskva',
    items: [
      item('CITILAB-VITD-PROMO', 'VITD', 'Витамин D', 'Витамин D', 'Витамины', 1, 0, 'https://citilab.ru/'),
      item('CITILAB-GLU-MOCK', 'GLU', 'Глюкоза', 'Глюкоза', 'Биохимия', 410, 0, 'https://citilab.ru/moskva/catalog/'),
      item('CITILAB-TSH-MOCK', 'TSH', 'ТТГ', 'ТТГ', 'Гормоны', 690, 0, 'https://citilab.ru/moskva/catalog/'),
    ],
  },
};

export class ExpansionProviderScraper implements ProviderScraper {
  readonly providerCode: ProviderCode;

  constructor(private readonly config: ExpansionProviderConfig) {
    this.providerCode = config.providerCode;
  }

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const tests: ProviderTestRecord[] = this.config.items.map((catalogItem) => ({
      providerCode: this.providerCode,
      regionCode: context.region.code,
      externalId: catalogItem.externalId,
      externalCode: catalogItem.externalCode,
      name: catalogItem.name,
      kind: 'analysis',
      category: catalogItem.category,
      sourceUrl: catalogItem.sourceUrl,
      matchStatus: 'unmatched',
      fetchedAt,
      rawPayload: buildRawPayload(this.config, catalogItem),
    }));

    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      tests,
      prices: await this.syncPrices(context, tests),
      rawPayload: {
        mode: 'provider_expansion_mock',
        provider: this.providerCode,
        displayName: this.config.displayName,
        catalogUrl: this.config.catalogUrl,
        note: 'Seed/probe adapter. Replace with live scraper before production scheduled writes.',
      },
    };
  }

  async syncPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const itemByExternalId = new Map(this.config.items.map((itemConfig) => [itemConfig.externalId, itemConfig]));

    return tests.map((test) => {
      const catalogItem = itemByExternalId.get(test.externalId ?? '');
      const regularPriceRub = toRubles(catalogItem?.regularPriceRub);
      const biomaterialPriceRub = toRubles(catalogItem?.biomaterialPriceRub);
      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        city: context.region.city,
        externalId: test.externalId,
        externalCode: test.externalCode,
        currency: 'RUB',
        regularPriceRub,
        effectivePriceRub: effectivePriceRub({ regularPriceRub }),
        biomaterialPriceRub,
        offerType: catalogItem?.externalId.includes('PROMO') ? 'promo' : 'regular',
        sourceUrl: test.sourceUrl,
        fetchedAt,
        rawPayload: buildRawPayload(this.config, catalogItem),
      };
    });
  }

  async syncPromotions(context: ScraperContext): Promise<PromotionSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const promotions: LabPromotionRecord[] = this.config.providerCode === 'citilab'
      ? [{
          providerCode: this.providerCode,
          regionCode: context.region.code,
          externalId: 'CITILAB-VITD-FIRST-VISIT',
          title: 'Витамин D за 1 ₽ для новых клиентов',
          offerType: 'promo',
          regionScope: 'Москва',
          sourceUrl: this.config.promotionsUrl,
          fetchedAt,
          rawPayload: {
            mode: 'provider_expansion_mock',
            provider: this.providerCode,
            sourceUrl: this.config.promotionsUrl,
          },
        }]
      : [];

    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      promotions,
      promotionItems: [],
      rawPayload: {
        mode: 'provider_expansion_mock',
        provider: this.providerCode,
        promotionsUrl: this.config.promotionsUrl,
      },
    };
  }

  async probeRegion(context: ScraperContext): Promise<ProviderRegionProbeResult> {
    if (this.config.providerCode !== 'kdl') {
      return createExpansionProbe(this.config, context, 'mock_probe_not_required');
    }

    return createExpansionProbe(this.config, context, 'kdl_live_probe_pending', [
      'KDL remains a no-write scaffold until a public catalog/search endpoint or Playwright flow is verified.',
      'The known public entry point is recorded for the next ingestion increment.',
    ]);
  }
}

export function createExpansionProviderScraper(provider: ExpansionProviderCode): ExpansionProviderScraper {
  return new ExpansionProviderScraper(PROVIDER_CONFIGS[provider]);
}

export function getExpansionProviderConfig(provider: ExpansionProviderCode): ExpansionProviderConfig {
  return PROVIDER_CONFIGS[provider];
}

function item(
  externalId: string,
  externalCode: string,
  name: string,
  canonicalHint: string,
  category: string,
  regularPriceRub: number,
  biomaterialPriceRub: number,
  sourceUrl: string,
): ExpansionProviderCatalogItem {
  return {
    externalId,
    externalCode,
    name,
    canonicalHint,
    category,
    regularPriceRub,
    biomaterialPriceRub,
    sourceUrl,
  };
}

function buildRawPayload(
  config: ExpansionProviderConfig,
  catalogItem?: ExpansionProviderCatalogItem,
): Record<string, unknown> {
  return {
    mode: 'provider_expansion_mock',
    provider: config.providerCode,
    catalogUrl: config.catalogUrl,
    sourceUrl: catalogItem?.sourceUrl,
    canonicalHint: catalogItem?.canonicalHint,
    note: 'Public URL/seed value for parser expansion. Do not treat as a completed live scraper.',
  };
}

function createExpansionProbe(
  config: ExpansionProviderConfig,
  context: ScraperContext,
  status: string,
  notes: string[] = [],
): ProviderRegionProbeResult {
  return {
    providerCode: config.providerCode,
    regionCode: context.region.code,
    detectedCity: context.region.city,
    cookies: [],
    localStorage: {},
    networkRequests: config.catalogUrl ? [{ url: config.catalogUrl, method: 'GET' }] : [],
    notes: [
      ...notes,
      `status:${status}`,
    ],
    rawPayload: {
      mode: 'provider_expansion_probe_scaffold',
      provider: config.providerCode,
      catalogUrl: config.catalogUrl,
      promotionsUrl: config.promotionsUrl,
      status,
    },
  };
}
