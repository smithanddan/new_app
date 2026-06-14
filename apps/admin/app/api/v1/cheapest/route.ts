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

  const data = await getComparePageData({ test, city });
  const row = data.rows[0];
  const cheapest = row?.offers[0] ?? null;
  await logMonetizationEvent({
    eventType: "api_request",
    city,
    rawPayload: { endpoint: "/api/v1/cheapest", test },
  });

  return NextResponse.json({
    test,
    city,
    canonical_test: row?.canonical_test ?? null,
    cheapest,
    error: row?.error,
  });
}
