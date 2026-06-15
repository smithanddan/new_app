import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CITY, getComparePageData } from "../../../lib/lab-data";
import { getQueryParam, logMonetizationEvent, jsonError, requireApiKey } from "../../../lib/monetization";

export async function GET(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const test = getQueryParam(request, "test");
  const city = getQueryParam(request, "city", DEFAULT_CITY);
  const lat = getQueryParam(request, "lat");
  const lng = getQueryParam(request, "lng");
  const sort = getQueryParam(request, "sort", "price");
  if (!test) {
    return jsonError("test is required");
  }

  const data = await getComparePageData({ test, city, lat, lng, sort });
  await logMonetizationEvent({
    eventType: "api_request",
    city,
    rawPayload: { endpoint: "/api/v1/compare", test, hasGeo: Boolean(lat && lng) },
  });

  return NextResponse.json(data);
}
