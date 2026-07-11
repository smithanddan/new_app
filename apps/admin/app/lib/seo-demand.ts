import "server-only";

import fs from "node:fs";
import path from "node:path";

export type SeoDemandIntent = "price_compare" | "test_info" | "nearby" | "basket";

export type SeoDemandKeyword = {
  query: string;
  region: string;
  monthly_impressions?: number;
  source: string;
  source_fetched_at: string;
  intent: SeoDemandIntent;
  canonical_test_code: string;
  landing_slug: string;
  priority: number;
};

let cachedKeywords: SeoDemandKeyword[] | undefined;

export function getSeoDemandKeywordsSafe(): SeoDemandKeyword[] {
  try {
    cachedKeywords ??= readSeoDemandKeywords();
    return cachedKeywords;
  } catch (error) {
    console.warn("SEO demand seed failed to load", error);
    return [];
  }
}

export function getTopSeoDemandKeywords(limit = 20): SeoDemandKeyword[] {
  return getSeoDemandKeywordsSafe().slice(0, limit);
}

export function getSeoDemandByCanonical(code: string, limit = 5): SeoDemandKeyword[] {
  return getSeoDemandKeywordsSafe()
    .filter((keyword) => keyword.canonical_test_code === code)
    .slice(0, limit);
}

export function getSeoDemandByLandingSlug(slug: string, limit = 5): SeoDemandKeyword[] {
  return getSeoDemandKeywordsSafe()
    .filter((keyword) => keyword.landing_slug === slug)
    .slice(0, limit);
}

export function getSeoDemandLandingSlugs(): string[] {
  return [...new Set(getSeoDemandKeywordsSafe().map((keyword) => keyword.landing_slug))];
}

function readSeoDemandKeywords(): SeoDemandKeyword[] {
  const filePath = resolveDemandSeedPath();
  const csv = fs.readFileSync(filePath, "utf8");
  const [headerLine, ...lines] = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(headerLine);

  return lines
    .map((line) => parseDemandRow(headers, parseCsvLine(line)))
    .filter((row): row is SeoDemandKeyword => row !== undefined)
    .sort((a, b) => b.priority - a.priority || a.query.localeCompare(b.query, "ru"));
}

function parseDemandRow(headers: string[], values: string[]): SeoDemandKeyword | undefined {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  if (!row.query || !row.region || !row.intent || !row.canonical_test_code || !row.landing_slug) {
    return undefined;
  }

  return {
    query: row.query,
    region: row.region,
    monthly_impressions: parseOptionalNumber(row.monthly_impressions),
    source: row.source || "manual_seed",
    source_fetched_at: row.source_fetched_at,
    intent: parseIntent(row.intent),
    canonical_test_code: row.canonical_test_code,
    landing_slug: row.landing_slug,
    priority: parseOptionalNumber(row.priority) ?? 0,
  };
}

function resolveDemandSeedPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "data/seo/seed-lab-keywords.csv"),
    path.resolve(process.cwd(), "../../data/seo/seed-lab-keywords.csv"),
    path.resolve(process.cwd(), "../../../data/seo/seed-lab-keywords.csv"),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`SEO demand seed not found. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseIntent(value: string): SeoDemandIntent {
  if (value === "test_info" || value === "nearby" || value === "basket") {
    return value;
  }
  return "price_compare";
}
