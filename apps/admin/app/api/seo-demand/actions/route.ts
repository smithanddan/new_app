import { NextResponse, type NextRequest } from "next/server";
import {
  getSeoDemandGapReport,
  type SeoDemandActionType,
} from "../../../lib/seo-demand-report";
import { getQueryParam } from "../../../lib/monetization";

const ACTION_TYPES = new Set(["add_canonical", "add_landing", "ingest_prices", "improve_landing"]);

export async function GET(request: NextRequest) {
  const city = getQueryParam(request, "city") || undefined;
  const actionType = parseActionType(getQueryParam(request, "type"));
  const limit = clampLimit(getQueryParam(request, "limit"), 25);
  const report = await getSeoDemandGapReport({ city, status: "all", limit: 250 });
  const actions = report.rows
    .map((row) => ({
      priority: row.next_action.priority,
      action_type: row.next_action.action_type,
      title: row.next_action.title,
      reason: row.next_action.reason,
      target: row.next_action.target,
      status: row.status,
      quality_score: row.quality_score,
      canonical_test_code: row.canonical_test_code,
      canonical_name: row.canonical_name,
      landing_slug: row.landing_slug,
      top_query: row.top_query,
      region: row.region,
      source_suggestions: row.source_suggestions,
      links: {
        search: row.search_href,
        landing: row.landing_href,
        compare: row.compare_href,
      },
    }))
    .filter((action) => !actionType || action.action_type === actionType)
    .sort((a, b) => b.priority - a.priority || a.top_query.localeCompare(b.top_query, "ru"))
    .slice(0, limit);

  return NextResponse.json({
    city: report.city,
    source: report.source,
    generated_at: report.generated_at,
    count: actions.length,
    actions,
  });
}

function parseActionType(value: string): SeoDemandActionType | undefined {
  return ACTION_TYPES.has(value) ? value as SeoDemandActionType : undefined;
}

function clampLimit(value: string, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : fallback;
}
