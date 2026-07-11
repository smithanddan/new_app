import { NextResponse, type NextRequest } from "next/server";
import type { DbLabSearchResult, DbLabSearchSuggestion } from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";
import { DEFAULT_CITY, getLabSearchPageData } from "../../lib/lab-data";
import { getQueryParam } from "../../lib/monetization";

type LabSuggestItem = {
  label: string;
  code: string;
  href: string;
  match_reason: DbLabSearchSuggestion["match_reason"];
  cheapest_price_rub?: number;
  provider_name?: string;
};

export async function GET(request: NextRequest) {
  const query = getQueryParam(request, "q").trim();
  const city = getQueryParam(request, "city", DEFAULT_CITY);
  const limit = clampLimit(getQueryParam(request, "limit"), 6);

  if (!query || query.includes(",")) {
    return NextResponse.json({
      query,
      city,
      suggestions: [],
      source_status: query ? "basket_query" : "empty_query",
    });
  }

  const result = await getLabSearchPageData({ q: query, city, limit: String(limit) });
  const suggestions = await buildSuggestItems(result, city, limit);

  return NextResponse.json({
    query,
    city,
    suggestions,
    source_status: suggestions.length > 0 ? result.source_status : "not_found",
  });
}

async function buildSuggestItems(result: DbLabSearchResult, city: string, limit: number): Promise<LabSuggestItem[]> {
  const suggestions = result.suggestions.length > 0
    ? result.suggestions
    : result.resolved_test
      ? [{ canonical_test: result.resolved_test, match_reason: "exact_canonical" as const }]
      : [];

  const items = await Promise.all(suggestions.slice(0, limit).map(async (suggestion) => {
    const resolved = result.resolved_test?.id === suggestion.canonical_test.id
      ? result
      : await getLabSearchPageData({ q: suggestion.canonical_test.name_ru, city, limit: "1" });
    const cheapest = resolved.cheapest ?? undefined;

    return {
      label: suggestion.canonical_test.name_ru,
      code: suggestion.canonical_test.code,
      href: `/search?${buildSearchParams({ query: suggestion.canonical_test.name_ru, city })}`,
      match_reason: suggestion.match_reason,
      cheapest_price_rub: cheapest?.total_price_rub ?? cheapest?.effective_price_rub,
      provider_name: cheapest?.provider.name,
    };
  }));

  return dedupeSuggestItems(items).slice(0, limit);
}

function buildSearchParams(input: { query: string; city: string }): string {
  const params = new URLSearchParams();
  params.set("q", input.query);
  params.set("city", input.city);
  return params.toString();
}

function clampLimit(value: string, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(10, parsed)) : fallback;
}

function dedupeSuggestItems(items: LabSuggestItem[]): LabSuggestItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.code)) {
      return false;
    }
    seen.add(item.code);
    return true;
  });
}
