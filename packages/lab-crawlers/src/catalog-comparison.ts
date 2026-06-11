import type { CanonicalTestRecord, ProviderTestPriceRecord, ProviderTestRecord } from './catalog-types.js';
import { effectivePriceRub, normalizeProviderName } from './provider-scraper.js';

export type CanonicalMatchResult = {
  canonicalCode?: string;
  confidence: number;
  status: 'auto_matched' | 'unmatched';
  reason: string;
};

export type ProviderPriceComparisonRow = {
  canonicalCode: string;
  canonicalName: string;
  city: string;
  offers: Array<{
    providerCode: string;
    regionCode: string;
    externalId?: string;
    providerName: string;
    effectivePriceRub: number;
    regularPriceRub?: number;
    promoPriceRub?: number;
    biomaterialPriceRub?: number;
    totalWithBiomaterialRub?: number;
    offerType: ProviderTestPriceRecord['offerType'];
    validFrom?: string;
    validTo?: string;
    sourceUrl: string;
    fetchedAt: string;
  }>;
  cheapest?: {
    providerCode: string;
    externalId?: string;
    effectivePriceRub: number;
    totalWithBiomaterialRub?: number;
  };
};

export const DEFAULT_CANONICAL_TESTS: CanonicalTestRecord[] = [
  {
    id: 'CBC',
    code: 'CBC',
    nameRu: 'Общий анализ крови',
    nameEn: 'Complete blood count',
    kind: 'analysis',
    category: 'hematology',
    aliases: ['ОАК', 'клинический анализ крови', 'общий анализ крови'],
  },
  {
    id: 'UA',
    code: 'UA',
    nameRu: 'Общий анализ мочи',
    nameEn: 'Urinalysis',
    kind: 'analysis',
    category: 'urine',
    aliases: ['ОАМ', 'общий анализ мочи'],
  },
  {
    id: 'FER',
    code: 'FER',
    nameRu: 'Ферритин',
    nameEn: 'Ferritin',
    kind: 'analysis',
    category: 'iron',
    aliases: ['ферритин', 'ferritin'],
  },
  {
    id: 'TSH',
    code: 'TSH',
    nameRu: 'ТТГ',
    nameEn: 'Thyroid-stimulating hormone',
    kind: 'analysis',
    category: 'thyroid',
    aliases: ['ТТГ', 'TSH', 'тиреотропный гормон'],
  },
  {
    id: 'GLU',
    code: 'GLU',
    nameRu: 'Глюкоза',
    nameEn: 'Glucose',
    kind: 'analysis',
    category: 'biochemistry',
    aliases: ['глюкоза', 'glucose', 'глюкоза крови'],
  },
  {
    id: 'CHOL',
    code: 'CHOL',
    nameRu: 'Холестерин общий',
    nameEn: 'Total cholesterol',
    kind: 'analysis',
    category: 'lipids',
    aliases: ['общий холестерин', 'холестерин общий', 'total cholesterol', 'chol'],
  },
  {
    id: 'VITD',
    code: 'VITD',
    nameRu: 'Витамин D',
    nameEn: '25-OH Vitamin D',
    kind: 'analysis',
    category: 'vitamins',
    aliases: ['25-OH витамин D', 'витамин д', 'vitamin d', '25 гидроксивитамин d'],
  },
  {
    id: 'CREA',
    code: 'CREA',
    nameRu: 'Креатинин',
    nameEn: 'Creatinine',
    kind: 'analysis',
    category: 'kidney',
    aliases: ['креатинин', 'creatinine'],
  },
];

