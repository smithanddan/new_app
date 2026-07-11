import { normalizeProviderName } from './provider-scraper.js';
import type { ScraperRunSource } from './supabase-lab-catalog.repository.js';

export type DiscoverySourceType = 'manual_seed' | '2gis' | 'wordstat_seed' | 'search' | 'website';
export type ProviderDiscoveryStatus = 'new' | 'needs_review' | 'accepted' | 'rejected' | 'duplicate';
export type DiscoveryRunMode = 'dry-run' | 'write';
export type DiscoveryRunStatus = 'completed' | 'failed' | 'skipped';

export type DiscoveryInput = {
  city: string;
  query: string;
  limit?: number;
};

export type ProviderDiscoveryCandidate = {
  name: string;
  normalizedName?: string;
  websiteUrl?: string;
  domain?: string;
  phone?: string;
  address?: string;
  city: string;
  lat?: number;
  lng?: number;
  sourceType: DiscoverySourceType;
  confidence?: number;
  status?: ProviderDiscoveryStatus;
  matchedProviderId?: string;
  duplicateOfCandidateId?: string;
  duplicateHint?: string;
  suggestedAction?: 'review' | 'duplicate' | 'accept_candidate_later';
  sourceUrl?: string;
  externalId?: string;
  rawPayload?: Record<string, unknown>;
};

export type ProviderDiscoveryQueryRecord = {
  id: string;
  query: string;
  city: string;
  source: string;
  vertical: string;
};

export type ProviderDiscoveryRunRecord = {
  id: string;
};

export type ProviderDiscoveryWriteResult = {
  candidateId: string;
  action: 'inserted' | 'updated' | 'skipped_duplicate';
};

export type ProviderDiscoveryRepository = {
  upsertProviderDiscoveryQuery(input: {
    query: string;
    city: string;
    source: string;
    vertical?: string;
    priority?: number;
    enabled?: boolean;
    rawPayload?: unknown;
  }): Promise<ProviderDiscoveryQueryRecord>;
  createProviderDiscoveryRun(input: {
    queryId?: string;
    city: string;
    source: string;
    runSource?: ScraperRunSource;
    rawPayload?: unknown;
  }): Promise<ProviderDiscoveryRunRecord>;
  finishProviderDiscoveryRun(input: {
    runId: string;
    status: DiscoveryRunStatus;
    stats?: Record<string, unknown>;
    error?: string;
    rawPayload?: unknown;
  }): Promise<void>;
  findProviderDiscoveryDuplicate(input: NormalizedProviderDiscoveryCandidate): Promise<ProviderDiscoveryDuplicate | undefined>;
  upsertProviderCandidate(input: NormalizedProviderDiscoveryCandidate): Promise<ProviderDiscoveryWriteResult>;
  upsertProviderCandidateSource(input: {
    candidateId: string;
    runId?: string;
    queryId?: string;
    sourceType: string;
    sourceUrl?: string;
    externalId?: string;
    rawPayload?: unknown;
    fetchedAt?: string;
  }): Promise<void>;
};

export type DiscoveryAdapter = {
  source: string;
  discoverProviders(input: DiscoveryInput): Promise<ProviderDiscoveryCandidate[]>;
};

export type ProviderDiscoveryDuplicate = {
  status: 'duplicate' | 'needs_review';
  matchedProviderId?: string;
  duplicateOfCandidateId?: string;
  reason: 'known_provider_domain' | 'known_location_address' | 'existing_candidate_name_city' | 'existing_candidate_domain' | 'existing_candidate_phone' | 'existing_candidate_address';
  message: string;
};

export type NormalizedProviderDiscoveryCandidate = Required<Pick<ProviderDiscoveryCandidate, 'name' | 'city' | 'sourceType'>> & {
  normalizedName: string;
  websiteUrl?: string;
  domain?: string;
  phone?: string;
  normalizedPhone?: string;
  address?: string;
  normalizedAddress?: string;
  lat?: number;
  lng?: number;
  confidence: number;
  status: ProviderDiscoveryStatus;
  matchedProviderId?: string;
  duplicateOfCandidateId?: string;
  duplicateHint?: string;
  suggestedAction: 'review' | 'duplicate' | 'accept_candidate_later';
  sourceUrl?: string;
  externalId?: string;
  rawPayload: Record<string, unknown>;
};

