import { NextResponse, type NextRequest } from "next/server";
import { reviewDryRunReport } from "../../../lib/seo-dry-run-review";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const report = isObject(payload) && "report" in payload ? payload.report : payload;
    return NextResponse.json(reviewDryRunReport(report));
  } catch (error) {
    return NextResponse.json(
      reviewDryRunReport({
        provider: "invalid",
        region: "unknown",
        mode: "unknown",
        runs: [],
        errors: [error instanceof Error ? error.message : String(error)],
      }),
      { status: 400 },
    );
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
