import "server-only";

export type DryRunReviewVerdict = "write_ready" | "dry_run_reviewed" | "needs_parser" | "blocked";
export type DryRunReviewNextStep = "write" | "match" | "try_next_provider" | "needs_parser" | "blocked";

export type DryRunReviewRun = {
  provider: string;
  region: string;
  mode: string;
  transport: string;
  catalog_parsed: number;
  prices_parsed: number;
  promotions_parsed: number;
  errors_count: number;
  errors: string[];
  verdict: DryRunReviewVerdict;
  next_step: DryRunReviewNextStep;
  reason: string;
};

export type DryRunReviewResult = {
  ok: boolean;
  verdict: DryRunReviewVerdict;
  next_step: DryRunReviewNextStep;
  reason: string;
  provider: string;
  region: string;
  mode: string;
  totals: {
    catalog_parsed: number;
    prices_parsed: number;
    promotions_parsed: number;
    errors_count: number;
  };
  runs: DryRunReviewRun[];
  warnings: string[];
};

type CrawlerRunReportLike = {
  provider?: unknown;
  region?: unknown;
  mode?: unknown;
  runs?: unknown;
  totals?: unknown;
  errors?: unknown;
};

type CrawlerRunLike = {
  provider?: unknown;
  region?: unknown;
  mode?: unknown;
  transport?: unknown;
  catalogParsed?: unknown;
  pricesParsed?: unknown;
  promotionsParsed?: unknown;
  errorsCount?: unknown;
  errors?: unknown;
};

export function reviewDryRunReport(input: unknown): DryRunReviewResult {
  if (!isObject(input)) {
    return blockedReview("invalid", "unknown", "unknown", "Input is not a crawler JSON object.");
  }

  const report = input as CrawlerRunReportLike;
  const runs = Array.isArray(report.runs) ? report.runs.map(normalizeRun) : [];
  if (runs.length === 0) {
    return blockedReview(stringValue(report.provider, "unknown"), stringValue(report.region, "unknown"), stringValue(report.mode, "unknown"), "Crawler report has no runs array.");
  }

  const totals = {
    catalog_parsed: runs.reduce((total, run) => total + run.catalog_parsed, 0),
    prices_parsed: runs.reduce((total, run) => total + run.prices_parsed, 0),
    promotions_parsed: runs.reduce((total, run) => total + run.promotions_parsed, 0),
    errors_count: runs.reduce((total, run) => total + run.errors_count, 0),
  };
  const warnings = buildWarnings(report, runs);
  const aggregate = aggregateVerdict(runs, warnings);

  return {
    ok: aggregate.verdict !== "blocked",
    verdict: aggregate.verdict,
    next_step: aggregate.next_step,
    reason: aggregate.reason,
    provider: stringValue(report.provider, runs[0]?.provider ?? "unknown"),
    region: stringValue(report.region, runs[0]?.region ?? "unknown"),
    mode: stringValue(report.mode, runs[0]?.mode ?? "unknown"),
    totals,
    runs,
    warnings,
  };
}

function normalizeRun(value: unknown): DryRunReviewRun {
  const run = isObject(value) ? value as CrawlerRunLike : {};
  const provider = stringValue(run.provider, "unknown");
  const region = stringValue(run.region, "unknown");
  const mode = stringValue(run.mode, "unknown");
  const catalogParsed = numberValue(run.catalogParsed);
  const pricesParsed = numberValue(run.pricesParsed);
  const promotionsParsed = numberValue(run.promotionsParsed);
  const errors = Array.isArray(run.errors) ? run.errors.map((error) => String(error)) : [];
  const errorsCount = Math.max(numberValue(run.errorsCount), errors.length);
  const verdict = verdictForRun({ provider, mode, catalogParsed, pricesParsed, errorsCount });

  return {
    provider,
    region,
    mode,
    transport: transportLabel(run.transport),
    catalog_parsed: catalogParsed,
    prices_parsed: pricesParsed,
    promotions_parsed: promotionsParsed,
    errors_count: errorsCount,
    errors,
    verdict: verdict.verdict,
    next_step: verdict.next_step,
    reason: verdict.reason,
  };
}

