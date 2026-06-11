import type { ProviderTestPriceRecord, ProviderTestRecord } from '../catalog-types.js';
import {
  effectivePriceRub,
  toRubles,
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

export class GemotestScraper implements ProviderScraper {
  providerCode = 'gemotest';

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const baseUrl = `https://gemotest.ru${context.region.urlPrefix ?? '/moskva'}`;

    const tests: ProviderTestRecord[] = [
      {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        externalId: 'GEM-GLU-MOCK',
        externalCode: 'GLU',
        name: 'Глюкоза в крови',
        kind: 'analysis',
        category: 'Биохимия',
        biomaterial: 'Сыворотка крови',
        sourceUrl: `${baseUrl}/catalog/mock-glucose/`,
        matchStatus: 'unmatched',
        fetchedAt,
        rawPayload: { mode: 'mock', provider: 'gemotest' },
      },
      {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        externalId: 'GEM-TSH-MOCK',
        externalCode: 'TSH',
        name: 'Тиреотропный гормон (ТТГ)',
        kind: 'analysis',
        category: 'Гормоны',
        biomaterial: 'Сыворотка крови',
        sourceUrl: `${baseUrl}/catalog/mock-tsh/`,
        matchStatus: 'unmatched',
        fetchedAt,
        rawPayload: { mode: 'mock', provider: 'gemotest' },
      },
    ];

    const prices = await this.syncPrices(context, tests);

    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      tests,
      prices,
      rawPayload: { source: 'mock', catalogUrl: `${baseUrl}/catalog/` },
    };
  }

  async syncPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    return tests.map((test) => {
      const isTsh = test.externalId === 'GEM-TSH-MOCK';
      const regularPriceRub = toRubles(isTsh ? 740 : 320);
      const promoPriceRub = isTsh ? toRubles(690) : undefined;
      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        city: context.region.city,
        externalId: test.externalId,
        externalCode: test.externalCode,
        currency: 'RUB',
        regularPriceRub,
        promoPriceRub,
        effectivePriceRub: effectivePriceRub({ regularPriceRub, promoPriceRub }),
        biomaterialPriceRub: toRubles(200),
        offerType: isTsh ? 'promo' : 'regular',
        validFrom: isTsh ? '2026-06-01' : undefined,
        validTo: isTsh ? '2026-06-30' : undefined,
        sourceUrl: test.sourceUrl,
        fetchedAt,
        rawPayload: { mode: 'mock', sourceUrl: test.sourceUrl },
      };
    });
  }

  async syncPromotions(context: ScraperContext): Promise<PromotionSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const promoUrl = `https://gemotest.ru${context.region.urlPrefix ?? '/moskva'}/actions/mock-tsh/`;
    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      promotions: [
        {
          providerCode: this.providerCode,
          regionCode: context.region.code,
          externalId: 'GEM-PROMO-TSH-MOCK',
          title: 'ТТГ по специальной цене',
          offerType: 'promo',
          startsOn: '2026-06-01',
          endsOn: '2026-06-30',
          sourceUrl: promoUrl,
          fetchedAt,
          rawPayload: { mode: 'mock' },
        },
      ],
      promotionItems: [
        {
          promotionExternalId: 'GEM-PROMO-TSH-MOCK',
          providerCode: this.providerCode,
          regionCode: context.region.code,
          externalId: 'GEM-TSH-MOCK',
          originalName: 'Тиреотропный гормон (ТТГ)',
          regularPriceRub: toRubles(740),
          promoPriceRub: toRubles(690),
          effectivePriceRub: toRubles(690),
          biomaterialPriceRub: toRubles(200),
          sourceUrl: promoUrl,
          rawPayload: { mode: 'mock' },
        },
      ],
      rawPayload: { source: 'mock', promoUrl },
    };
  }
}
