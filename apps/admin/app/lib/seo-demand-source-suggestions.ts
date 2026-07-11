import "server-only";

export type SeoDemandSourceStrategy = "targeted_search" | "catalog_crawl" | "probe" | "fixture";
export type SeoDemandSourceStatus = "ready" | "available" | "probe_pending" | "mock_only";

export type SeoDemandSourceSuggestion = {
  canonical_test_code: string;
  provider: string;
  region: string;
  strategy: SeoDemandSourceStrategy;
  status: SeoDemandSourceStatus;
  confidence: number;
  reason: string;
  dry_run_command: string;
  fixture_only_command?: string;
  env?: Record<string, string>;
};

const CMD_KARYOTYPE_SEARCH_URL = "https://www.cmd-online.ru/search/?q=%D0%BA%D0%B0%D1%80%D0%B8%D0%BE%D1%82%D0%B8%D0%BF&type=analyzes&action=popup";
const COMMON_LAB_TEST_CODES = new Set(["FER", "TSH", "GLU", "CBC", "UA", "VITD", "CREA", "CHOL"]);

export function getSeoDemandSourceSuggestions(input: {
  canonicalTestCode: string;
  city?: string;
  limit?: number;
}): SeoDemandSourceSuggestion[] {
  const code = input.canonicalTestCode.toUpperCase();
  const suggestions = buildSuggestionsForCode(code);
  return suggestions
    .sort((a, b) => b.confidence - a.confidence || providerRank(a.provider) - providerRank(b.provider))
    .slice(0, input.limit ?? 20);
}

function buildSuggestionsForCode(code: string): SeoDemandSourceSuggestion[] {
  if (code === "KARYOTYPE") {
    return [
      buildSuggestion(code, "cmd", "msk", "targeted_search", "ready", 1, "CMD search endpoint returns external_code 190204 for karyotype.", {
        CMD_SEARCH_URLS: CMD_KARYOTYPE_SEARCH_URL,
      }),
    ];
  }

  if (code === "BIOCHEM") {
    return [
      buildSuggestion(code, "dnkom", "moscow", "catalog_crawl", "available", 0.78, "DNKOM has a known biochemistry source/promo fixture and should be checked first."),
      buildSuggestion(code, "cmd", "msk", "catalog_crawl", "available", 0.68, "CMD catalog/search layer can be used to probe biochemistry prices."),
      buildSuggestion(code, "gemotest", "moskva", "catalog_crawl", "available", 0.64, "Gemotest catalog crawl is already integrated for Moscow."),
      buildSuggestion(code, "invitro", "moscow", "catalog_crawl", "available", 0.62, "INVITRO API crawler is already integrated for Moscow."),
      buildSuggestion(code, "kdl", "msk", "probe", "probe_pending", 0.42, "KDL is a scaffold/probe provider until a live endpoint is confirmed."),
    ];
  }

  if (COMMON_LAB_TEST_CODES.has(code)) {
    return [
      buildSuggestion(code, "cmd", "msk", "catalog_crawl", "available", 0.72, "CMD is a major Moscow lab source with live catalog/search scaffolding."),
      buildSuggestion(code, "gemotest", "moskva", "catalog_crawl", "available", 0.68, "Gemotest catalog crawl is already integrated for Moscow."),
      buildSuggestion(code, "invitro", "moscow", "catalog_crawl", "available", 0.66, "INVITRO API crawler is already integrated for Moscow."),
      buildSuggestion(code, "kdl", "msk", "probe", "probe_pending", 0.44, "KDL is planned next, but remains probe/scaffold only in this increment."),
    ];
  }

  return [];
}

function buildSuggestion(
  canonicalTestCode: string,
  provider: string,
  region: string,
  strategy: SeoDemandSourceStrategy,
  status: SeoDemandSourceStatus,
  confidence: number,
  reason: string,
  env?: Record<string, string>,
): SeoDemandSourceSuggestion {
  const envPrefix = env ? `${Object.entries(env).map(([key, value]) => `${key}=${shellQuote(value)}`).join(" ")} ` : "";
  const dryRunCommand = `${envPrefix}pnpm --filter @labmind/lab-crawlers crawler:run -- --provider ${provider} --region ${region} --dry-run`;
  const fixtureEnv = fixtureEnvForProvider(provider);
  const fixtureOnlyCommand = fixtureEnv
    ? `${fixtureEnv}=1 pnpm --filter @labmind/lab-crawlers crawler:run -- --provider ${provider} --region ${region} --dry-run`
    : undefined;

  return {
    canonical_test_code: canonicalTestCode,
    provider,
    region,
    strategy,
    status,
    confidence,
    reason,
    dry_run_command: dryRunCommand,
    fixture_only_command: fixtureOnlyCommand,
    env,
  };
}

function fixtureEnvForProvider(provider: string): string | undefined {
  if (provider === "cmd") {
    return "CMD_FIXTURE_ONLY";
  }
  if (provider === "dnkom") {
    return "DNKOM_FIXTURE_ONLY";
  }
  if (provider === "gemotest") {
    return "GEMOTEST_FIXTURE_ONLY";
  }
  if (provider === "invitro") {
    return "INVITRO_FIXTURE_ONLY";
  }
  return undefined;
}

function providerRank(provider: string): number {
  return ["cmd", "dnkom", "gemotest", "invitro", "kdl"].indexOf(provider);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
