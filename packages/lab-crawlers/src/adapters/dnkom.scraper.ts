import type { ProviderRegionProbeResult, ProviderTestPriceRecord, ProviderTestRecord } from '../catalog-types.js';
import {
  effectivePriceRub,
  toRubles,
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

export class DnkomScraper implements ProviderScraper {
  providerCode = 'dnkom';

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const baseUrl = 'https://dnkom.ru';

    const tests: ProviderTestRecord[] = [
      {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        externalId: 'DNK-GLU-MOCK',
        name: 'Глюкоза',
        kind: 'analysis',
        category: 'Биохимия',
        biomaterial: 'Кровь',
        sourceUrl: `${baseUrl}/analizy/mock-glucose/`,
        matchStatus: 'unmatched',
        fetchedAt,
        rawPayload: { mode: 'mock', provider: 'dnkom' },
      },
      {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        externalId: 'DNK-FER-MOCK',
        name: 'Ферритин',
        kind: 'analysis',
        category: 'Биохимия',
        biomaterial: 'Кровь',
        sourceUrl: `${baseUrl}/analizy/mock-ferritin/`,
        matchStatus: 'unmatched',
        fetchedAt,
        rawPayload: { mode: 'mock', provider: 'dnkom' },
      },
    ];

    const prices = await this.syncPrices(context, tests);

    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      tests,
      prices,
      rawPayload: { source: 'mock', note: 'real adapter must probe region state first' },
    };
  }

  async syncPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    return tests.map((test) => {
      const regularPriceRub = toRubles(test.externalId === 'DNK-FER-MOCK' ? 850 : 360);
      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        city: context.region.city,
        externalId: test.externalId,
        externalCode: test.externalCode,
        currency: 'RUB',
        regularPriceRub,
        effectivePriceRub: effectivePriceRub({ regularPriceRub }),
        offerType: 'regular',
        sourceUrl: test.sourceUrl,
        fetchedAt,
        rawPayload: { mode: 'mock', sourceUrl: test.sourceUrl },
      };
    });
  }

  async syncPromotions(context: ScraperContext): Promise<PromotionSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      promotions: [],
      promotionItems: [],
      rawPayload: { source: 'mock', note: 'promotions endpoint/page is not mapped yet' },
    };
  }

  async probeRegion(context: ScraperContext): Promise<ProviderRegionProbeResult> {
    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      detectedCity: context.region.city,
      cookies: [],
      localStorage: {},
      networkRequests: [],
      notes: [
        'Real Playwright probe should open dnkom.ru, choose city, then inspect cookies.',
        'Capture localStorage keys before and after city selection.',
        'Record network requests that contain city id, region id, settlement id, or price region.',
      ],
      rawPayload: {
        mode: 'mock',
        requiredChecks: ['cookies', 'localStorage', 'networkRequests'],
      },
    };
  }
}
