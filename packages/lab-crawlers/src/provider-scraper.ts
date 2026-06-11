import type {
  LabPromotionItemRecord,
  LabPromotionRecord,
  LabRegionRecord,
  ProviderCode,
  ProviderRegionProbeResult,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from './catalog-types.js';

export type ScraperContext = {
  providerCode: ProviderCode;
  region: Pick<LabRegionRecord, 'code' | 'city' | 'urlPrefix' | 'providerCityId'>;
  fetchedAt?: string;
  userAgent?: string;
  rateLimitMs?: number;
};

export type CatalogSyncResult = {
  providerCode: ProviderCode;
  regionCode: string;
  fetchedAt: string;
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  rawPayload: unknown;
};

export type PromotionSyncResult = {
  providerCode: ProviderCode;
  regionCode: string;
  fetchedAt: string;
  promotions: LabPromotionRecord[];
  promotionItems: LabPromotionItemRecord[];
  rawPayload: unknown;
};

export interface ProviderScraper {
  providerCode: ProviderCode;
  syncCatalog(context: ScraperContext): Promise<CatalogSyncResult>;
  syncPrices(context: ScraperContext, tests: ProviderTestRecord[]): Promise<ProviderTestPriceRecord[]>;
  syncPromotions(context: ScraperContext): Promise<PromotionSyncResult>;
  probeRegion?(context: ScraperContext): Promise<ProviderRegionProbeResult>;
}

export function toRubles(value: string | number | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (!value) {
    return undefined;
  }

  const match = String(value).replace(/\s+/g, '').replace(',', '.').match(/\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : undefined;
}

export function normalizeProviderName(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[()[\]{}.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function effectivePriceRub(input: {
  regularPriceRub?: number;
  promoPriceRub?: number;
  fallbackPriceRub?: number;
}): number | undefined {
  return input.promoPriceRub ?? input.fallbackPriceRub ?? input.regularPriceRub;
}
