import type {
  LabPromotionItemRecord,
  LabPromotionRecord,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from './catalog-types.js';
import type { LabLocation, PickupType } from './geo-service.js';
import { normalizeProviderName } from './provider-scraper.js';
import type {
  DiscoveryRunStatus,
  NormalizedProviderDiscoveryCandidate,
  ProviderDiscoveryDuplicate,
  ProviderDiscoveryQueryRecord,
  ProviderDiscoveryRunRecord,
  ProviderDiscoveryWriteResult,
} from './provider-discovery.js';
import type { LabCrawlerSupabaseClient } from './supabase-client.js';

type DbIdRow = { id: string };
type DbCanonicalTestRow = {
  id: string;
  code: string;
  name_ru: string;
  name_en?: string | null;
  kind?: 'analysis' | 'panel' | 'profile' | 'service' | null;
  aliases?: string[] | null;
};
type DbProviderTestRow = {
  id: string;
  provider_id: string;
  canonical_test_id?: string | null;
  external_code?: string | null;
  name: string;
  normalized_name?: string | null;
  source_url?: string | null;
  raw_payload?: Record<string, unknown> | null;
};
type DbPriceRow = {
  provider_test_id: string;
  provider_id: string;
  lab_region_id: string;
  regular_price_rub?: number | null;
  promo_price_rub?: number | null;
  effective_price_rub?: number | null;
  biomaterial_price_rub?: number | null;
  offer_type?: 'regular' | 'promo' | 'cashback' | 'package' | 'unknown' | null;
  source_url?: string | null;
  fetched_at: string;
};
type DbPromotionItemRow = {
  id: string;
  promotion_id: string;
  provider_test_id?: string | null;
  provider_test_code?: string | null;
  original_name: string;
  regular_price_rub?: number | null;
  promo_price_rub?: number | null;
  effective_price_rub?: number | null;
  biomaterial_price_rub?: number | null;
  source_url?: string | null;
  created_at: string;
};
type DbPromotionRow = {
  id: string;
  provider_id: string;
  lab_region_id?: string | null;
  title: string;
  starts_on?: string | null;
  ends_on?: string | null;
  source_url?: string | null;
  fetched_at: string;
};
type DbProviderRow = {
  id: string;
  code: string;
  name: string;
  display_name?: string | null;
};
type DbRegionRow = {
  id: string;
  code: string;
  name: string;
  city: string;
};
type DbLabLocationRow = {
  id: string;
  provider_id: string;
  lab_region_id?: string | null;
  name: string;
  address: string;
  city: string;
  lat: number | string;
  lng: number | string;
  geo_hash?: string | null;
  coverage_radius_km?: number | string | null;
  pickup_type: PickupType;
  source_url?: string | null;
  raw_payload?: Record<string, unknown> | null;
};

export type ProviderRegionIds = {
  providerId: string;
  labRegionId: string;
};

export type UpsertResult = {
  id: string;
  action: 'inserted' | 'updated';
};

export type PriceInsertResult = {
  id: string | null;
  action: 'inserted' | 'skipped_duplicate';
};

export type ScraperRunResult = {
  id: string;
};

export type ScraperRunSource = 'manual' | 'scheduled' | 'backfill' | 'ci';
export type MonetizationEventType = 'affiliate_click' | 'basket_checkout' | 'lead_request' | 'api_request';

export type MonetizationEventInput = {
  eventType: MonetizationEventType;
  providerCode?: string;
  canonicalTestId?: string;
  providerTestId?: string;
  sourceUrl?: string;
  targetUrl?: string;
  utmSource?: string;
  utmCampaign?: string;
  sessionId?: string;
  city?: string;
  rawPayload?: unknown;
};

export type DbPriceComparisonOffer = {
  provider: {
    id: string;
    code: string;
    name: string;
  };
  region: {
    id: string;
    code: string;
    name: string;
    city: string;
  };
  provider_test_id: string;
  provider_test_name: string;
  provider_test_code?: string;
  offer_type: 'regular' | 'promo';
  offer_source: 'provider_test_prices' | 'lab_promotion_items';
  promotion_title?: string;
  valid_from?: string;
  valid_to?: string;
  regular_price_rub?: number;
  promo_price_rub?: number;
  effective_price_rub?: number;
  biomaterial_price_rub?: number;
  total_price_rub?: number;
  source_url?: string;
  fetched_at: string;
};

export type DbUnmatchedProviderTestSuggestion = {
  provider: {
    id: string;
    code: string;
    name: string;
  };
  provider_test_id: string;
  provider_test_name: string;
  provider_test_code?: string;
  source_url?: string;
  match_reason: string;
};

export type DbCanonicalPriceComparison = {
  canonical_test: {
    id: string;
    code: string;
    name_ru: string;
    name_en?: string | null;
    aliases: string[];
  };
  city: string;
  offers: DbPriceComparisonOffer[];
  unmatched_provider_tests: DbUnmatchedProviderTestSuggestion[];
  auto_match_suggestion?: string;
};

export type DbLabSearchSuggestion = {
  canonical_test: DbCanonicalPriceComparison['canonical_test'];
  match_reason: 'exact_canonical' | 'clinical_service_slug' | 'provider_test' | 'text_suggestion';
  provider_test?: {
    provider_test_id: string;
    provider_test_name: string;
    provider_test_code?: string;
    source_url?: string;
  };
};

export type DbLabSearchResult = {
  query: string;
  city: string;
  resolved_test: DbCanonicalPriceComparison['canonical_test'] | null;
  suggestions: DbLabSearchSuggestion[];
  offers: DbPriceComparisonOffer[];
  cheapest: DbPriceComparisonOffer | null;
  source_status: 'empty_query' | 'resolved' | 'suggestions_only' | 'not_found';
};

export type DbProviderTestMatchCandidate = {
  provider: {
    id: string;
    code: string;
    name: string;
  };
  provider_test_id: string;
  provider_test_name: string;
  provider_test_code?: string;
  source_url?: string;
  canonical_test: {
    id: string;
    code: string;
    name_ru: string;
  };
  confidence: number;
  reason: string;
  provider_test_kind: ProviderTestNameKind;
  status: 'exact_name' | 'exact_provider_code' | 'safe_alias';
};

export type DbProviderTestBlockedCandidate = {
  provider: {
    id: string;
    code: string;
    name: string;
  };
  provider_test_id: string;
  provider_test_name: string;
  provider_test_code?: string;
  source_url?: string;
  canonical_test: {
    id: string;
    code: string;
    name_ru: string;
  };
  confidence: number;
  reason: 'blocked_complex_candidate';
  provider_test_kind: ProviderTestNameKind;
};

export type ProviderTestNameKind = 'analysis' | 'panel' | 'complex' | 'unknown';

export type DbProviderTestMatchResult = {
  provider: string;
  city?: string;
  mode: 'dry-run' | 'write';
  candidates: DbProviderTestMatchCandidate[];
  blocked_candidates: DbProviderTestBlockedCandidate[];
  matched_count: number;
  blocked_count: number;
  updated_count: number;
};

export type DbManualMatchResult = {
  provider: {
    id: string;
    code: string;
    name: string;
  };
  mode: 'dry-run' | 'write';
  provider_test: {
    id: string;
    name: string;
    provider_test_code?: string;
    source_url?: string;
    previous_canonical_test_id?: string | null;
  };
  canonical_test: {
    id: string;
    code: string;
    name_ru: string;
  };
  matched_by?: string;
  updated: boolean;
};

export type DbProviderTestMatchQueueItem = {
  provider: {
    id: string;
    code: string;
    name: string;
  };
  provider_test_id: string;
  provider_test_name: string;
  provider_test_code?: string;
  source_url?: string;
};

export type DbProviderTestMatchStatusItem = DbProviderTestMatchQueueItem & {
  match_status: 'auto_matched' | 'manual_matched';
  match_confidence?: number;
  matched_at?: string;
  canonical_test?: {
    id: string;
    code: string;
    name_ru: string;
  };
};

export type DbScraperRunListItem = {
  id: string;
  provider?: {
    code?: string;
    name?: string;
    display_name?: string | null;
  } | null;
  region?: {
    code?: string;
    name?: string;
    city?: string;
  } | null;
  run_type: string;
  run_source?: ScraperRunSource | null;
  status: string;
  started_at: string;
  finished_at?: string | null;
  stats: Record<string, unknown>;
  error?: string | null;
};

export type DbMarketQualityStats = {
  providers_count: number;
  canonical_tests_count: number;
  provider_tests_count: number;
  provider_tests_matched_count: number;
  provider_tests_unmatched_count: number;
  provider_test_prices_count: number;
  promotions_count: number;
  promotion_items_count: number;
  scraper_runs_count: number;
  match_status_counts: Record<string, number>;
};

export type DbProviderCandidate = {
  id: string;
  name: string;
  normalized_name: string;
  website_url?: string | null;
  domain?: string | null;
  phone?: string | null;
  address?: string | null;
  city: string;
  lat?: number | string | null;
  lng?: number | string | null;
  source_type: string;
  confidence: number | string;
  status: 'new' | 'needs_review' | 'accepted' | 'rejected' | 'duplicate';
  matched_provider_id?: string | null;
  duplicate_of_candidate_id?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  matched_provider?: {
    id: string;
    code: string;
    name: string;
    display_name?: string | null;
  } | null;
  duplicate_candidate?: {
    id: string;
    name: string;
    city: string;
  } | null;
};

export type DbProviderDiscoveryRun = {
  id: string;
  query_id?: string | null;
  city: string;
  source: string;
  status: string;
  run_source: ScraperRunSource;
  started_at: string;
  finished_at?: string | null;
  stats: Record<string, unknown>;
  error?: string | null;
  raw_payload?: Record<string, unknown> | null;
  query?: {
    id: string;
    query: string;
    source: string;
    city: string;
  } | null;
};

export type DbProviderDiscoveryQuery = {
  id: string;
  query: string;
  city: string;
  source: string;
  vertical: string;
  canonical_test_id?: string | null;
  priority: number;
  enabled: boolean;
  last_run_at?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export class LabCatalogRepository {
  constructor(private readonly supabase: LabCrawlerSupabaseClient) {}

  async getProviderRegionIds(providerCode: string, regionCode: string): Promise<ProviderRegionIds> {
    const provider = await this.selectSingle<DbIdRow>('lab_providers', 'id', { code: providerCode });
    const region = await this.selectSingle<DbIdRow>('lab_regions', 'id', {
      provider_id: provider.id,
      code: regionCode,
    });

    return {
      providerId: provider.id,
      labRegionId: region.id,
    };
  }

  async listLabLocations(input: {
    city?: string;
    providerIds?: string[];
  } = {}): Promise<LabLocation[]> {
    let query = this.supabase
      .from('lab_locations')
      .select('id, provider_id, lab_region_id, name, address, city, lat, lng, geo_hash, coverage_radius_km, pickup_type, source_url, raw_payload')
      .order('name', { ascending: true });

    if (input.city) {
      query = query.eq('city', input.city);
    }
    if (input.providerIds && input.providerIds.length > 0) {
      query = query.in('provider_id', input.providerIds);
    }

    const { data, error } = await query;
    assertNoError(error, 'select lab_locations');
    return ((data ?? []) as DbLabLocationRow[]).map(mapLabLocation);
  }

  async upsertProviderTest(input: {
    providerId: string;
    test: ProviderTestRecord;
  }): Promise<UpsertResult> {
    const normalizedName = input.test.normalizedName ?? normalizeProviderName(input.test.name);
    const existing = await this.findProviderTest({
      providerId: input.providerId,
      externalCode: input.test.externalCode,
      normalizedName,
      sourceUrl: input.test.sourceUrl,
    });
    const payload = {
      provider_id: input.providerId,
      canonical_test_id: input.test.canonicalCode ? await this.resolveCanonicalTestIdByCode(input.test.canonicalCode) : undefined,
      external_id: input.test.externalId,
      external_code: input.test.externalCode,
      name: input.test.name,
      normalized_name: normalizedName,
      kind: input.test.kind,
      category: input.test.category,
      biomaterial: input.test.biomaterial,
      preparation: input.test.preparation,
      turnaround_time: input.test.turnaroundTime,
      source_url: input.test.sourceUrl,
      match_status: input.test.matchStatus,
      match_confidence: input.test.matchConfidence,
      fetched_at: input.test.fetchedAt,
      raw_payload: input.test.rawPayload,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await this.supabase
        .from('provider_tests')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
      assertNoError(error, 'update provider_tests');
      return { id: requireRow<DbIdRow>(data, 'update provider_tests').id, action: 'updated' };
    }

    const { data, error } = await this.supabase
      .from('provider_tests')
      .insert(payload)
      .select('id')
      .single();
    assertNoError(error, 'insert provider_tests');
    return { id: requireRow<DbIdRow>(data, 'insert provider_tests').id, action: 'inserted' };
  }

  async insertProviderTestPrice(input: {
    providerId: string;
    labRegionId: string;
    providerTestId: string;
    price: ProviderTestPriceRecord;
  }): Promise<PriceInsertResult> {
    const { data, error } = await this.supabase
      .from('provider_test_prices')
      .insert({
        provider_test_id: input.providerTestId,
        provider_id: input.providerId,
        lab_region_id: input.labRegionId,
        currency: input.price.currency,
        regular_price_rub: input.price.regularPriceRub,
        promo_price_rub: input.price.promoPriceRub,
        effective_price_rub: input.price.effectivePriceRub,
        biomaterial_price_rub: input.price.biomaterialPriceRub,
        offer_type: input.price.offerType,
        valid_from: input.price.validFrom,
        valid_to: input.price.validTo,
        source_url: input.price.sourceUrl,
        fetched_at: input.price.fetchedAt,
        snapshot_on: toSnapshotDate(input.price.fetchedAt),
        raw_payload: input.price.rawPayload,
      })
      .select('id')
      .single();
    if (isUniqueViolation(error)) {
      return { id: null, action: 'skipped_duplicate' };
    }
    assertNoError(error, 'insert provider_test_prices');
    return { id: requireRow<DbIdRow>(data, 'insert provider_test_prices').id, action: 'inserted' };
  }

  async upsertPromotion(input: {
    providerId: string;
    labRegionId: string;
    promotion: LabPromotionRecord;
  }): Promise<UpsertResult> {
    const existing = await this.findPromotion({
      providerId: input.providerId,
      labRegionId: input.labRegionId,
      promotion: input.promotion,
    });
    const payload = {
      provider_id: input.providerId,
      lab_region_id: input.labRegionId,
      external_id: input.promotion.externalId,
      title: input.promotion.title,
      description: input.promotion.description,
      offer_type: input.promotion.offerType,
      starts_on: input.promotion.startsOn,
      ends_on: input.promotion.endsOn,
      region_scope: input.promotion.regionScope,
      source_url: input.promotion.sourceUrl,
      fetched_at: input.promotion.fetchedAt,
      raw_payload: input.promotion.rawPayload,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await this.supabase
        .from('lab_promotions')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
      assertNoError(error, 'update lab_promotions');
      return { id: requireRow<DbIdRow>(data, 'update lab_promotions').id, action: 'updated' };
    }

    const { data, error } = await this.supabase
      .from('lab_promotions')
      .insert(payload)
      .select('id')
      .single();
    assertNoError(error, 'insert lab_promotions');
    return { id: requireRow<DbIdRow>(data, 'insert lab_promotions').id, action: 'inserted' };
  }

  async upsertPromotionItem(input: {
    promotionId: string;
    providerTestId?: string;
    item: LabPromotionItemRecord;
  }): Promise<UpsertResult> {
    const providerTestCode = input.item.externalId;
    const existing = await this.findPromotionItem({
      promotionId: input.promotionId,
      providerTestCode,
      originalName: input.item.originalName,
      sourceUrl: input.item.sourceUrl,
    });
    const payload = {
      promotion_id: input.promotionId,
      provider_test_id: input.providerTestId,
      provider_test_code: providerTestCode,
      original_name: input.item.originalName,
      regular_price_rub: input.item.regularPriceRub,
      promo_price_rub: input.item.promoPriceRub,
      effective_price_rub: input.item.effectivePriceRub,
      biomaterial_price_rub: input.item.biomaterialPriceRub,
      source_url: input.item.sourceUrl,
      raw_payload: input.item.rawPayload,
    };

    if (existing) {
      const { data, error } = await this.supabase
        .from('lab_promotion_items')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
      assertNoError(error, 'update lab_promotion_items');
      return { id: requireRow<DbIdRow>(data, 'update lab_promotion_items').id, action: 'updated' };
    }

    const { data, error } = await this.supabase
      .from('lab_promotion_items')
      .insert(payload)
      .select('id')
      .single();
    assertNoError(error, 'insert lab_promotion_items');
    return { id: requireRow<DbIdRow>(data, 'insert lab_promotion_items').id, action: 'inserted' };
  }

  async createScraperRun(input: {
    providerId: string;
    labRegionId: string;
    runType: 'sync_catalog' | 'sync_prices' | 'sync_promotions' | 'manual_json_import' | 'region_probe';
    runSource?: ScraperRunSource;
    triggeredBy?: string;
    workflowRunId?: string;
    lockKey?: string;
    rawPayload?: unknown;
  }): Promise<ScraperRunResult> {
    const { data, error } = await this.supabase
      .from('scraper_runs')
      .insert({
        provider_id: input.providerId,
        lab_region_id: input.labRegionId,
        run_type: input.runType,
        run_source: input.runSource ?? 'manual',
        triggered_by: input.triggeredBy,
        workflow_run_id: input.workflowRunId,
        lock_key: input.lockKey,
        status: 'started',
        raw_payload: input.rawPayload,
      })
      .select('id')
      .single();
    assertNoError(error, 'insert scraper_runs');
    return { id: requireRow<DbIdRow>(data, 'insert scraper_runs').id };
  }

  async acquireCrawlerRunLock(input: {
    lockKey: string;
    providerId: string;
    labRegionId: string;
    ownerToken: string;
    runSource: ScraperRunSource;
    expiresAt: string;
    rawPayload?: unknown;
  }): Promise<boolean> {
    const now = new Date().toISOString();
    const { error: deleteError } = await this.supabase
      .from('crawler_run_locks')
      .delete()
      .eq('lock_key', input.lockKey)
      .lt('expires_at', now);
    assertNoError(deleteError, 'delete expired crawler_run_locks');

    const { error } = await this.supabase
      .from('crawler_run_locks')
      .insert({
        lock_key: input.lockKey,
        provider_id: input.providerId,
        lab_region_id: input.labRegionId,
        owner_token: input.ownerToken,
        run_source: input.runSource,
        expires_at: input.expiresAt,
        raw_payload: input.rawPayload,
      });

    if (isUniqueViolation(error)) {
      return false;
    }

    assertNoError(error, 'insert crawler_run_locks');
    return true;
  }

  async releaseCrawlerRunLock(input: {
    lockKey: string;
    ownerToken: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('crawler_run_locks')
      .delete()
      .eq('lock_key', input.lockKey)
      .eq('owner_token', input.ownerToken);
    assertNoError(error, 'delete crawler_run_locks');
  }

  async finishScraperRun(input: {
    scraperRunId: string;
    status: 'success' | 'partial' | 'failed' | 'cancelled';
    stats: unknown;
    error?: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('scraper_runs')
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        stats: input.stats,
        error: input.error,
      })
      .eq('id', input.scraperRunId);
    assertNoError(error, 'update scraper_runs');
  }

  async logScraperRunItem(input: {
    scraperRunId: string;
    providerTestId?: string;
    canonicalTestId?: string;
    entityType: 'provider_test' | 'price' | 'promotion' | 'promotion_item' | 'region' | 'unknown';
    sourceUrl?: string;
    status: 'success' | 'skipped' | 'warning' | 'failed';
    message?: string;
    rawPayload?: unknown;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('scraper_run_items')
      .insert({
        scraper_run_id: input.scraperRunId,
        provider_test_id: input.providerTestId,
        canonical_test_id: input.canonicalTestId,
        entity_type: input.entityType,
        source_url: input.sourceUrl,
        status: input.status,
        message: input.message,
        raw_payload: input.rawPayload,
    });
    assertNoError(error, 'insert scraper_run_items');
  }

  async logMonetizationEvent(input: MonetizationEventInput): Promise<void> {
    const provider = input.providerCode
      ? await this.selectMaybeSingle<DbProviderRow>('lab_providers', 'id, code, name, display_name', { code: input.providerCode })
      : undefined;
    const { error } = await this.supabase
      .from('monetization_events')
      .insert({
        event_type: input.eventType,
        provider_id: provider?.id,
        canonical_test_id: input.canonicalTestId,
        provider_test_id: input.providerTestId,
        source_url: input.sourceUrl,
        target_url: input.targetUrl,
        utm_source: input.utmSource,
        utm_campaign: input.utmCampaign,
        session_id: input.sessionId,
        city: input.city,
        raw_payload: input.rawPayload ?? {},
      });
    assertNoError(error, 'insert monetization_events');
  }

  async findCanonicalTestBySearch(testSearch: string): Promise<DbCanonicalPriceComparison['canonical_test'] | undefined> {
    const { data, error } = await this.supabase
      .from('canonical_tests')
      .select('id, code, name_ru, name_en, kind, aliases');
    assertNoError(error, 'select canonical_tests by search');

    const normalizedSearch = normalizeProviderName(testSearch);
    const matched = ((data ?? []) as DbCanonicalTestRow[]).find((row) => {
      const values = [row.id, row.code, row.name_ru, row.name_en ?? '', ...(row.aliases ?? [])];
      return values.some((value) => normalizeProviderName(value) === normalizedSearch);
    });

    return matched ? mapCanonicalTest(matched) : undefined;
  }

  async listCanonicalTests(): Promise<Array<DbCanonicalPriceComparison['canonical_test']>> {
    const canonicalTests = await this.getCanonicalTests();
    return canonicalTests.map(mapCanonicalTest);
  }

  async searchLabTestsFromDb(input: {
    query: string;
    cityName: string;
    limit?: number;
  }): Promise<DbLabSearchResult> {
    const query = input.query.trim();
    const limit = input.limit ?? 8;
    if (!query) {
      return {
        query: input.query,
        city: input.cityName,
        resolved_test: null,
        suggestions: [],
        offers: [],
        cheapest: null,
        source_status: 'empty_query',
      };
    }

    const exactCanonical = await this.findCanonicalTestBySearch(query);
    const clinicalServiceCanonical = exactCanonical ? undefined : await this.findCanonicalTestByClinicalServiceSlug(query);
    const providerSuggestion = exactCanonical || clinicalServiceCanonical ? undefined : await this.findCanonicalTestByProviderSearch(query);
    const resolved = exactCanonical ?? clinicalServiceCanonical ?? providerSuggestion?.canonical_test;
    const textSuggestions = await this.findCanonicalTextSuggestions(query, limit);
    const suggestions = dedupeLabSearchSuggestions([
      exactCanonical ? { canonical_test: exactCanonical, match_reason: 'exact_canonical' as const } : undefined,
      clinicalServiceCanonical ? { canonical_test: clinicalServiceCanonical, match_reason: 'clinical_service_slug' as const } : undefined,
      providerSuggestion,
      ...textSuggestions,
    ]).slice(0, limit);

    if (!resolved) {
      return {
        query,
        city: input.cityName,
        resolved_test: null,
        suggestions,
        offers: [],
        cheapest: null,
        source_status: suggestions.length > 0 ? 'suggestions_only' : 'not_found',
      };
    }

    const comparison = await this.compareCanonicalTestPricesFromDb(resolved.id, input.cityName);
    const offers = comparison.offers.slice(0, limit);
    return {
      query,
      city: input.cityName,
      resolved_test: comparison.canonical_test,
      suggestions,
      offers,
      cheapest: offers[0] ?? null,
      source_status: 'resolved',
    };
  }

  async compareCanonicalTestPricesFromDb(
    canonicalTestId: string,
    cityName: string,
  ): Promise<DbCanonicalPriceComparison> {
    const canonical = await this.getCanonicalTest(canonicalTestId);
    const regions = await this.getRegionsByCity(cityName);
    const providerTests = await this.getProviderTestsByCanonical(canonical.id);
    const providerRows = await this.getProvidersByIds([
      ...new Set([
        ...regions.map((region) => region.provider_id as string),
        ...providerTests.map((test) => test.provider_id),
      ]),
    ]);
    const providersById = new Map(providerRows.map((provider) => [provider.id, provider]));
    const regionsById = new Map(regions.map((region) => [region.id, region]));
    const testsById = new Map(providerTests.map((test) => [test.id, test]));
    const aliases = getCanonicalAliases(canonical);
    const latestPrices = providerTests.length === 0 || regions.length === 0
      ? []
      : await this.getLatestPrices({
        providerTestIds: providerTests.map((test) => test.id),
        labRegionIds: regions.map((region) => region.id),
      });
    const regularOffers = latestPrices
      .map<DbPriceComparisonOffer | undefined>((price) => {
        const test = testsById.get(price.provider_test_id);
        const provider = providersById.get(price.provider_id);
        const region = regionsById.get(price.lab_region_id);
        const effectivePriceRub = price.effective_price_rub ?? price.promo_price_rub ?? price.regular_price_rub ?? undefined;

        if (!test || !provider || !region) {
          return undefined;
        }

        return {
          provider: {
            id: provider.id,
            code: provider.code,
            name: provider.display_name ?? provider.name,
          },
          region: {
            id: region.id,
            code: region.code,
            name: region.name,
            city: region.city,
          },
          provider_test_id: test.id,
          provider_test_name: test.name,
          provider_test_code: test.external_code ?? undefined,
          offer_type: price.offer_type === 'promo' ? 'promo' : 'regular',
          offer_source: 'provider_test_prices',
          regular_price_rub: price.regular_price_rub ?? undefined,
          promo_price_rub: price.promo_price_rub ?? undefined,
          effective_price_rub: effectivePriceRub,
          biomaterial_price_rub: price.biomaterial_price_rub ?? undefined,
          total_price_rub: effectivePriceRub === undefined
            ? undefined
            : effectivePriceRub + (price.biomaterial_price_rub ?? 0),
          source_url: price.source_url ?? undefined,
          fetched_at: price.fetched_at,
        };
      })
      .filter((offer): offer is DbPriceComparisonOffer => offer !== undefined);
    const promoOffers = regions.length === 0
      ? []
      : await this.getPromotionItemOffersForCanonical({
        aliases,
        regions,
        providersById,
        regionsById,
        providerTestsById: testsById,
      });
    const offers = [...regularOffers, ...promoOffers]
      .sort((a, b) => (a.total_price_rub ?? Number.POSITIVE_INFINITY) - (b.total_price_rub ?? Number.POSITIVE_INFINITY));
    const unmatchedProviderTests = offers.length > 0 ? [] : await this.findUnmatchedProviderTestsForCanonical(canonical, providersById);

    return {
      canonical_test: mapCanonicalTest(canonical),
      city: cityName,
      offers,
      unmatched_provider_tests: unmatchedProviderTests,
      auto_match_suggestion: unmatchedProviderTests.length === 0
        ? undefined
        : 'Canonical test is not linked yet. Review these unmatched provider_tests and set provider_tests.canonical_test_id, or add aliases and run auto-match by normalized_name.',
    };
  }

  async autoMatchProviderTestsFromDb(input: {
    providerCode: string;
    cityName?: string;
    write?: boolean;
    limit?: number;
  }): Promise<DbProviderTestMatchResult> {
    const provider = await this.selectSingle<DbProviderRow>('lab_providers', 'id, code, name, display_name', { code: input.providerCode });
    const canonicalTests = await this.getCanonicalTests();
    const providerTests = await this.getUnmatchedProviderTestsByProvider({
      providerId: provider.id,
      cityName: input.cityName,
      limit: input.limit ?? 200,
    });
    const matches = providerTests
      .map<DbProviderTestMatchCandidate | DbProviderTestBlockedCandidate | undefined>((test) => {
        const normalizedName = test.normalized_name ?? normalizeProviderName(test.name);
        const providerTestKind = classifyProviderTestName(normalizedName);
        const match = findStrongProviderCodeCanonicalMatch({
          providerCode: provider.code,
          externalCode: test.external_code ?? undefined,
          canonicalTests,
        }) ?? findCanonicalMatchForName(normalizedName, canonicalTests, providerTestKind);

        if (!match) {
          return undefined;
        }

        return {
          provider: {
            id: provider.id,
            code: provider.code,
            name: provider.display_name ?? provider.name,
          },
          provider_test_id: test.id,
          provider_test_name: test.name,
          provider_test_code: test.external_code ?? undefined,
          source_url: test.source_url ?? undefined,
          canonical_test: {
            id: match.canonical.id,
            code: match.canonical.code,
            name_ru: match.canonical.name_ru,
          },
          confidence: match.confidence,
          reason: match.reason,
          provider_test_kind: providerTestKind,
          status: match.status,
        };
      })
      .filter((candidate): candidate is DbProviderTestMatchCandidate | DbProviderTestBlockedCandidate => candidate !== undefined);
    const candidates = matches.filter((candidate): candidate is DbProviderTestMatchCandidate => candidate.reason !== 'blocked_complex_candidate');
    const blockedCandidates = matches.filter((candidate): candidate is DbProviderTestBlockedCandidate => candidate.reason === 'blocked_complex_candidate');
    let updatedCount = 0;

    if (input.write) {
      for (const candidate of candidates) {
        const { error } = await this.supabase
          .from('provider_tests')
          .update({
            canonical_test_id: candidate.canonical_test.id,
            match_status: 'auto_matched',
            match_confidence: candidate.confidence,
            matched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidate.provider_test_id);
        assertNoError(error, 'update provider_tests auto-match');
        updatedCount += 1;
      }
    }

    return {
      provider: input.providerCode,
      city: input.cityName,
      mode: input.write ? 'write' : 'dry-run',
      candidates,
      blocked_candidates: blockedCandidates,
      matched_count: candidates.length,
      blocked_count: blockedCandidates.length,
      updated_count: updatedCount,
    };
  }

  async manualMatchProviderTest(input: {
    providerCode: string;
    providerTestCode: string;
    canonicalSearch: string;
    matchedBy?: string;
    write?: boolean;
  }): Promise<DbManualMatchResult> {
    const provider = await this.selectSingle<DbProviderRow>('lab_providers', 'id, code, name, display_name', { code: input.providerCode });
    const canonical = await this.findCanonicalTestBySearch(input.canonicalSearch);
    if (!canonical) {
      throw new Error(`canonical_test not found for "${input.canonicalSearch}"`);
    }

    const { data, error } = await this.supabase
      .from('provider_tests')
      .select('id, provider_id, canonical_test_id, external_code, name, normalized_name, source_url, raw_payload')
      .eq('provider_id', provider.id)
      .eq('external_code', input.providerTestCode)
      .single();
    assertNoError(error, 'select provider_test for manual match');
    const providerTest = requireRow<DbProviderTestRow>(data as DbProviderTestRow | null, 'select provider_test for manual match');
    const matchedAt = new Date().toISOString();
    const rawPayload = {
      ...(providerTest.raw_payload ?? {}),
      manual_match: {
        canonical_test_id: canonical.id,
        canonical_code: canonical.code,
        canonical_name_ru: canonical.name_ru,
        matched_by: input.matchedBy,
        matched_at: matchedAt,
      },
    };

    if (input.write) {
      const updatePayload: Record<string, unknown> = {
        canonical_test_id: canonical.id,
        match_status: 'manual_matched',
        match_confidence: 1,
        matched_at: matchedAt,
        raw_payload: rawPayload,
        updated_at: matchedAt,
      };

      if (input.matchedBy && isUuid(input.matchedBy)) {
        updatePayload.matched_by = input.matchedBy;
      }

      const { error: updateError } = await this.supabase
        .from('provider_tests')
        .update(updatePayload)
        .eq('id', providerTest.id);
      assertNoError(updateError, 'manual update provider_tests');
    }

    return {
      provider: {
        id: provider.id,
        code: provider.code,
        name: provider.display_name ?? provider.name,
      },
      mode: input.write ? 'write' : 'dry-run',
      provider_test: {
        id: providerTest.id,
        name: providerTest.name,
        provider_test_code: providerTest.external_code ?? undefined,
        source_url: providerTest.source_url ?? undefined,
        previous_canonical_test_id: providerTest.canonical_test_id,
      },
      canonical_test: {
        id: canonical.id,
        code: canonical.code,
        name_ru: canonical.name_ru,
      },
      matched_by: input.matchedBy,
      updated: input.write ?? false,
    };
  }

  async listProviderTestsForMatchQueue(input: {
    providerCode: string;
    cityName?: string;
    limit?: number;
  }): Promise<DbProviderTestMatchQueueItem[]> {
    const provider = await this.selectSingle<DbProviderRow>('lab_providers', 'id, code, name, display_name', { code: input.providerCode });
    const providerTests = await this.getUnmatchedProviderTestsByProvider({
      providerId: provider.id,
      cityName: input.cityName,
      limit: input.limit ?? 100,
    });

    return providerTests.map((test) => ({
      provider: {
        id: provider.id,
        code: provider.code,
        name: provider.display_name ?? provider.name,
      },
      provider_test_id: test.id,
      provider_test_name: test.name,
      provider_test_code: test.external_code ?? undefined,
      source_url: test.source_url ?? undefined,
    }));
  }

  async listMatchedProviderTests(input: {
    providerCode: string;
    cityName?: string;
    limit?: number;
  }): Promise<DbProviderTestMatchStatusItem[]> {
    const provider = await this.selectSingle<DbProviderRow>('lab_providers', 'id, code, name, display_name', { code: input.providerCode });
    let query = this.supabase
      .from('provider_tests')
      .select('id, provider_id, canonical_test_id, external_code, name, normalized_name, source_url, match_status, match_confidence, matched_at')
      .eq('provider_id', provider.id)
      .in('match_status', ['auto_matched', 'manual_matched'])
      .order('matched_at', { ascending: false })
      .limit(input.limit ?? 50);

    const { data, error } = await query;
    assertNoError(error, 'select matched provider_tests');
    let providerTests = (data ?? []) as Array<DbProviderTestRow & {
      match_status?: 'auto_matched' | 'manual_matched' | null;
      match_confidence?: number | null;
      matched_at?: string | null;
    }>;

    if (input.cityName && providerTests.length > 0) {
      const regions = await this.getRegionsByCity(input.cityName);
      const regionIds = new Set(regions.map((region) => region.id));
      const pricesData = await this.selectPriceRegionRowsByProviderTestIds(providerTests.map((test) => test.id));
      const providerTestIdsWithCityPrices = new Set(
        pricesData
          .filter((price) => regionIds.has(price.lab_region_id))
          .map((price) => price.provider_test_id),
      );
      providerTests = providerTests.filter((test) => providerTestIdsWithCityPrices.has(test.id));
    }

    const canonicalIds = [...new Set(providerTests.map((test) => test.canonical_test_id).filter((id): id is string => Boolean(id)))];
    const canonicalTests = await this.getCanonicalTestsByIds(canonicalIds);
    const canonicalById = new Map(canonicalTests.map((canonical) => [canonical.id, canonical]));

    return providerTests.map((test) => {
      const canonical = test.canonical_test_id ? canonicalById.get(test.canonical_test_id) : undefined;
      return {
        provider: {
          id: provider.id,
          code: provider.code,
          name: provider.display_name ?? provider.name,
        },
        provider_test_id: test.id,
        provider_test_name: test.name,
        provider_test_code: test.external_code ?? undefined,
        source_url: test.source_url ?? undefined,
        match_status: test.match_status ?? 'auto_matched',
        match_confidence: test.match_confidence ?? undefined,
        matched_at: test.matched_at ?? undefined,
        canonical_test: canonical ? {
          id: canonical.id,
          code: canonical.code,
          name_ru: canonical.name_ru,
        } : undefined,
      };
    });
  }

  async listScraperRuns(limit = 50): Promise<DbScraperRunListItem[]> {
    const { data, error } = await this.supabase
      .from('scraper_runs')
      .select(`
        id,
        run_type,
        run_source,
        status,
        started_at,
        finished_at,
        stats,
        error,
        lab_providers(code, name, display_name),
        lab_regions(code, name, city)
      `)
      .order('started_at', { ascending: false })
      .limit(limit);
    assertNoError(error, 'select scraper_runs list');

    return ((data ?? []) as Array<{
      id: string;
      run_type: string;
      run_source?: ScraperRunSource | null;
      status: string;
      started_at: string;
      finished_at?: string | null;
      stats?: Record<string, unknown> | null;
      error?: string | null;
      lab_providers?: DbScraperRunListItem['provider'];
      lab_regions?: DbScraperRunListItem['region'];
    }>).map((run) => ({
      id: run.id,
      provider: run.lab_providers,
      region: run.lab_regions,
      run_type: run.run_type,
      run_source: run.run_source,
      status: run.status,
      started_at: run.started_at,
      finished_at: run.finished_at,
      stats: run.stats ?? {},
      error: run.error,
    }));
  }

  async upsertProviderDiscoveryQuery(input: {
    query: string;
    city: string;
    source: string;
    vertical?: string;
    priority?: number;
    enabled?: boolean;
    rawPayload?: unknown;
  }): Promise<ProviderDiscoveryQueryRecord> {
    const vertical = input.vertical ?? 'lab_tests';
    const existing = await this.selectMaybeSingle<ProviderDiscoveryQueryRecord>(
      'provider_discovery_queries',
      'id, query, city, source, vertical',
      {
        query: input.query,
        city: input.city,
        source: input.source,
        vertical,
      },
    );
    const payload = {
      query: input.query,
      city: input.city,
      source: input.source,
      vertical,
      priority: input.priority ?? 100,
      enabled: input.enabled ?? true,
      raw_payload: input.rawPayload ?? {},
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await this.supabase
        .from('provider_discovery_queries')
        .update(payload)
        .eq('id', existing.id)
        .select('id, query, city, source, vertical')
        .single();
      assertNoError(error, 'update provider_discovery_queries');
      return requireRow<ProviderDiscoveryQueryRecord>(data as ProviderDiscoveryQueryRecord | null, 'update provider_discovery_queries');
    }

    const { data, error } = await this.supabase
      .from('provider_discovery_queries')
      .insert(payload)
      .select('id, query, city, source, vertical')
      .single();
    assertNoError(error, 'insert provider_discovery_queries');
    return requireRow<ProviderDiscoveryQueryRecord>(data as ProviderDiscoveryQueryRecord | null, 'insert provider_discovery_queries');
  }

  async createProviderDiscoveryRun(input: {
    queryId?: string;
    city: string;
    source: string;
    runSource?: ScraperRunSource;
    rawPayload?: unknown;
  }): Promise<ProviderDiscoveryRunRecord> {
    const { data, error } = await this.supabase
      .from('provider_discovery_runs')
      .insert({
        query_id: input.queryId,
        city: input.city,
        source: input.source,
        run_source: input.runSource ?? 'manual',
        status: 'running',
        raw_payload: input.rawPayload ?? {},
      })
      .select('id')
      .single();
    assertNoError(error, 'insert provider_discovery_runs');
    return requireRow<ProviderDiscoveryRunRecord>(data as ProviderDiscoveryRunRecord | null, 'insert provider_discovery_runs');
  }

  async finishProviderDiscoveryRun(input: {
    runId: string;
    status: DiscoveryRunStatus;
    stats?: Record<string, unknown>;
    error?: string;
    rawPayload?: unknown;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('provider_discovery_runs')
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        stats: input.stats ?? {},
        error: input.error,
        raw_payload: input.rawPayload,
      })
      .eq('id', input.runId);
    assertNoError(error, 'update provider_discovery_runs');
  }

  async findProviderDiscoveryDuplicate(input: NormalizedProviderDiscoveryCandidate): Promise<ProviderDiscoveryDuplicate | undefined> {
    if (input.domain) {
      const { data: providerData, error: providerError } = await this.supabase
        .from('lab_providers')
        .select('id, code, name, display_name, domains')
        .contains('domains', [input.domain])
        .maybeSingle();
      assertNoError(providerError, 'select lab_providers by discovery domain');
      const provider = providerData as (DbProviderRow & { domains?: string[] | null }) | null;
      if (provider) {
        return {
          status: 'duplicate',
          matchedProviderId: provider.id,
          reason: 'known_provider_domain',
          message: `known provider domain: ${input.domain}`,
        };
      }
    }

    if (input.normalizedAddress) {
      const { data: locationData, error: locationError } = await this.supabase
        .from('lab_locations')
        .select('id, provider_id, address, city')
        .eq('city', input.city)
        .eq('address', input.address ?? '')
        .maybeSingle();
      assertNoError(locationError, 'select lab_locations by discovery address');
      const location = locationData as { id: string; provider_id?: string | null; address: string } | null;
      if (location) {
        return {
          status: 'duplicate',
          matchedProviderId: location.provider_id ?? undefined,
          reason: 'known_location_address',
          message: `known lab location address: ${location.address}`,
        };
      }
    }

    const existingCandidate = await this.findExistingProviderCandidate(input);
    if (existingCandidate) {
      return {
        status: 'duplicate',
        duplicateOfCandidateId: existingCandidate.id,
        reason: input.domain && existingCandidate.domain === input.domain
          ? 'existing_candidate_domain'
          : input.normalizedPhone && normalizePhoneValue(existingCandidate.phone ?? undefined) === input.normalizedPhone
            ? 'existing_candidate_phone'
            : input.normalizedAddress && normalizeProviderName(existingCandidate.address ?? '') === input.normalizedAddress
              ? 'existing_candidate_address'
              : 'existing_candidate_name_city',
        message: `existing discovery candidate: ${existingCandidate.name}`,
      };
    }

    return undefined;
  }

  async upsertProviderCandidate(input: NormalizedProviderDiscoveryCandidate): Promise<ProviderDiscoveryWriteResult> {
    const existing = await this.findExistingProviderCandidate(input);
    const payload = {
      name: input.name,
      normalized_name: input.normalizedName,
      website_url: input.websiteUrl,
      domain: input.domain,
      phone: input.phone,
      address: input.address,
      city: input.city,
      lat: input.lat,
      lng: input.lng,
      source_type: input.sourceType,
      confidence: input.confidence,
      status: input.status,
      matched_provider_id: input.matchedProviderId,
      duplicate_of_candidate_id: input.duplicateOfCandidateId,
      raw_payload: {
        ...input.rawPayload,
        duplicate_hint: input.duplicateHint,
        suggested_action: input.suggestedAction,
      },
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await this.supabase
        .from('provider_candidates')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
      assertNoError(error, 'update provider_candidates');
      return {
        candidateId: requireRow<DbIdRow>(data, 'update provider_candidates').id,
        action: 'updated',
      };
    }

    const { data, error } = await this.supabase
      .from('provider_candidates')
      .insert(payload)
      .select('id')
      .single();
    if (isUniqueViolation(error)) {
      const duplicate = await this.findExistingProviderCandidate(input);
      if (duplicate) {
        return { candidateId: duplicate.id, action: 'skipped_duplicate' };
      }
    }
    assertNoError(error, 'insert provider_candidates');
    return {
      candidateId: requireRow<DbIdRow>(data, 'insert provider_candidates').id,
      action: 'inserted',
    };
  }

  async upsertProviderCandidateSource(input: {
    candidateId: string;
    runId?: string;
    queryId?: string;
    sourceType: string;
    sourceUrl?: string;
    externalId?: string;
    rawPayload?: unknown;
    fetchedAt?: string;
  }): Promise<void> {
    const { data: existing, error: selectError } = await this.supabase
      .from('provider_candidate_sources')
      .select('id')
      .eq('candidate_id', input.candidateId)
      .eq('source_type', input.sourceType)
      .eq('source_url', input.sourceUrl ?? '')
      .eq('external_id', input.externalId ?? '')
      .maybeSingle();
    assertNoError(selectError, 'select provider_candidate_sources');

    const payload = {
      candidate_id: input.candidateId,
      run_id: input.runId,
      query_id: input.queryId,
      source_type: input.sourceType,
      source_url: input.sourceUrl,
      external_id: input.externalId,
      raw_payload: input.rawPayload ?? {},
      fetched_at: input.fetchedAt ?? new Date().toISOString(),
    };

    if (existing) {
      const { error } = await this.supabase
        .from('provider_candidate_sources')
        .update(payload)
        .eq('id', (existing as DbIdRow).id);
      assertNoError(error, 'update provider_candidate_sources');
      return;
    }

    const { error } = await this.supabase
      .from('provider_candidate_sources')
      .insert(payload);
    if (isUniqueViolation(error)) {
      return;
    }
    assertNoError(error, 'insert provider_candidate_sources');
  }

  async listProviderCandidates(input: {
    city?: string;
    status?: string;
    source?: string;
    limit?: number;
  } = {}): Promise<DbProviderCandidate[]> {
    let query = this.supabase
      .from('provider_candidates')
      .select(`
        id,
        name,
        normalized_name,
        website_url,
        domain,
        phone,
        address,
        city,
        lat,
        lng,
        source_type,
        confidence,
        status,
        matched_provider_id,
        duplicate_of_candidate_id,
        raw_payload,
        created_at,
        updated_at,
        matched_provider:lab_providers(id, code, name, display_name),
        duplicate_candidate:provider_candidates!provider_candidates_duplicate_of_candidate_id_fkey(id, name, city)
      `)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 100);

    if (input.city) {
      query = query.eq('city', input.city);
    }
    if (input.status) {
      query = query.eq('status', input.status);
    }
    if (input.source) {
      query = query.eq('source_type', input.source);
    }

    const { data, error } = await query;
    assertNoError(error, 'select provider_candidates');
    return ((data ?? []) as unknown as Array<DbProviderCandidate & {
      matched_provider?: DbProviderCandidate['matched_provider'] | DbProviderCandidate['matched_provider'][];
      duplicate_candidate?: DbProviderCandidate['duplicate_candidate'] | DbProviderCandidate['duplicate_candidate'][];
    }>).map((candidate) => ({
      ...candidate,
      matched_provider: Array.isArray(candidate.matched_provider) ? candidate.matched_provider[0] ?? null : candidate.matched_provider ?? null,
      duplicate_candidate: Array.isArray(candidate.duplicate_candidate) ? candidate.duplicate_candidate[0] ?? null : candidate.duplicate_candidate ?? null,
    }));
  }

  async listProviderDiscoveryRuns(limit = 50): Promise<DbProviderDiscoveryRun[]> {
    const { data, error } = await this.supabase
      .from('provider_discovery_runs')
      .select(`
        id,
        query_id,
        city,
        source,
        status,
        run_source,
        started_at,
        finished_at,
        stats,
        error,
        raw_payload,
        query:provider_discovery_queries(id, query, source, city)
      `)
      .order('started_at', { ascending: false })
      .limit(limit);
    assertNoError(error, 'select provider_discovery_runs');
    return ((data ?? []) as unknown as Array<DbProviderDiscoveryRun & {
      query?: DbProviderDiscoveryRun['query'] | DbProviderDiscoveryRun['query'][];
    }>).map((run) => ({
      ...run,
      query: Array.isArray(run.query) ? run.query[0] ?? null : run.query ?? null,
      stats: run.stats ?? {},
    }));
  }

  async listProviderDiscoveryQueries(input: {
    city?: string;
    enabled?: boolean;
    limit?: number;
  } = {}): Promise<DbProviderDiscoveryQuery[]> {
    let query = this.supabase
      .from('provider_discovery_queries')
      .select('id, query, city, source, vertical, canonical_test_id, priority, enabled, last_run_at, raw_payload, created_at, updated_at')
      .order('priority', { ascending: true })
      .order('city', { ascending: true })
      .limit(input.limit ?? 100);

    if (input.city) {
      query = query.eq('city', input.city);
    }
    if (input.enabled !== undefined) {
      query = query.eq('enabled', input.enabled);
    }

    const { data, error } = await query;
    assertNoError(error, 'select provider_discovery_queries');
    return (data ?? []) as DbProviderDiscoveryQuery[];
  }

  async getMarketQualityStats(): Promise<DbMarketQualityStats> {
    const [
      providersCount,
      canonicalTestsCount,
      providerTestsCount,
      matchedCount,
      unmatchedCount,
      pricesCount,
      promotionsCount,
      promotionItemsCount,
      scraperRunsCount,
      matchStatuses,
    ] = await Promise.all([
      this.countRows('lab_providers'),
      this.countRows('canonical_tests'),
      this.countRows('provider_tests'),
      this.countRows('provider_tests', { column: 'canonical_test_id', nullFilter: 'not_null' }),
      this.countRows('provider_tests', { column: 'canonical_test_id', nullFilter: 'null' }),
      this.countRows('provider_test_prices'),
      this.countRows('lab_promotions'),
      this.countRows('lab_promotion_items'),
      this.countRows('scraper_runs'),
      this.selectProviderTestMatchStatuses(),
    ]);

    return {
      providers_count: providersCount,
      canonical_tests_count: canonicalTestsCount,
      provider_tests_count: providerTestsCount,
      provider_tests_matched_count: matchedCount,
      provider_tests_unmatched_count: unmatchedCount,
      provider_test_prices_count: pricesCount,
      promotions_count: promotionsCount,
      promotion_items_count: promotionItemsCount,
      scraper_runs_count: scraperRunsCount,
      match_status_counts: countBy(matchStatuses.map((row) => row.match_status ?? 'unmatched')),
    };
  }

  private async findProviderTest(input: {
    providerId: string;
    externalCode?: string;
    normalizedName: string;
    sourceUrl: string;
  }): Promise<DbIdRow | undefined> {
    if (input.externalCode) {
      const { data, error } = await this.supabase
        .from('provider_tests')
        .select('id')
        .eq('provider_id', input.providerId)
        .eq('external_code', input.externalCode)
        .maybeSingle();
      assertNoError(error, 'select provider_tests by external_code');
      if (data) {
        return data;
      }
    }

    const { data, error } = await this.supabase
      .from('provider_tests')
      .select('id')
      .eq('provider_id', input.providerId)
      .eq('normalized_name', input.normalizedName)
      .eq('source_url', input.sourceUrl)
      .maybeSingle();
    assertNoError(error, 'select provider_tests by normalized_name/source_url');
    return data ?? undefined;
  }

  private async findExistingProviderCandidate(input: NormalizedProviderDiscoveryCandidate): Promise<DbProviderCandidate | undefined> {
    if (input.domain) {
      const { data, error } = await this.supabase
        .from('provider_candidates')
        .select('id, name, normalized_name, website_url, domain, phone, address, city, lat, lng, source_type, confidence, status, matched_provider_id, duplicate_of_candidate_id, raw_payload, created_at, updated_at')
        .eq('domain', input.domain)
        .eq('city', input.city)
        .maybeSingle();
      assertNoError(error, 'select provider_candidates by domain');
      if (data) {
        return data as DbProviderCandidate;
      }
    }

    if (input.normalizedPhone) {
      const { data, error } = await this.supabase
        .from('provider_candidates')
        .select('id, name, normalized_name, website_url, domain, phone, address, city, lat, lng, source_type, confidence, status, matched_provider_id, duplicate_of_candidate_id, raw_payload, created_at, updated_at')
        .eq('phone', input.phone ?? input.normalizedPhone)
        .eq('city', input.city)
        .maybeSingle();
      assertNoError(error, 'select provider_candidates by phone');
      if (data) {
        return data as DbProviderCandidate;
      }
    }

    let query = this.supabase
      .from('provider_candidates')
      .select('id, name, normalized_name, website_url, domain, phone, address, city, lat, lng, source_type, confidence, status, matched_provider_id, duplicate_of_candidate_id, raw_payload, created_at, updated_at')
      .eq('city', input.city)
      .eq('normalized_name', input.normalizedName);

    query = input.address ? query.eq('address', input.address) : query.is('address', null);
    const { data, error } = await query.maybeSingle();
    assertNoError(error, 'select provider_candidates by name/address');
    return (data as DbProviderCandidate | null) ?? undefined;
  }

  private async resolveCanonicalTestIdByCode(code: string): Promise<string | undefined> {
    const { data, error } = await this.supabase
      .from('canonical_tests')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    assertNoError(error, 'select canonical_tests by code');
    return data?.id;
  }

  private async findPromotion(input: {
    providerId: string;
    labRegionId: string;
    promotion: LabPromotionRecord;
  }): Promise<DbIdRow | undefined> {
    if (input.promotion.externalId) {
      const { data, error } = await this.supabase
        .from('lab_promotions')
        .select('id')
        .eq('provider_id', input.providerId)
        .eq('external_id', input.promotion.externalId)
        .maybeSingle();
      assertNoError(error, 'select lab_promotions by external_id');
      if (data) {
        return data;
      }
    }

    let query = this.supabase
      .from('lab_promotions')
      .select('id')
      .eq('provider_id', input.providerId)
      .eq('lab_region_id', input.labRegionId)
      .eq('title', input.promotion.title)
      .eq('source_url', input.promotion.sourceUrl);

    query = input.promotion.startsOn === undefined
      ? query.is('starts_on', null)
      : query.eq('starts_on', input.promotion.startsOn);
    query = input.promotion.endsOn === undefined
      ? query.is('ends_on', null)
      : query.eq('ends_on', input.promotion.endsOn);

    const { data, error } = await query.maybeSingle();
    assertNoError(error, 'select lab_promotions');
    return data ?? undefined;
  }

  private async findPromotionItem(input: {
    promotionId: string;
    providerTestCode?: string;
    originalName: string;
    sourceUrl: string;
  }): Promise<DbIdRow | undefined> {
    if (input.providerTestCode) {
      const { data, error } = await this.supabase
        .from('lab_promotion_items')
        .select('id')
        .eq('promotion_id', input.promotionId)
        .eq('provider_test_code', input.providerTestCode)
        .maybeSingle();
      assertNoError(error, 'select lab_promotion_items by code');
      if (data) {
        return data;
      }
    }

    const { data, error } = await this.supabase
      .from('lab_promotion_items')
      .select('id')
      .eq('promotion_id', input.promotionId)
      .eq('original_name', input.originalName)
      .eq('source_url', input.sourceUrl)
      .maybeSingle();
    assertNoError(error, 'select lab_promotion_items by name/source_url');
    return data ?? undefined;
  }

  private async selectSingle<T extends DbIdRow>(
    table: string,
    columns: string,
    filters: Record<string, string>,
  ): Promise<T> {
    let query = this.supabase.from(table).select(columns);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query.single();
    assertNoError(error, `select ${table}`);
    return requireRow<T>(data as unknown as T | null, `select ${table}`);
  }

  private async selectMaybeSingle<T extends DbIdRow>(
    table: string,
    columns: string,
    filters: Record<string, string>,
  ): Promise<T | undefined> {
    let query = this.supabase.from(table).select(columns);
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query.maybeSingle();
    assertNoError(error, `select ${table}`);
    return (data as unknown as T | null) ?? undefined;
  }

  private async countRows(
    table: string,
    filter?: { column: string; nullFilter: 'null' | 'not_null' },
  ): Promise<number> {
    let query = this.supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter?.nullFilter === 'null') {
      query = query.is(filter.column, null);
    } else if (filter?.nullFilter === 'not_null') {
      query = query.not(filter.column, 'is', null);
    }
    const { count, error } = await query;
    assertNoError(error, `count ${table}`);
    return count ?? 0;
  }

  private async selectProviderTestMatchStatuses(): Promise<Array<{ match_status?: string | null }>> {
    const { data, error } = await this.supabase
      .from('provider_tests')
      .select('match_status')
      .limit(10000);
    assertNoError(error, 'select provider_tests match_status');
    return (data ?? []) as Array<{ match_status?: string | null }>;
  }

  private async getCanonicalTest(canonicalTestId: string): Promise<DbCanonicalTestRow> {
    const { data, error } = await this.supabase
      .from('canonical_tests')
      .select('id, code, name_ru, name_en, kind, aliases')
      .eq('id', canonicalTestId)
      .single();
    assertNoError(error, 'select canonical_tests');
    return requireRow<DbCanonicalTestRow>(data, 'select canonical_tests');
  }

  private async getCanonicalTests(): Promise<DbCanonicalTestRow[]> {
    const { data, error } = await this.supabase
      .from('canonical_tests')
      .select('id, code, name_ru, name_en, kind, aliases');
    assertNoError(error, 'select canonical_tests');
    return (data ?? []) as DbCanonicalTestRow[];
  }

  private async getCanonicalTestsByIds(ids: string[]): Promise<DbCanonicalTestRow[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('canonical_tests')
      .select('id, code, name_ru, name_en, kind, aliases')
      .in('id', ids);
    assertNoError(error, 'select canonical_tests by ids');
    return (data ?? []) as DbCanonicalTestRow[];
  }

  private async findCanonicalTestByClinicalServiceSlug(query: string): Promise<DbCanonicalPriceComparison['canonical_test'] | undefined> {
    const slug = normalizeServiceSlug(query);
    if (!slug) {
      return undefined;
    }

    const { data, error } = await this.supabase
      .from('clinical_services')
      .select('canonical_test_id')
      .eq('seo_slug', slug)
      .maybeSingle();

    if (error || !data?.canonical_test_id) {
      return undefined;
    }

    const canonical = await this.getCanonicalTest(data.canonical_test_id as string);
    return mapCanonicalTest(canonical);
  }

  private async findCanonicalTestByProviderSearch(query: string): Promise<DbLabSearchSuggestion | undefined> {
    const normalizedQuery = normalizeProviderName(query);
    const exactCode = /^[\w.-]+$/i.test(query.trim()) ? query.trim() : undefined;
    const providerTests = await this.findProviderTestsForSearch({
      normalizedQuery,
      exactCode,
      limit: 10,
    });
    const matched = providerTests.find((test) => test.canonical_test_id);
    if (!matched?.canonical_test_id) {
      return undefined;
    }

    const canonical = await this.getCanonicalTest(matched.canonical_test_id);
    return {
      canonical_test: mapCanonicalTest(canonical),
      match_reason: 'provider_test',
      provider_test: {
        provider_test_id: matched.id,
        provider_test_name: matched.name,
        provider_test_code: matched.external_code ?? undefined,
        source_url: matched.source_url ?? undefined,
      },
    };
  }

  private async findCanonicalTextSuggestions(query: string, limit: number): Promise<DbLabSearchSuggestion[]> {
    const normalizedQuery = normalizeProviderName(query);
    if (!normalizedQuery) {
      return [];
    }

    const canonicalTests = await this.getCanonicalTests();
    return canonicalTests
      .filter((canonical) => getCanonicalAliases(canonical).some((alias) => {
        return alias.normalized.includes(normalizedQuery) || normalizedQuery.includes(alias.normalized);
      }))
      .slice(0, limit)
      .map((canonical) => ({
        canonical_test: mapCanonicalTest(canonical),
        match_reason: 'text_suggestion',
      }));
  }

  private async findProviderTestsForSearch(input: {
    normalizedQuery: string;
    exactCode?: string;
    limit: number;
  }): Promise<DbProviderTestRow[]> {
    const rows: DbProviderTestRow[] = [];
    if (input.exactCode) {
      const { data, error } = await this.supabase
        .from('provider_tests')
        .select('id, provider_id, canonical_test_id, external_code, name, normalized_name, source_url, raw_payload')
        .eq('external_code', input.exactCode)
        .limit(input.limit);
      assertNoError(error, 'select provider_tests by search external_code');
      rows.push(...((data ?? []) as DbProviderTestRow[]));
    }

    const { data, error } = await this.supabase
      .from('provider_tests')
      .select('id, provider_id, canonical_test_id, external_code, name, normalized_name, source_url, raw_payload')
      .ilike('normalized_name', `%${input.normalizedQuery}%`)
      .limit(input.limit);
    assertNoError(error, 'select provider_tests by search name');
    rows.push(...((data ?? []) as DbProviderTestRow[]));

    return dedupeProviderTestRows(rows).slice(0, input.limit);
  }

  private async getRegionsByCity(cityName: string): Promise<Array<DbRegionRow & { provider_id: string }>> {
    const { data, error } = await this.supabase
      .from('lab_regions')
      .select('id, provider_id, code, name, city')
      .eq('city', cityName);
    assertNoError(error, 'select lab_regions by city');
    return (data ?? []) as Array<DbRegionRow & { provider_id: string }>;
  }

  private async getProviderTestsByCanonical(canonicalTestId: string): Promise<DbProviderTestRow[]> {
    const { data, error } = await this.supabase
      .from('provider_tests')
      .select('id, provider_id, canonical_test_id, external_code, name, normalized_name, source_url')
      .eq('canonical_test_id', canonicalTestId);
    assertNoError(error, 'select provider_tests by canonical');
    return (data ?? []) as DbProviderTestRow[];
  }

  private async getUnmatchedProviderTestsByProvider(input: {
    providerId: string;
    cityName?: string;
    limit: number;
  }): Promise<DbProviderTestRow[]> {
    let query = this.supabase
      .from('provider_tests')
      .select('id, provider_id, canonical_test_id, external_code, name, normalized_name, source_url')
      .eq('provider_id', input.providerId)
      .is('canonical_test_id', null)
      .limit(input.limit);

    const { data, error } = await query;
    assertNoError(error, 'select unmatched provider_tests by provider');
    const providerTests = (data ?? []) as DbProviderTestRow[];

    if (!input.cityName || providerTests.length === 0) {
      return providerTests;
    }

    const regions = await this.getRegionsByCity(input.cityName);
    const regionIds = new Set(regions.map((region) => region.id));
    const pricesData = await this.selectPriceRegionRowsByProviderTestIds(providerTests.map((test) => test.id));
    const providerTestIdsWithCityPrices = new Set(
      pricesData
        .filter((price) => regionIds.has(price.lab_region_id))
        .map((price) => price.provider_test_id),
    );

    return providerTests.filter((test) => providerTestIdsWithCityPrices.has(test.id));
  }

  private async getProvidersByIds(providerIds: string[]): Promise<DbProviderRow[]> {
    if (providerIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('lab_providers')
      .select('id, code, name, display_name')
      .in('id', providerIds);
    assertNoError(error, 'select lab_providers by ids');
    return (data ?? []) as DbProviderRow[];
  }

  private async selectPriceRegionRowsByProviderTestIds(
    providerTestIds: string[],
  ): Promise<Array<{ provider_test_id: string; lab_region_id: string }>> {
    const rows: Array<{ provider_test_id: string; lab_region_id: string }> = [];
    const batchSize = 100;

    for (let index = 0; index < providerTestIds.length; index += batchSize) {
      const batch = providerTestIds.slice(index, index + batchSize);
      const { data, error } = await this.supabase
        .from('provider_test_prices')
        .select('provider_test_id, lab_region_id')
        .in('provider_test_id', batch);
      assertNoError(error, 'select provider_test_prices for match city filter');
      rows.push(...((data ?? []) as Array<{ provider_test_id: string; lab_region_id: string }>));
    }

    return rows;
  }

  private async getLatestPrices(input: {
    providerTestIds: string[];
    labRegionIds: string[];
  }): Promise<DbPriceRow[]> {
    const { data, error } = await this.supabase
      .from('provider_test_prices')
      .select('provider_test_id, provider_id, lab_region_id, regular_price_rub, promo_price_rub, effective_price_rub, biomaterial_price_rub, offer_type, source_url, fetched_at')
      .in('provider_test_id', input.providerTestIds)
      .in('lab_region_id', input.labRegionIds)
      .order('fetched_at', { ascending: false });
    assertNoError(error, 'select latest provider_test_prices');

    const latestByTestAndRegion = new Map<string, DbPriceRow>();
    for (const price of (data ?? []) as DbPriceRow[]) {
      const key = `${price.provider_test_id}:${price.lab_region_id}`;
      if (!latestByTestAndRegion.has(key)) {
        latestByTestAndRegion.set(key, price);
      }
    }

    return [...latestByTestAndRegion.values()];
  }

  private async getPromotionItemOffersForCanonical(input: {
    aliases: Array<{ raw: string; normalized: string }>;
    regions: Array<DbRegionRow & { provider_id: string }>;
    providersById: Map<string, DbProviderRow>;
    regionsById: Map<string, DbRegionRow & { provider_id: string }>;
    providerTestsById: Map<string, DbProviderTestRow>;
  }): Promise<DbPriceComparisonOffer[]> {
    const regionIds = input.regions.map((region) => region.id);
    const { data: promotionsData, error: promotionsError } = await this.supabase
      .from('lab_promotions')
      .select('id, provider_id, lab_region_id, title, starts_on, ends_on, source_url, fetched_at')
      .in('lab_region_id', regionIds);
    assertNoError(promotionsError, 'select lab_promotions for comparison');

    const promotions = (promotionsData ?? []) as DbPromotionRow[];
    if (promotions.length === 0) {
      return [];
    }

    const promotionsById = new Map(promotions.map((promotion) => [promotion.id, promotion]));
    const { data: itemsData, error: itemsError } = await this.supabase
      .from('lab_promotion_items')
      .select('id, promotion_id, provider_test_id, provider_test_code, original_name, regular_price_rub, promo_price_rub, effective_price_rub, biomaterial_price_rub, source_url, created_at')
      .in('promotion_id', promotions.map((promotion) => promotion.id));
    assertNoError(itemsError, 'select lab_promotion_items for comparison');

    return ((itemsData ?? []) as DbPromotionItemRow[])
      .map<DbPriceComparisonOffer | undefined>((item) => {
        const promotion = promotionsById.get(item.promotion_id);
        const region = promotion?.lab_region_id ? input.regionsById.get(promotion.lab_region_id) : undefined;
        const provider = promotion ? input.providersById.get(promotion.provider_id) : undefined;
        const providerTest = item.provider_test_id ? input.providerTestsById.get(item.provider_test_id) : undefined;
        const normalizedName = normalizeProviderName(item.original_name);
        const matchedAlias = input.aliases.find((alias) => isSafeAliasMatch(normalizedName, alias.normalized));
        const effectivePriceRub = item.effective_price_rub ?? item.promo_price_rub ?? item.regular_price_rub ?? undefined;

        if (!promotion || !region || !provider || !matchedAlias) {
          return undefined;
        }

        return {
          provider: {
            id: provider.id,
            code: provider.code,
            name: provider.display_name ?? provider.name,
          },
          region: {
            id: region.id,
            code: region.code,
            name: region.name,
            city: region.city,
          },
          provider_test_id: item.provider_test_id ?? `promotion-item:${item.id}`,
          provider_test_name: providerTest?.name ?? item.original_name,
          provider_test_code: providerTest?.external_code ?? item.provider_test_code ?? undefined,
          offer_type: 'promo',
          offer_source: 'lab_promotion_items',
          promotion_title: promotion.title,
          valid_from: promotion.starts_on ?? undefined,
          valid_to: promotion.ends_on ?? undefined,
          regular_price_rub: item.regular_price_rub ?? undefined,
          promo_price_rub: item.promo_price_rub ?? undefined,
          effective_price_rub: effectivePriceRub,
          biomaterial_price_rub: item.biomaterial_price_rub ?? undefined,
          total_price_rub: effectivePriceRub === undefined
            ? undefined
            : effectivePriceRub + (item.biomaterial_price_rub ?? 0),
          source_url: item.source_url ?? promotion.source_url ?? undefined,
          fetched_at: promotion.fetched_at ?? item.created_at,
        };
      })
      .filter((offer): offer is DbPriceComparisonOffer => offer !== undefined);
  }

  private async findUnmatchedProviderTestsForCanonical(
    canonical: DbCanonicalTestRow,
    existingProvidersById: Map<string, DbProviderRow>,
  ): Promise<DbUnmatchedProviderTestSuggestion[]> {
    const aliases = getCanonicalAliases(canonical);
    const { data, error } = await this.supabase
      .from('provider_tests')
      .select('id, provider_id, external_code, name, normalized_name, source_url')
      .is('canonical_test_id', null)
      .limit(200);
    assertNoError(error, 'select unmatched provider_tests');

    const rows = (data ?? []) as DbProviderTestRow[];
    const missingProviderIds = [...new Set(rows.map((row) => row.provider_id).filter((id) => !existingProvidersById.has(id)))];
    const providersById = new Map(existingProvidersById);
    for (const provider of await this.getProvidersByIds(missingProviderIds)) {
      providersById.set(provider.id, provider);
    }

    return rows
      .map<DbUnmatchedProviderTestSuggestion | undefined>((test) => {
        const normalizedName = test.normalized_name ?? normalizeProviderName(test.name);
        const matchedAlias = aliases.find((alias) => isSafeAliasMatch(normalizedName, alias.normalized));
        const provider = providersById.get(test.provider_id);

        if (!matchedAlias || !provider) {
          return undefined;
        }

        return {
          provider: {
            id: provider.id,
            code: provider.code,
            name: provider.display_name ?? provider.name,
          },
          provider_test_id: test.id,
          provider_test_name: test.name,
          provider_test_code: test.external_code ?? undefined,
          source_url: test.source_url ?? undefined,
          match_reason: `alias:${matchedAlias.raw}`,
        };
      })
      .filter((item): item is DbUnmatchedProviderTestSuggestion => item !== undefined);
  }
}

function assertNoError(error: { message?: string } | null, action: string): void {
  if (error) {
    throw new Error(`${action} failed: ${error.message ?? JSON.stringify(error)}`);
  }
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' || /duplicate key value violates unique constraint/i.test(error?.message ?? '');
}

function toSnapshotDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function normalizePhoneValue(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D+/g, '') ?? '';
  if (!digits) {
    return undefined;
  }
  return digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requireRow<T>(data: T | null, action: string): T {
  if (!data) {
    throw new Error(`${action} returned no data`);
  }

  return data;
}

function mapCanonicalTest(row: DbCanonicalTestRow): DbCanonicalPriceComparison['canonical_test'] {
  return {
    id: row.id,
    code: row.code,
    name_ru: row.name_ru,
    name_en: row.name_en,
    aliases: row.aliases ?? [],
  };
}

function mapLabLocation(row: DbLabLocationRow): LabLocation {
  return {
    id: row.id,
    provider_id: row.provider_id,
    lab_region_id: row.lab_region_id,
    name: row.name,
    address: row.address,
    city: row.city,
    lat: Number(row.lat),
    lng: Number(row.lng),
    geo_hash: row.geo_hash,
    coverage_radius_km: row.coverage_radius_km === null || row.coverage_radius_km === undefined
      ? null
      : Number(row.coverage_radius_km),
    pickup_type: row.pickup_type,
    source_url: row.source_url,
    raw_payload: row.raw_payload,
  };
}

function getCanonicalAliases(canonical: DbCanonicalTestRow): Array<{ raw: string; normalized: string }> {
  return [canonical.code, canonical.name_ru, canonical.name_en ?? '', ...(canonical.aliases ?? [])]
    .filter(Boolean)
    .map((value) => ({ raw: value, normalized: normalizeProviderName(value) }))
    .filter((value) => value.normalized.length > 1);
}

function normalizeServiceSlug(value: string): string {
  return normalizeProviderName(value)
    .replace(/[^0-9a-zа-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function dedupeLabSearchSuggestions(values: Array<DbLabSearchSuggestion | undefined>): DbLabSearchSuggestion[] {
  const seen = new Set<string>();
  const result: DbLabSearchSuggestion[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }

    const key = value.canonical_test.id || value.canonical_test.code;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function dedupeProviderTestRows(rows: DbProviderTestRow[]): DbProviderTestRow[] {
  const seen = new Set<string>();
  const result: DbProviderTestRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) {
      continue;
    }

    seen.add(row.id);
    result.push(row);
  }

  return result;
}

function findStrongProviderCodeCanonicalMatch(input: {
  providerCode: string;
  externalCode?: string;
  canonicalTests: DbCanonicalTestRow[];
}): {
  canonical: DbCanonicalTestRow;
  confidence: number;
  reason: string;
  status: 'exact_provider_code';
} | undefined {
  if (input.providerCode === 'cmd' && input.externalCode === '190204') {
    const canonical = input.canonicalTests.find((test) => test.code === 'KARYOTYPE');
    if (canonical) {
      return {
        canonical,
        confidence: 1,
        reason: 'exact_provider_code',
        status: 'exact_provider_code',
      };
    }
  }

  return undefined;
}

function findCanonicalMatchForName(
  normalizedName: string,
  canonicalTests: DbCanonicalTestRow[],
  providerTestKind: ProviderTestNameKind = classifyProviderTestName(normalizedName),
): {
  canonical: DbCanonicalTestRow;
  confidence: number;
  reason: string | 'blocked_complex_candidate';
  status: 'exact_name' | 'safe_alias';
} | undefined {
  for (const canonical of canonicalTests) {
    if (normalizeProviderName(canonical.name_ru) === normalizedName) {
      if (shouldBlockKindMatch(providerTestKind, canonical)) {
        return { canonical, confidence: 0, reason: 'blocked_complex_candidate', status: 'exact_name' };
      }
      return { canonical, confidence: 1, reason: 'exact_name', status: 'exact_name' };
    }
  }

  for (const canonical of canonicalTests) {
    const matchedAlias = getCanonicalAliases(canonical).find((alias) => isAliasPrefixMatch(normalizedName, alias.normalized));
    if (matchedAlias) {
      if (hasComplexMarkerAfterAlias(normalizedName, matchedAlias.normalized) || shouldBlockKindMatch(providerTestKind, canonical)) {
        return {
          canonical,
          confidence: 0,
          reason: 'blocked_complex_candidate',
          status: 'safe_alias',
        };
      }

      return {
        canonical,
        confidence: 0.86,
        reason: `safe_alias:${matchedAlias.raw}`,
        status: 'safe_alias',
      };
    }
  }

  return undefined;
}

function classifyProviderTestName(normalizedName: string): ProviderTestNameKind {
  if (/(^|\s)(комплекс|чек ап|чекап|профиль|панель|набор|скрининг)(\s|$)/.test(normalizedName)) {
    return 'panel';
  }

  if (/\+|(^|\s)(и|плюс)(\s|$)/.test(normalizedName)) {
    return 'complex';
  }

  if (normalizedName.length > 1) {
    return 'analysis';
  }

  return 'unknown';
}

function shouldBlockKindMatch(providerTestKind: ProviderTestNameKind, canonical: DbCanonicalTestRow): boolean {
  return (providerTestKind === 'panel' || providerTestKind === 'complex') && (canonical.kind ?? 'analysis') === 'analysis';
}

function isSafeAliasMatch(normalizedName: string, normalizedAlias: string): boolean {
  return isAliasPrefixMatch(normalizedName, normalizedAlias) && !hasComplexMarkerAfterAlias(normalizedName, normalizedAlias);
}

function isAliasPrefixMatch(normalizedName: string, normalizedAlias: string): boolean {
  if (normalizedName === normalizedAlias) {
    return true;
  }

  return normalizedName.startsWith(`${normalizedAlias} `);
}

function hasComplexMarkerAfterAlias(normalizedName: string, normalizedAlias: string): boolean {
  const rest = normalizedName === normalizedAlias
    ? ''
    : normalizedName.slice(normalizedAlias.length).trim();

  if (!rest) {
    return false;
  }

  return /^(и|плюс|моча|кал|слюна)(\s|$)/.test(rest)
    || /\+|(^|\s)(комплекс|чек ап|профиль|панель|набор|обмен|расширенное|расширенный)(\s|$)/.test(rest);
}
