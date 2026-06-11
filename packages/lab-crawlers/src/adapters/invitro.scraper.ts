import type { ProviderTestPriceRecord, ProviderTestRecord } from '../catalog-types.js';
import {
  effectivePriceRub,
  toRubles,
  type CatalogSyncResult,
  type PromotionSyncResult,
  type ProviderScraper,
  type ScraperContext,
} from '../provider-scraper.js';

export class InvitroScraper implements ProviderScraper {
  providerCode = 'invitro';

  async syncCatalog(context: ScraperContext): Promise<CatalogSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const baseUrl = `https://www.invitro.ru${context.region.urlPrefix ?? '/moscow'}`;

    const tests: ProviderTestRecord[] = [
      {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        externalId: 'INV-GLU-MOCK',
        externalCode: '16',
        name: 'Глюкоза',
        kind: 'analysis',
        category: 'Биохимические исследования',
        biomaterial: 'Кровь',
        sourceUrl: `${baseUrl}/analizes/for-doctors/mock-glucose/`,
        matchStatus: 'unmatched',
        fetchedAt,
        rawPayload: { mode: 'mock', provider: 'invitro' },
      },
    ];

    const prices = await this.syncPrices(context, tests);

    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      tests,
      prices,
      rawPayload: { source: 'mock', catalogUrl: `${baseUrl}/analizes/for-doctors/` },
    };
  }

  async syncPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    return tests.map((test) => {
      const regularPriceRub = toRubles(390);
      return {
        providerCode: this.providerCode,
        regionCode: context.region.code,
        city: context.region.city,
        externalId: test.externalId,
        externalCode: test.externalCode,
        currency: 'RUB',
        regularPriceRub,
        effectivePriceRub: effectivePriceRub({ regularPriceRub }),
        biomaterialPriceRub: toRubles(210),
        offerType: 'regular',
        sourceUrl: test.sourceUrl,
        fetchedAt,
        rawPayload: { mode: 'mock', sourceUrl: test.sourceUrl },
      };
    });
  }

  async syncPromotions(context: ScraperContext): Promise<PromotionSyncResult> {
    const fetchedAt = context.fetchedAt ?? new Date().toISOString();
    const promoUrl = `https://www.invitro.ru${context.region.urlPrefix ?? '/moscow'}/ak/`;
    return {
      providerCode: this.providerCode,
      regionCode: context.region.code,
      fetchedAt,
      promotions: [
        {
          providerCode: this.providerCode,
          regionCode: context.region.code,
          externalId: 'INV-AK-MOCK',
          title: 'Mock акция INVITRO',
          offerType: 'promo',
          startsOn: '2026-06-01',
          endsOn: '2026-06-30',
          sourceUrl: promoUrl,
          fetchedAt,
          rawPayload: { mode: 'mock' },
        },
      ],
      promotionItems: [],
      rawPayload: { source: 'mock', promoUrl },
    };
  }
}
