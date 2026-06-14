import { NextResponse, type NextRequest } from "next/server";
import { logMonetizationEvent } from "../../../lib/monetization";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());

  await logMonetizationEvent({
    eventType: "lead_request",
    utmSource: asString(payload.source) || "pricing_page",
    utmCampaign: asString(payload.plan) || "api_access",
    rawPayload: {
      email: asString(payload.email),
      company: asString(payload.company),
      plan: asString(payload.plan),
      use_case: asString(payload.use_case),
      referer: request.headers.get("referer"),
    },
  });

  const accept = request.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/pricing?lead=sent", request.url), 303);
  }

  return NextResponse.json({ ok: true });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
