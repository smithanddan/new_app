import "server-only";

import { DEFAULT_CITY, getLabSearchPageData } from "./lab-data";
import {
  getSeoDemandKeywordsSafe,
  type SeoDemandKeyword,
} from "./seo-demand";
import {
  getSeoDemandSourceSuggestions,
  type SeoDemandSourceSuggestion,
} from "./seo-demand-source-suggestions";
import { getSeoTestsSafe, type SeoCanonicalTest } from "./seo";

export type SeoDemandGapStatus = "ready" | "no_prices" | "no_canonical" | "no_landing";
export type SeoDemandActionType =
  | "add_canonical"
  | "add_landing"
  | "ingest_prices"
  | "improve_landing";

export type SeoDemandNextAction = {
  action_type: SeoDemandActionType;
  title: string;
  reason: string;
  priority: number;
  target: string;
};

export type SeoDemandQualityCheck = {
  key: string;
  label: string;
  passed: boolean;
  points: number;
};

export type SeoDemandGapRow = {
  canonical_test_code: string;
  canonical_name: string | null;
  landing_slug: string;
  region: string;
  keyword_count: number;
  top_query: string;
  top_priority: number;
  intents: string[];
  monthly_impressions: number | null;
  status: SeoDemandGapStatus;
  offers_count: number;
  cheapest_price_rub: number | null;
  cheapest_provider: string | null;
  source_status: string;
  quality_score: number;
  quality_checks: SeoDemandQualityCheck[];
  next_action: SeoDemandNextAction;
  source_suggestions: SeoDemandSourceSuggestion[];
  landing_href: string | null;
  compare_href: string | null;
  search_href: string;
};

export type SeoDemandGapReport = {
  city: string;
  source: "seed-lab-keywords";
  generated_at: string;
  summary: Record<SeoDemandGapStatus | "keywords" | "groups" | "tests_without_demand" | "average_quality_score", number>;
  rows: SeoDemandGapRow[];
  tests_without_demand: Array<{
    code: string;
    name_ru: string;
    slug: string;
  }>;
};

type DemandGroup = {
  key: string;
  code: string;
  slug: string;
  region: string;
  keywords: SeoDemandKeyword[];
};

export async function getSeoDemandGapReport(input: {
  city?: string;
  status?: SeoDemandGapStatus | "all";
  limit?: number;
} = {}): Promise<SeoDemandGapReport> {
  const city = input.city || DEFAULT_CITY;
  const keywords = getSeoDemandKeywordsSafe();
  const tests = await getSeoTestsSafe();
  const testsByCode = new Map(tests.map((test) => [test.code, test]));
  const demandCodes = new Set(keywords.map((keyword) => keyword.canonical_test_code));
  const groups = groupDemandKeywords(keywords);
  const rows = await Promise.all(groups.map((group) => buildGapRow(group, testsByCode, city)));
  const averageQualityScore = rows.length > 0
    ? Math.round(rows.reduce((total, row) => total + row.quality_score, 0) / rows.length)
    : 0;
  const filteredRows = rows
    .filter((row) => !input.status || input.status === "all" || row.status === input.status)
    .sort(compareGapRows)
    .slice(0, input.limit ?? 100);
  const testsWithoutDemand = tests
    .filter((test) => !demandCodes.has(test.code))
    .map((test) => ({ code: test.code, name_ru: test.name_ru, slug: test.slug }))
    .sort((a, b) => a.name_ru.localeCompare(b.name_ru, "ru"));

  return {
    city,
    source: "seed-lab-keywords",
    generated_at: new Date().toISOString(),
    summary: {
      keywords: keywords.length,
      groups: groups.length,
      ready: rows.filter((row) => row.status === "ready").length,
      no_prices: rows.filter((row) => row.status === "no_prices").length,
      no_canonical: rows.filter((row) => row.status === "no_canonical").length,
      no_landing: rows.filter((row) => row.status === "no_landing").length,
      average_quality_score: averageQualityScore,
      tests_without_demand: testsWithoutDemand.length,
    },
    rows: filteredRows,
    tests_without_demand: testsWithoutDemand,
  };
}

