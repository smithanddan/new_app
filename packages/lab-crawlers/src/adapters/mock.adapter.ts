import type { LabCrawlerAdapter, RawLabTest, NormalizedLabTest } from '../index';

export const mockLabAdapter: LabCrawlerAdapter = {
  providerCode: 'mocklab',
  async searchTests(query: string): Promise<RawLabTest[]> {
    return [{ providerCode: 'mocklab', externalTestId: 'glu', name: `Глюкоза (${query})`, url: 'https://example.com/glu' }];
  },
  async getTestDetails(url: string): Promise<unknown> {
    return { url, name: 'Глюкоза', price: 350, city: 'Москва' };
  },
  async normalize(raw: any): Promise<NormalizedLabTest> {
    return {
      providerCode: 'mocklab',
      name: raw.name,
      price: raw.price,
      currency: 'RUB',
      city: raw.city,
      sourceUrl: raw.url,
      checkedAt: new Date().toISOString(),
    };
  },
};
