import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CITY, getComparePageData } from "../../../lib/lab-data";
import { getQueryParam, logMonetizationEvent, jsonError, requireApiKey } from "../../../lib/monetization";

export async function GET(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const test = getQueryParam(request, "test");
  const city = getQueryParam(request, "city", DEFAULT_CITY);
  if (!test) {
    return jsonError("test is required");
  }

  const comparison = await getComparePageData({ test, city });
  const data = comparison.rows[0]?.market_summary ?? null;
  await logMonetizationEvent({
    eventType: "api_request",
    city,
    rawPayload: { endpoint: "/api/v1/market-stats", test },
  });

  return NextResponse.json({ test, city, market_summary: data });
}