export type DiscoveryRunReport = {
  city: string;
  query: string;
  source: string;
  mode: DiscoveryRunMode;
  run_source: ScraperRunSource;
  run_id: string | null;
  query_id: string | null;
  candidates_count: number;
  written_count: number;
  duplicate_count: number;
  needs_review_count: number;
  errors_count: number;
  errors: string[];
  candidates: NormalizedProviderDiscoveryCandidate[];
};

type ManualSeedCandidate = Omit<ProviderDiscoveryCandidate, 'sourceType'> & {
  sourceType?: DiscoverySourceType;
  knownProviderCode?: string;
  searchTerms?: string[];
};

const MANUAL_SEED_CANDIDATES: ManualSeedCandidate[] = [
  {
    name: 'CMD',
    websiteUrl: 'https://www.cmd-online.ru/',
    domain: 'cmd-online.ru',
    phone: '+7 495 788-00-01',
    address: 'Москва',
    city: 'Москва',
    confidence: 0.96,
    knownProviderCode: 'cmd',
    searchTerms: ['лаборатория анализов', 'сдать анализы', 'анализ крови', 'кариотип цена'],
  },
  {
    name: 'INVITRO',
    websiteUrl: 'https://www.invitro.ru/',
    domain: 'invitro.ru',
    phone: '+7 800 200-36-30',
    address: 'Москва',
    city: 'Москва',
    confidence: 0.98,
    knownProviderCode: 'invitro',
    searchTerms: ['лаборатория анализов', 'сдать анализы', 'анализ крови', 'кариотип цена'],
  },
  {
    name: 'Гемотест',
    websiteUrl: 'https://gemotest.ru/',
    domain: 'gemotest.ru',
    phone: '+7 800 550-13-13',
    address: 'Москва',
    city: 'Москва',
    confidence: 0.98,
    knownProviderCode: 'gemotest',
    searchTerms: ['лаборатория анализов', 'сдать анализы', 'анализ крови'],
  },
  {
    name: 'ДНКОМ',
    websiteUrl: 'https://dnkom.ru/',
    domain: 'dnkom.ru',
    phone: '+7 495 266-63-33',
    address: 'Москва',
    city: 'Москва',
    confidence: 0.97,
    knownProviderCode: 'dnkom',
    searchTerms: ['лаборатория анализов', 'сдать анализы', 'анализ крови'],
  },
  {
    name: 'Хеликс',
    websiteUrl: 'https://helix.ru/',
    domain: 'helix.ru',
    phone: '+7 800 700-03-03',
    address: 'Москва',
    city: 'Москва',
    confidence: 0.92,
    knownProviderCode: 'helix',
    searchTerms: ['лаборатория анализов', 'сдать анализы', 'анализ крови'],
  },
  {
    name: 'KDL',
    websiteUrl: 'https://kdl.ru/',
    domain: 'kdl.ru',
    phone: '+7 495 640-06-40',
    address: 'Москва',
    city: 'Москва',
    confidence: 0.92,
    knownProviderCode: 'kdl',
    searchTerms: ['лаборатория анализов', 'сдать анализы', 'анализ крови'],
  },
  {
    name: 'Никсор Клиник',
    websiteUrl: 'https://nixorclinic.ru/',
    domain: 'nixorclinic.ru',
    address: 'Долгопрудный',
    city: 'Долгопрудный',
    confidence: 0.78,
    searchTerms: ['лаборатория анализов долгопрудный', 'клиника анализы долгопрудный', 'анализ крови долгопрудный'],
  },
  {
    name: 'МЦДОЛ',
    websiteUrl: 'https://mcdol.ru/',
    domain: 'mcdol.ru',
    address: 'Долгопрудный',
    city: 'Долгопрудный',
    confidence: 0.74,
    searchTerms: ['лаборатория анализов долгопрудный', 'клиника анализы долгопрудный', 'сдать анализы долгопрудный'],
  },
  {
    name: 'Медицинский центр Долгопрудный',
    address: 'Долгопрудный',
    city: 'Долгопрудный',
    confidence: 0.62,
    searchTerms: ['клиника анализы долгопрудный', 'анализ крови долгопрудный'],
  },
  {
    name: 'Лаборатория анализов Долгопрудный',
    address: 'Долгопрудный',
    city: 'Долгопрудный',
    confidence: 0.58,
    searchTerms: ['лаборатория анализов долгопрудный', 'сдать анализы долгопрудный'],
  },
];