export function matchProviderTestToCanonical(
  test: ProviderTestRecord,
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): CanonicalMatchResult {
  const normalizedName = normalizeProviderName(test.name);

  for (const canonical of canonicalTests) {
    if (normalizeProviderName(canonical.nameRu) === normalizedName) {
      return { canonicalCode: canonical.code, confidence: 1, status: 'auto_matched', reason: 'exact_name' };
    }
  }

  for (const canonical of canonicalTests) {
    const aliases = [canonical.code, canonical.nameRu, canonical.nameEn ?? '', ...canonical.aliases].filter(Boolean);
    const matchedAlias = aliases.find((alias) => {
      const normalizedAlias = normalizeProviderName(alias);
      return normalizedAlias.length > 1 && normalizedName.includes(normalizedAlias);
    });

    if (matchedAlias) {
      return {
        canonicalCode: canonical.code,
        confidence: 0.86,
        status: 'auto_matched',
        reason: `alias:${matchedAlias}`,
      };
    }
  }

  return { confidence: 0, status: 'unmatched', reason: 'no_alias_match' };
}

export function autoMatchProviderTests(
  tests: ProviderTestRecord[],
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): ProviderTestRecord[] {
  return tests.map((test) => {
    const match = matchProviderTestToCanonical(test, canonicalTests);

    if (match.status === 'unmatched') {
      return {
        ...test,
        normalizedName: normalizeProviderName(test.name),
        matchStatus: 'unmatched',
        matchConfidence: 0,
      };
    }

    return {
      ...test,
      canonicalCode: match.canonicalCode,
      normalizedName: normalizeProviderName(test.name),
      matchStatus: 'auto_matched',
      matchConfidence: match.confidence,
    };
  });
}

export function compareProviderPrices(
  tests: ProviderTestRecord[],
  prices: ProviderTestPriceRecord[],
  canonicalTests: CanonicalTestRecord[] = DEFAULT_CANONICAL_TESTS,
): ProviderPriceComparisonRow[] {
  const canonicalByCode = new Map(canonicalTests.map((test) => [test.code, test]));
  const testByProviderExternalId = new Map(
    tests
      .filter((test) => test.externalId)
      .map((test) => [`${test.providerCode}:${test.externalId}`, test]),
  );
  const groups = new Map<string, Array<{ test: ProviderTestRecord; price: ProviderTestPriceRecord; effectivePriceRub: number }>>();

  for (const price of prices) {
    const test = price.externalId ? testByProviderExternalId.get(`${price.providerCode}:${price.externalId}`) : undefined;
    const canonicalCode = test?.canonicalCode;
    const resolvedPrice = effectivePriceRub(price);

    if (!test || !canonicalCode || resolvedPrice === undefined) {
      continue;
    }

    const city = price.city ?? price.regionCode;
    const key = `${canonicalCode}:${city}`;
    groups.set(key, [...(groups.get(key) ?? []), { test, price, effectivePriceRub: resolvedPrice }]);
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const [canonicalCode, city] = key.split(':');
      const canonical = canonicalByCode.get(canonicalCode);
      const offers = rows
        .map(({ test, price, effectivePriceRub: resolvedPrice }) => {
          const totalWithBiomaterialRub = price.biomaterialPriceRub === undefined
            ? undefined
            : resolvedPrice + price.biomaterialPriceRub;

          return {
            providerCode: price.providerCode,
            regionCode: price.regionCode,
            externalId: price.externalId,
            providerName: test.name,
            effectivePriceRub: resolvedPrice,
            regularPriceRub: price.regularPriceRub,
            promoPriceRub: price.promoPriceRub,
            biomaterialPriceRub: price.biomaterialPriceRub,
            totalWithBiomaterialRub,
            offerType: price.offerType,
            validFrom: price.validFrom,
            validTo: price.validTo,
            sourceUrl: price.sourceUrl,
            fetchedAt: price.fetchedAt,
          };
        })
        .sort((a, b) => a.effectivePriceRub - b.effectivePriceRub);

      const cheapest = offers[0]
        ? {
          providerCode: offers[0].providerCode,
          externalId: offers[0].externalId,
          effectivePriceRub: offers[0].effectivePriceRub,
          totalWithBiomaterialRub: offers[0].totalWithBiomaterialRub,
        }
        : undefined;

      return {
        canonicalCode,
        canonicalName: canonical?.nameRu ?? canonicalCode,
        city,
        offers,
        cheapest,
      };
    })
    .sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode));
}