async function buildGapRow(
  group: DemandGroup,
  testsByCode: Map<string, SeoCanonicalTest>,
  city: string,
): Promise<SeoDemandGapRow> {
  const canonical = testsByCode.get(group.code);
  const topKeyword = group.keywords[0];
  const query = canonical?.name_ru || topKeyword.query;
  const search = canonical
    ? await getLabSearchPageData({ q: query, city, limit: "1" })
    : undefined;
  const cheapest = search?.cheapest ?? null;
  const hasLanding = Boolean(canonical?.slug || group.slug);
  const status: SeoDemandGapStatus = !canonical
    ? "no_canonical"
    : !hasLanding
      ? "no_landing"
      : cheapest
        ? "ready"
        : "no_prices";
  const monthlyImpressions = group.keywords.reduce((total, keyword) => {
    return total + (keyword.monthly_impressions ?? 0);
  }, 0);
  const slug = canonical?.slug || group.slug;
  const qualityChecks = buildQualityChecks({
    canonicalExists: Boolean(canonical),
    hasLanding,
    keywordCount: group.keywords.length,
    hasPrice: Boolean(cheapest),
    hasSource: Boolean(cheapest?.source_url),
    hasCompare: Boolean(canonical),
    hasCityLanding: Boolean(canonical && group.region),
    hasFreshPrice: Boolean(cheapest?.fetched_at),
  });
  const qualityScore = qualityChecks.reduce((total, check) => total + (check.passed ? check.points : 0), 0);
  const nextAction = buildNextAction({
    status,
    code: group.code,
    slug,
    topQuery: topKeyword.query,
    priority: topKeyword.priority,
    region: group.region,
    canonicalName: canonical?.name_ru,
    qualityScore,
  });

  return {
    canonical_test_code: group.code,
    canonical_name: canonical?.name_ru ?? null,
    landing_slug: slug,
    region: group.region,
    keyword_count: group.keywords.length,
    top_query: topKeyword.query,
    top_priority: topKeyword.priority,
    intents: [...new Set(group.keywords.map((keyword) => keyword.intent))],
    monthly_impressions: monthlyImpressions > 0 ? monthlyImpressions : null,
    status,
    offers_count: search?.offers.length ?? 0,
    cheapest_price_rub: cheapest?.total_price_rub ?? null,
    cheapest_provider: cheapest?.provider.name ?? null,
    source_status: search?.source_status ?? "not_checked",
    quality_score: qualityScore,
    quality_checks: qualityChecks,
    next_action: nextAction,
    source_suggestions: nextAction.action_type === "ingest_prices"
      ? getSeoDemandSourceSuggestions({ canonicalTestCode: group.code, city, limit: 5 })
      : [],
    landing_href: canonical ? `/test/${slug}` : null,
    compare_href: canonical ? `/compare/${slug}` : null,
    search_href: `/search?q=${encodeURIComponent(topKeyword.query)}&city=${encodeURIComponent(group.region)}`,
  };
}

function buildQualityChecks(input: {
  canonicalExists: boolean;
  hasLanding: boolean;
  keywordCount: number;
  hasPrice: boolean;
  hasSource: boolean;
  hasCompare: boolean;
  hasCityLanding: boolean;
  hasFreshPrice: boolean;
}): SeoDemandQualityCheck[] {
  return [
    { key: "canonical", label: "canonical test", passed: input.canonicalExists, points: 20 },
    { key: "landing", label: "test landing", passed: input.hasLanding, points: 15 },
    { key: "demand", label: "popular queries", passed: input.keywordCount > 0, points: 15 },
    { key: "price", label: "price offer", passed: input.hasPrice, points: 20 },
    { key: "source", label: "source URL", passed: input.hasSource, points: 10 },
    { key: "compare", label: "compare page", passed: input.hasCompare, points: 10 },
    { key: "city", label: "city route", passed: input.hasCityLanding, points: 5 },
    { key: "freshness", label: "price fetched_at", passed: input.hasFreshPrice, points: 5 },
  ];
}

function buildNextAction(input: {
  status: SeoDemandGapStatus;
  code: string;
  slug: string;
  topQuery: string;
  priority: number;
  region: string;
  canonicalName?: string;
  qualityScore: number;
}): SeoDemandNextAction {
  if (input.status === "no_canonical") {
    return {
      action_type: "add_canonical",
      title: "Создать canonical test",
      reason: `Есть спрос по "${input.topQuery}", но нет canonical_tests для ${input.code}.`,
      priority: input.priority + 30,
      target: input.code,
    };
  }
  if (input.status === "no_landing") {
    return {
      action_type: "add_landing",
      title: "Создать landing slug",
      reason: `Canonical найден, но посадочная для ${input.code} не готова.`,
      priority: input.priority + 20,
      target: input.slug,
    };
  }
  if (input.status === "no_prices") {
    return {
      action_type: "ingest_prices",
      title: "Добавить цены",
      reason: `${input.canonicalName || input.code} резолвится, но в ${input.region} нет офферов.`,
      priority: input.priority + 10,
      target: input.code,
    };
  }

  return {
    action_type: "improve_landing",
    title: "Усилить SEO landing",
    reason: `${input.canonicalName || input.code} уже готов к трафику, quality score ${input.qualityScore}/100.`,
    priority: Math.max(1, input.priority - input.qualityScore),
    target: input.slug,
  };
}

function groupDemandKeywords(keywords: SeoDemandKeyword[]): DemandGroup[] {
  const groups = new Map<string, DemandGroup>();
  for (const keyword of keywords) {
    const key = `${keyword.region}:${keyword.canonical_test_code}:${keyword.landing_slug}`;
    const group = groups.get(key) ?? {
      key,
      code: keyword.canonical_test_code,
      slug: keyword.landing_slug,
      region: keyword.region,
      keywords: [],
    };
    group.keywords.push(keyword);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    keywords: group.keywords.sort((a, b) => b.priority - a.priority || a.query.localeCompare(b.query, "ru")),
  }));
}

function compareGapRows(a: SeoDemandGapRow, b: SeoDemandGapRow): number {
  const statusRank: Record<SeoDemandGapStatus, number> = {
    no_canonical: 0,
    no_landing: 1,
    no_prices: 2,
    ready: 3,
  };
  return statusRank[a.status] - statusRank[b.status]
    || b.top_priority - a.top_priority
    || a.top_query.localeCompare(b.top_query, "ru");
}