export class ManualSeedDiscoveryAdapter implements DiscoveryAdapter {
  readonly source = 'manual';

  async discoverProviders(input: DiscoveryInput): Promise<ProviderDiscoveryCandidate[]> {
    const normalizedQuery = normalizeDiscoveryText(input.query);
    const normalizedCity = normalizeDiscoveryText(input.city);
    const limit = input.limit ?? 25;

    return MANUAL_SEED_CANDIDATES
      .filter((candidate) => normalizeDiscoveryText(candidate.city) === normalizedCity)
      .filter((candidate) => {
        const terms = candidate.searchTerms ?? [];
        if (terms.length === 0) {
          return true;
        }
        return terms.some((term) => {
          const normalizedTerm = normalizeDiscoveryText(term);
          return normalizedTerm.includes(normalizedQuery)
            || normalizedQuery.includes(normalizedTerm)
            || tokenOverlapScore(normalizedQuery, normalizedTerm) >= 0.34;
        });
      })
      .slice(0, limit)
      .map((candidate) => ({
        ...candidate,
        sourceType: candidate.sourceType ?? 'manual_seed',
        rawPayload: {
          ...(candidate.rawPayload ?? {}),
          seed: 'manual_provider_discovery_mvp',
          known_provider_code: candidate.knownProviderCode,
          search_terms: candidate.searchTerms,
        },
      }));
  }
}

export class TwoGisDiscoveryAdapter implements DiscoveryAdapter {
  readonly source = '2gis';

  async discoverProviders(input: DiscoveryInput): Promise<ProviderDiscoveryCandidate[]> {
    return [{
      name: '2ГИС discovery adapter disabled',
      city: input.city,
      sourceType: '2gis',
      confidence: 0,
      status: 'needs_review',
      rawPayload: {
        disabled: true,
        reason: 'MVP placeholder: no real 2GIS API calls in this sprint.',
        env_present: Boolean(process.env.TWOGIS_API_KEY),
        query: input.query,
      },
    }];
  }
}

export class DiscoveryRunner {
  constructor(
    private readonly repository?: ProviderDiscoveryRepository,
    private readonly adapter: DiscoveryAdapter = new ManualSeedDiscoveryAdapter(),
  ) {}

