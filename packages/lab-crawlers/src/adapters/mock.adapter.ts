import {
  matchCanonicalTest,
  normalizePrice,
  type LabCrawlerAdapter,
  type NormalizedLabTest,
  type RawLabTest,
} from '../index.js';

export const mockLabAdapter: LabCrawlerAdapter = {
  providerCode: 'mocklab',
  async searchTests(query: string): Promise<RawLabTest[]> {
    return [{ providerCode: 'mocklab', externalTestId: 'glu', name: `Глюкоза (${query})`, url: 'https://example.com/glu' }];
  },
  async getTestDetails(url: string): Promise<unknown> {
    return { url, name: 'Глюкоза', price: 350, city: 'Москва' };
  },
  async normalize(raw: unknown): Promise<NormalizedLabTest> {
    const item = raw as FixtureLabTest;
    const canonical = matchCanonicalTest(item.name);

    return {
      providerCode: 'mocklab',
      externalTestId: item.externalTestId,
      name: canonical?.name ?? item.name,
      code: canonical?.code,
      price: normalizePrice(item.price),
      regularPrice: normalizePrice(item.price),
      effectivePrice: normalizePrice(item.price),
      currency: 'RUB',
      city: item.city,
      regionCode: item.regionCode,
      biomaterial: item.biomaterial,
      preparation: item.preparation,
      turnaroundTime: item.turnaroundTime,
      offerType: 'regular',
      sourceUrl: item.url,
      checkedAt: new Date().toISOString(),
    };
  },
};

type FixtureLabTest = {
  providerCode: string;
  externalTestId: string;
  name: string;
  price: string | number;
  promoPrice?: string | number;
  city: string;
  regionCode?: string;
  url: string;
  biomaterial?: string;
  preparation?: string;
  turnaroundTime?: string;
  promotionTitle?: string;
  promotionUrl?: string;
  validFrom?: string;
  validTo?: string;
};

const FIXTURE_TESTS: FixtureLabTest[] = [
  {
    providerCode: 'invitro',
    externalTestId: 'INV-GLU',
    name: 'Глюкоза',
    price: '390 руб.',
    city: 'Москва',
    regionCode: 'moscow',
    url: 'https://www.invitro.ru/analizes/for-doctors/mock-glucose/',
    biomaterial: 'венозная кровь',
    turnaroundTime: '1 день',
  },
  {
    providerCode: 'invitro',
    externalTestId: 'INV-TSH',
    name: 'ТТГ',
    price: '690 руб.',
    city: 'Москва',
    regionCode: 'moscow',
    url: 'https://www.invitro.ru/analizes/for-doctors/mock-tsh/',
    biomaterial: 'венозная кровь',
    preparation: 'утром натощак по рекомендации лаборатории',
    turnaroundTime: '1 день',
  },
  {
    providerCode: 'gemotest',
    externalTestId: 'GEM-GLU',
    name: 'Глюкоза в крови',
    price: 320,
    city: 'Москва',
    regionCode: 'moscow',
    url: 'https://gemotest.ru/catalog/mock-glucose/',
    biomaterial: 'сыворотка крови',
    turnaroundTime: '1 день',
  },
  {
    providerCode: 'gemotest',
    externalTestId: 'GEM-TSH',
    name: 'Тиреотропный гормон (ТТГ)',
    price: 740,
    promoPrice: 690,
    city: 'Москва',
    regionCode: 'moscow',
    url: 'https://gemotest.ru/catalog/mock-tsh/',
    biomaterial: 'сыворотка крови',
    turnaroundTime: '1 день',
    promotionTitle: 'ТТГ по специальной цене',
    promotionUrl: 'https://gemotest.ru/actions/mock-tsh/',
    validFrom: '2026-06-01',
    validTo: '2026-06-30',
  },
  {
    providerCode: 'helix',
    externalTestId: 'HLX-GLU',
    name: 'Glucose',
    price: '350',
    city: 'Москва',
    regionCode: 'moscow',
    url: 'https://helix.ru/kb/item/mock-glucose/',
    biomaterial: 'кровь',
    turnaroundTime: '1-2 дня',
  },
  {
    providerCode: 'helix',
    externalTestId: 'HLX-FER',
    name: 'Ферритин',
    price: '820 руб.',
    city: 'Москва',
    regionCode: 'moscow',
    url: 'https://helix.ru/kb/item/mock-ferritin/',
    biomaterial: 'кровь',
    turnaroundTime: '1 день',
  },
];

export function createFixtureLabAdapter(providerCode: string, fixtures: FixtureLabTest[] = FIXTURE_TESTS): LabCrawlerAdapter {
  const providerFixtures = fixtures.filter((item) => item.providerCode === providerCode);

  return {
    providerCode,
    async searchTests(query: string, city?: string): Promise<RawLabTest[]> {
      const normalizedQuery = query.toLocaleLowerCase('ru-RU');
      const queryCanonical = matchCanonicalTest(query);
      return providerFixtures
        .filter((item) => !city || item.city === city)
        .filter((item) => {
          const itemCanonical = matchCanonicalTest(item.name);
          return item.name.toLocaleLowerCase('ru-RU').includes(normalizedQuery)
            || (queryCanonical !== undefined && itemCanonical?.code === queryCanonical.code);
        })
        .map((item) => ({
          providerCode: item.providerCode,
          externalTestId: item.externalTestId,
          name: item.name,
          url: item.url,
          rawPrice: item.price,
          rawCity: item.city,
          rawBiomaterial: item.biomaterial,
          rawTurnaroundTime: item.turnaroundTime,
          rawPreparation: item.preparation,
        }));
    },
    async getTestDetails(url: string): Promise<unknown> {
      const item = providerFixtures.find((fixture) => fixture.url === url);
      if (!item) {
        throw new Error(`Fixture not found for ${url}`);
      }
      return item;
    },
    async normalize(raw: unknown): Promise<NormalizedLabTest> {
      const item = raw as FixtureLabTest;
      const canonical = matchCanonicalTest(item.name);
      const regularPrice = normalizePrice(item.price);
      const promoPrice = normalizePrice(item.promoPrice);

      return {
        providerCode,
        externalTestId: item.externalTestId,
        name: canonical?.name ?? item.name,
        code: canonical?.code,
        price: promoPrice ?? regularPrice,
        regularPrice,
        promoPrice,
        effectivePrice: promoPrice ?? regularPrice,
        currency: 'RUB',
        city: item.city,
        regionCode: item.regionCode,
        biomaterial: item.biomaterial,
        preparation: item.preparation,
        turnaroundTime: item.turnaroundTime,
        offerType: promoPrice === undefined ? 'regular' : 'promo',
        promotionTitle: item.promotionTitle,
        promotionUrl: item.promotionUrl,
        validFrom: item.validFrom,
        validTo: item.validTo,
        sourceUrl: item.url,
        checkedAt: new Date().toISOString(),
      };
    },
  };
}

export const fixtureLabAdapters = [
  createFixtureLabAdapter('invitro'),
  createFixtureLabAdapter('gemotest'),
  createFixtureLabAdapter('helix'),
];
