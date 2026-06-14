import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CITY, getRepository } from "../../../lib/lab-data";
import { getMarketSummary } from "@labmind/lab-crawlers/src/product-layer";
import { getQueryParam, logMonetizationEvent, jsonError, requireApiKey } from "../../../lib/monetization";

export async function GET(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const test = getQueryParam(request, "test");
  const city = getQueryParam(request, "city", DEFAULT_CITY);
  if (!test) {
    return jsonError("test is required");
  }

  const data = await getMarketSummary({
    repository: getRepository(),
    city,
    test,
  });
  await logMonetizationEvent({
    eventType: "api_request",
    city,
    rawPayload: { endpoint: "/api/v1/market-stats", test },
  });

  return NextResponse.json({ test, city, market_summary: data });
}