  async run(input: {
    city: string;
    query: string;
    mode?: DiscoveryRunMode;
    limit?: number;
    runSource?: ScraperRunSource;
  }): Promise<DiscoveryRunReport> {
    const mode = input.mode ?? 'dry-run';
    const runSource = input.runSource ?? 'manual';
    const errors: string[] = [];
    let queryId: string | null = null;
    let runId: string | null = null;

    if (mode === 'write' && !this.repository) {
      throw new Error('discovery write mode requires Supabase repository');
    }

    try {
      if (mode === 'write' && this.repository) {
        const query = await this.repository.upsertProviderDiscoveryQuery({
          query: input.query,
          city: input.city,
          source: this.adapter.source,
          vertical: 'lab_tests',
          rawPayload: { run_source: runSource },
        });
        queryId = query.id;

        const run = await this.repository.createProviderDiscoveryRun({
          queryId,
          city: input.city,
          source: this.adapter.source,
          runSource,
          rawPayload: {
            query: input.query,
            limit: input.limit,
          },
        });
        runId = run.id;
      }

      const rawCandidates = await this.adapter.discoverProviders({
        city: input.city,
        query: input.query,
        limit: input.limit,
      });
      const normalized = await this.normalizeAndDedupe(rawCandidates);
      let writtenCount = 0;

      if (mode === 'write' && this.repository) {
        for (const candidate of normalized) {
          const writeResult = await this.repository.upsertProviderCandidate(candidate);
          writtenCount += writeResult.action === 'skipped_duplicate' ? 0 : 1;
          await this.repository.upsertProviderCandidateSource({
            candidateId: writeResult.candidateId,
            runId: runId ?? undefined,
            queryId: queryId ?? undefined,
            sourceType: candidate.sourceType,
            sourceUrl: candidate.sourceUrl ?? candidate.websiteUrl,
            externalId: candidate.externalId,
            rawPayload: candidate.rawPayload,
          });
        }
      }

      const report = buildReport({
        city: input.city,
        query: input.query,
        source: this.adapter.source,
        mode,
        runSource,
        runId,
        queryId,
        writtenCount,
        errors,
        candidates: normalized,
      });

      if (mode === 'write' && this.repository && runId) {
        await this.repository.finishProviderDiscoveryRun({
          runId,
          status: 'completed',
          stats: {
            candidates: report.candidates_count,
            written: report.written_count,
            duplicates: report.duplicate_count,
            needs_review: report.needs_review_count,
            errors: report.errors_count,
          },
        });
      }

      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      if (mode === 'write' && this.repository && runId) {
        await this.repository.finishProviderDiscoveryRun({
          runId,
          status: 'failed',
          error: message,
          stats: { errors: errors.length },
        });
      }
      throw error;
    }
  }

  private async normalizeAndDedupe(candidates: ProviderDiscoveryCandidate[]): Promise<NormalizedProviderDiscoveryCandidate[]> {
    const seen = new Map<string, NormalizedProviderDiscoveryCandidate>();
    const normalized: NormalizedProviderDiscoveryCandidate[] = [];

    for (const candidate of candidates) {
      const item = normalizeDiscoveryCandidate(candidate);
      const localKey = [
        item.city,
        item.domain || item.normalizedName,
        item.normalizedAddress ?? '',
        item.normalizedPhone ?? '',
      ].join('|');

      if (seen.has(localKey)) {
        const duplicateOf = seen.get(localKey);
        normalized.push({
          ...item,
          status: 'duplicate',
          duplicateHint: `duplicate in current result set: ${duplicateOf?.name}`,
          suggestedAction: 'duplicate',
        });
        continue;
      }

      const duplicate = this.repository
        ? await this.repository.findProviderDiscoveryDuplicate(item)
        : inferSeedDuplicate(item);

      if (duplicate) {
        item.status = duplicate.status;
        item.matchedProviderId = duplicate.matchedProviderId;
        item.duplicateOfCandidateId = duplicate.duplicateOfCandidateId;
        item.duplicateHint = duplicate.message;
        item.suggestedAction = duplicate.status === 'duplicate' ? 'duplicate' : 'review';
      }

      seen.set(localKey, item);
      normalized.push(item);
    }

    return normalized;
  }
}

export function buildDiscoveryAdapter(source: string): DiscoveryAdapter {
  if (source === '2gis') {
    return new TwoGisDiscoveryAdapter();
  }

  return new ManualSeedDiscoveryAdapter();
}

