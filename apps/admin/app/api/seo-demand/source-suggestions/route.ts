import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CITY } from "../../../lib/lab-data";
import { getQueryParam } from "../../../lib/monetization";
import { getSeoDemandGapReport } from "../../../lib/seo-demand-report";
import {
  getSeoDemandSourceSuggestions,
  type SeoDemandSourceSuggestion,
} from "../../../lib/seo-demand-source-suggestions";

export async function GET(request: NextRequest) {
  const city = getQueryParam(request, "city") || DEFAULT_CITY;
  const code = getQueryParam(request, "code").toUpperCase();
  const limit = clampLimit(getQueryParam(request, "limit"), 50);
  const suggestions = code
    ? getSeoDemandSourceSuggestions({ canonicalTestCode: code, city, limit })
    : await getAllIngestPriceSuggestions(city, limit);

  return NextResponse.json({
    city,
    count: suggestions.length,
    suggestions,
  });
}

async function getAllIngestPriceSuggestions(city: string, limit: number): Promise<SeoDemandSourceSuggestion[]> {
  const report = await getSeoDemandGapReport({ city, status: "all", limit: 250 });
  return report.rows
    .filter((row) => row.next_action.action_type === "ingest_prices")
    .flatMap((row) => row.source_suggestions)
    .slice(0, limit);
}

function clampLimit(value: string, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : fallback;
}