function verdictForRun(input: {
  provider: string;
  mode: string;
  catalogParsed: number;
  pricesParsed: number;
  errorsCount: number;
}): Pick<DryRunReviewRun, "verdict" | "next_step" | "reason"> {
  if (input.mode === "write") {
    return {
      verdict: "blocked",
      next_step: "blocked",
      reason: "This is a write report. Dry-run review expects --dry-run output.",
    };
  }
  if (input.provider === "kdl") {
    return {
      verdict: "blocked",
      next_step: "blocked",
      reason: "KDL is still probe/scaffold-only; confirm a live endpoint before write.",
    };
  }
  if (input.catalogParsed === 0 && input.pricesParsed === 0) {
    return {
      verdict: "needs_parser",
      next_step: "try_next_provider",
      reason: "Crawler did not parse catalog or prices.",
    };
  }
  if (input.pricesParsed === 0) {
    return {
      verdict: "needs_parser",
      next_step: "needs_parser",
      reason: "Catalog parsed, but no prices were found.",
    };
  }
  if (input.errorsCount > 0) {
    return {
      verdict: "dry_run_reviewed",
      next_step: "match",
      reason: "Prices were parsed, but errors need review before write.",
    };
  }

  return {
    verdict: "write_ready",
    next_step: "write",
    reason: "Dry-run parsed prices without reported errors.",
  };
}

function aggregateVerdict(
  runs: DryRunReviewRun[],
  warnings: string[],
): Pick<DryRunReviewResult, "verdict" | "next_step" | "reason"> {
  if (runs.some((run) => run.verdict === "write_ready")) {
    return {
      verdict: warnings.length > 0 ? "dry_run_reviewed" : "write_ready",
      next_step: warnings.length > 0 ? "match" : "write",
      reason: warnings.length > 0 ? "At least one provider parsed prices, but warnings need review." : "At least one provider is write-ready.",
    };
  }
  if (runs.some((run) => run.verdict === "dry_run_reviewed")) {
    return {
      verdict: "dry_run_reviewed",
      next_step: "match",
      reason: "Parsed prices exist, but errors or warnings need review.",
    };
  }
  if (runs.some((run) => run.verdict === "needs_parser")) {
    return {
      verdict: "needs_parser",
      next_step: "try_next_provider",
      reason: "No write-ready prices found; try another provider or improve parser coverage.",
    };
  }
  return {
    verdict: "blocked",
    next_step: "blocked",
    reason: "No provider run is safe to advance.",
  };
}

function buildWarnings(report: CrawlerRunReportLike, runs: DryRunReviewRun[]): string[] {
  const warnings: string[] = [];
  if (stringValue(report.mode, "") !== "dry-run") {
    warnings.push("Report mode is not dry-run.");
  }
  for (const run of runs) {
    if (run.provider === "helix" || run.provider === "citilab") {
      warnings.push(`${run.provider} is an expansion/mock provider until live ingestion is confirmed.`);
    }
    if (run.provider === "kdl") {
      warnings.push("KDL remains probe/scaffold-only.");
    }
  }
  return [...new Set(warnings)];
}

function blockedReview(provider: string, region: string, mode: string, reason: string): DryRunReviewResult {
  return {
    ok: false,
    verdict: "blocked",
    next_step: "blocked",
    reason,
    provider,
    region,
    mode,
    totals: {
      catalog_parsed: 0,
      prices_parsed: 0,
      promotions_parsed: 0,
      errors_count: 0,
    },
    runs: [],
    warnings: [reason],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function transportLabel(value: unknown): string {
  if (!isObject(value)) {
    return "unknown";
  }
  const mode = stringValue(value.mode, "unknown");
  const fallback = stringValue(value.fallback, "");
  return fallback ? `${mode}+${fallback}` : mode;
}