export function normalizeDiscoveryCandidate(candidate: ProviderDiscoveryCandidate): NormalizedProviderDiscoveryCandidate {
  const domain = normalizeDomain(candidate.domain ?? extractDomain(candidate.websiteUrl));
  const normalizedName = candidate.normalizedName ?? normalizeProviderName(candidate.name);
  const normalizedPhone = normalizePhone(candidate.phone);
  const normalizedAddress = normalizeAddress(candidate.address);
  const confidence = clampConfidence(candidate.confidence ?? scoreCandidate(candidate));
  const seedKnownProviderCode = typeof candidate.rawPayload?.known_provider_code === 'string'
    ? candidate.rawPayload.known_provider_code
    : undefined;
  const status = candidate.status ?? (seedKnownProviderCode ? 'duplicate' : confidence >= 0.72 ? 'needs_review' : 'new');

  return {
    name: candidate.name,
    normalizedName,
    websiteUrl: candidate.websiteUrl,
    domain,
    phone: candidate.phone,
    normalizedPhone,
    address: candidate.address,
    normalizedAddress,
    city: candidate.city,
    lat: candidate.lat,
    lng: candidate.lng,
    sourceType: candidate.sourceType,
    confidence,
    status,
    matchedProviderId: candidate.matchedProviderId,
    duplicateOfCandidateId: candidate.duplicateOfCandidateId,
    duplicateHint: candidate.duplicateHint,
    suggestedAction: candidate.suggestedAction ?? (status === 'duplicate' ? 'duplicate' : 'review'),
    sourceUrl: candidate.sourceUrl ?? candidate.websiteUrl,
    externalId: candidate.externalId,
    rawPayload: candidate.rawPayload ?? {},
  };
}

export function normalizeDiscoveryText(value: string): string {
  return normalizeProviderName(value)
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractDomain(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

export function normalizeDomain(value: string | undefined): string | undefined {
  return value?.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase() || undefined;
}

export function normalizePhone(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D+/g, '') ?? '';
  if (!digits) {
    return undefined;
  }
  return digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits;
}

export function normalizeAddress(value: string | undefined): string | undefined {
  const normalized = normalizeDiscoveryText(value ?? '');
  return normalized || undefined;
}

function scoreCandidate(candidate: ProviderDiscoveryCandidate): number {
  let score = 0.45;
  if (candidate.websiteUrl || candidate.domain) {
    score += 0.2;
  }
  if (candidate.phone) {
    score += 0.1;
  }
  if (candidate.address) {
    score += 0.1;
  }
  if (candidate.lat !== undefined && candidate.lng !== undefined) {
    score += 0.05;
  }
  if (candidate.name.length >= 3) {
    score += 0.05;
  }
  return clampConfidence(score);
}

function inferSeedDuplicate(candidate: NormalizedProviderDiscoveryCandidate): ProviderDiscoveryDuplicate | undefined {
  const knownDomains = new Set(['cmd-online.ru', 'invitro.ru', 'gemotest.ru', 'dnkom.ru', 'helix.ru', 'kdl.ru']);
  if (candidate.domain && knownDomains.has(candidate.domain)) {
    return {
      status: 'duplicate',
      reason: 'known_provider_domain',
      message: `known provider domain: ${candidate.domain}`,
    };
  }
  return undefined;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function tokenOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = right.split(' ').filter(Boolean);
  if (leftTokens.size === 0 || rightTokens.length === 0) {
    return 0;
  }
  const hits = rightTokens.filter((token) => leftTokens.has(token)).length;
  return hits / Math.max(leftTokens.size, rightTokens.length);
}

function buildReport(input: {
  city: string;
  query: string;
  source: string;
  mode: DiscoveryRunMode;
  runSource: ScraperRunSource;
  runId: string | null;
  queryId: string | null;
  writtenCount: number;
  errors: string[];
  candidates: NormalizedProviderDiscoveryCandidate[];
}): DiscoveryRunReport {
  return {
    city: input.city,
    query: input.query,
    source: input.source,
    mode: input.mode,
    run_source: input.runSource,
    run_id: input.runId,
    query_id: input.queryId,
    candidates_count: input.candidates.length,
    written_count: input.writtenCount,
    duplicate_count: input.candidates.filter((candidate) => candidate.status === 'duplicate').length,
    needs_review_count: input.candidates.filter((candidate) => candidate.status === 'needs_review' || candidate.status === 'new').length,
    errors_count: input.errors.length,
    errors: input.errors,
    candidates: input.candidates,
  };
}
