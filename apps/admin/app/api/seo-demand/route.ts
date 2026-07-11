import { NextResponse, type NextRequest } from "next/server";
import {
  getSeoDemandByCanonical,
  getSeoDemandByLandingSlug,
  getTopSeoDemandKeywords,
} from "../../lib/seo-demand";
import { getQueryParam } from "../../lib/monetization";

export async function GET(request: NextRequest) {
  const code = getQueryParam(request, "code").toUpperCase();
  const slug = getQueryParam(request, "slug");
  const limit = clampLimit(getQueryParam(request, "limit"), 20);
  const keywords = code
    ? getSeoDemandByCanonical(code, limit)
    : slug
      ? getSeoDemandByLandingSlug(slug, limit)
      : getTopSeoDemandKeywords(limit);

  return NextResponse.json({
    source: "seed-lab-keywords",
    count: keywords.length,
    keywords,
  });
}

function clampLimit(value: string, fallback: number): number {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, parsed)) : fallback;
}
