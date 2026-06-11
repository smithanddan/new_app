export type ProviderCode = 'invitro' | 'gemotest' | 'dnkom' | string;

export type MoneyRub = number;

export type LabProviderRecord = {
  id: string;
  code: ProviderCode;
  name: string;
  displayName?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
  rawPayload?: unknown;
};

export type LabRegionRecord = {
  id: string;
  providerId: string;
  code: string;
  name: string;
  city: string;
  countryCode: string;
  urlPrefix?: string | null;
  providerCityId?: string | null;
  rawPayload?: unknown;
};

export type CanonicalTestKind = 'analysis' | 'panel' | 'profile' | 'service';

export type CanonicalTestRecord = {
  id: string;
  code: string;
  nameRu: string;
  nameEn?: string | null;
  kind: CanonicalTestKind;
  category?: string | null;
  aliases: string[];
  rawPayload?: unknown;
};

export type ProviderTestMatchStatus = 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored';

export type ProviderTestRecord = {
  providerCode: ProviderCode;
  regionCode?: string;
  externalId?: string;
  externalCode?: string;
  name: string;
  normalizedName?: string;
  kind: CanonicalTestKind | 'unknown';
  category?: string;
  biomaterial?: string;
  preparation?: string;
  turnaroundTime?: string;
  sourceUrl: string;
  canonicalCode?: string;
  matchStatus: ProviderTestMatchStatus;
  matchConfidence?: number;
  fetchedAt: string;
  rawPayload: unknown;
};

export type ProviderTestPriceRecord = {
  providerCode: ProviderCode;
  regionCode: string;
  city?: string;
  externalId?: string;
  externalCode?: string;
  currency: 'RUB';
  regularPriceRub?: MoneyRub;
  promoPriceRub?: MoneyRub;
  effectivePriceRub?: MoneyRub;
  biomaterialPriceRub?: MoneyRub;
  offerType: 'regular' | 'promo' | 'cashback' | 'package' | 'unknown';
  validFrom?: string;
  validTo?: string;
  sourceUrl: string;
  fetchedAt: string;
  rawPayload: unknown;
};

export type LabPromotionRecord = {
  providerCode: ProviderCode;
  regionCode?: string;
  externalId?: string;
  title: string;
  description?: string;
  offerType: 'promo' | 'cashback' | 'package' | 'discount' | 'unknown';
  startsOn?: string;
  endsOn?: string;
  regionScope?: string;
  sourceUrl: string;
  fetchedAt: string;
  rawPayload: unknown;
};

export type LabPromotionItemRecord = {
  promotionExternalId?: string;
  providerCode: ProviderCode;
  regionCode?: string;
  externalId?: string;
  canonicalCode?: string;
  originalName: string;
  regularPriceRub?: MoneyRub;
  promoPriceRub?: MoneyRub;
  effectivePriceRub?: MoneyRub;
  biomaterialPriceRub?: MoneyRub;
  sourceUrl: string;
  rawPayload: unknown;
};

export type ProviderRegionProbeResult = {
  providerCode: ProviderCode;
  regionCode?: string;
  detectedCity?: string;
  cookies: Array<{ name: string; valuePreview: string; domain?: string }>;
  localStorage: Record<string, string>;
  networkRequests: Array<{ url: string; method: string; responseStatus?: number }>;
  notes: string[];
  rawPayload: unknown;
};
