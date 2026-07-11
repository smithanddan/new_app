import { NextResponse, type NextRequest } from "next/server";
import {
  getSeoDemandGapReport,
  type SeoDemandGapStatus,
} from "../../../lib/seo-demand-report";
import { getQueryParam } from "../../../lib/monetization";

const GAP_STATUSES = new Set(["ready", "no_prices", "no_canonical", "no_landing", "all"]);

export async function GET(request: NextRequest) {
  const city = getQueryParam(request, "city") || undefined;
  const status = parseStatus(getQueryParam(request, "status"));
  const limit = clampLimit(getQueryParam(request, "limit"), 100);
  const report = await getSeoDemandGapReport({ city, status, limit });

  return NextResponse.json(report);
}

function parseStatus(value: string): SeoDemandGapStatus | "all" | undefined {
  return GAP_STATUSES.has(value) ? value as SeoDemandGapStatus | "all" : undefined;
}

function clampLimit(value: string, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(250, parsed)) : fallback;
}
