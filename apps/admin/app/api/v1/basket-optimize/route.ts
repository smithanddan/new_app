import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_CITY, getBasketPageData } from "../../../lib/lab-data";
import { getQueryParam, logMonetizationEvent, jsonError, requireApiKey } from "../../../lib/monetization";

export async function GET(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const tests = getQueryParam(request, "tests");
  const city = getQueryParam(request, "city", DEFAULT_CITY);
  const lat = getQueryParam(request, "lat");
  const lng = getQueryParam(request, "lng");
  const sort = getQueryParam(request, "sort", "price");
  if (!tests) {
    return jsonError("tests is required");
  }

  const data = await getBasketPageData({ tests, city, mode: "optimization", lat, lng, sort });
  await logMonetizationEvent({
    eventType: "api_request",
    city,
    rawPayload: { endpoint: "/api/v1/basket-optimize", tests, hasGeo: Boolean(lat && lng) },
  });

  return NextResponse.json(data);
}
