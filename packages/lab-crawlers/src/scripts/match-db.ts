import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
} from '../index.js';

const args = parseArgs(process.argv.slice(2));

if (!args.provider) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers match:db -- --provider dnkom --city "Москва" [--write]');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const result = await repository.autoMatchProviderTestsFromDb({
  providerCode: args.provider,
  cityName: args.city,
  write: args.write,
  limit: args.limit,
});

console.log(JSON.stringify({
  provider: result.provider,
  city: result.city,
  mode: result.mode,
  matched_count: result.matched_count,
  blocked_count: result.blocked_count,
  updated_count: result.updated_count,
  candidates: result.candidates.map((candidate) => ({
    provider_test_id: candidate.provider_test_id,
    provider_test_name: candidate.provider_test_name,
    provider_test_code: candidate.provider_test_code,
    canonical_test: candidate.canonical_test,
    confidence: candidate.confidence,
    provider_test_kind: candidate.provider_test_kind,
    status: candidate.status,
    reason: candidate.reason,
    source_url: candidate.source_url,
  })),
  blocked_candidates: result.blocked_candidates.map((candidate) => ({
    provider_test_id: candidate.provider_test_id,
    provider_test_name: candidate.provider_test_name,
    provider_test_code: candidate.provider_test_code,
    canonical_test: candidate.canonical_test,
    confidence: candidate.confidence,
    provider_test_kind: candidate.provider_test_kind,
    reason: candidate.reason,
    source_url: candidate.source_url,
  })),
}, null, 2));

function parseArgs(values: string[]): {
  provider?: string;
  city?: string;
  write: boolean;
  limit?: number;
} {
  const parsed: {
    provider?: string;
    city?: string;
    write: boolean;
    limit?: number;
  } = {
    write: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--provider') {
      parsed.provider = values[index + 1];
      index += 1;
    } else if (value === '--city') {
      parsed.city = values[index + 1];
      index += 1;
    } else if (value === '--write') {
      parsed.write = true;
    } else if (value === '--dry-run') {
      parsed.write = false;
    } else if (value === '--limit') {
      parsed.limit = Number(values[index + 1]);
      index += 1;
    }
  }

  return parsed;
}
