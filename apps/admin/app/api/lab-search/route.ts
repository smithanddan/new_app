import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLabSearchPageData } from "../../lib/lab-data";
import { getQueryParam } from "../../lib/monetization";

export async function GET(request: NextRequest) {
  const result = await getLabSearchPageData({
    q: getQueryParam(request, "q"),
    city: getQueryParam(request, "city"),
    limit: getQueryParam(request, "limit"),
  });

  return NextResponse.json(result);
}
