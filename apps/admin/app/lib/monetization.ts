import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "./lab-data";
import type { MonetizationEventInput } from "@labmind/lab-crawlers/src/supabase-lab-catalog.repository";

export function requireApiKey(request: NextRequest): NextResponse | null {
  const configuredKeys = parseApiKeys(process.env.LABPRICE_API_KEYS);
  if (configuredKeys.length === 0) {
    return null;
  }

  const providedKey = request.headers.get("x-api-key") || "";
  if (configuredKeys.includes(providedKey)) {
    return null;
  }

  return NextResponse.json(
    { error: "unauthorized", message: "Missing or invalid x-api-key" },
    { status: 401 },
  );
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function logMonetizationEvent(input: MonetizationEventInput): Promise<void> {
  try {
    await getRepository().logMonetizationEvent(input);
  } catch (error) {
    console.error("monetization event logging failed", error);
  }
}

export function getQueryParam(request: NextRequest, key: string, fallback?: string): string {
  return request.nextUrl.searchParams.get(key) || fallback || "";
}

function parseApiKeys(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}
