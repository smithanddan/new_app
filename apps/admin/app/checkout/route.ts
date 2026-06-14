import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { logMonetizationEvent } from "../lib/monetization";

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("target");
  const safeTargetUrl = getSafeTargetUrl(targetUrl);

  if (!safeTargetUrl) {
    return NextResponse.redirect(new URL("/search", request.url));
  }

  const eventType = request.nextUrl.searchParams.get("event") === "basket_checkout"
    ? "basket_checkout"
    : "affiliate_click";
  const sessionId = request.cookies.get("labprice_session")?.value || randomUUID();

  await logMonetizationEvent({
    eventType,
    providerCode: request.nextUrl.searchParams.get("provider") || undefined,
    canonicalTestId: request.nextUrl.searchParams.get("canonical_test_id") || undefined,
    providerTestId: request.nextUrl.searchParams.get("provider_test_id") || undefined,
    sourceUrl: request.nextUrl.searchParams.get("source") || undefined,
    targetUrl: safeTargetUrl,
    utmSource: request.nextUrl.searchParams.get("utm_source") || undefined,
    utmCampaign: request.nextUrl.searchParams.get("utm_campaign") || undefined,
    sessionId,
    city: request.nextUrl.searchParams.get("city") || undefined,
    rawPayload: {
      test: request.nextUrl.searchParams.get("test"),
      offer: request.nextUrl.searchParams.get("offer"),
      referer: request.headers.get("referer"),
    },
  });

  const response = NextResponse.redirect(safeTargetUrl);
  response.cookies.set("labprice_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

function getSafeTargetUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
