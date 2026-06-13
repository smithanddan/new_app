import {
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
} from '../index.js';

const args = parseArgs(process.argv.slice(2));

if (!args.provider || !args.providerTestCode || !args.canonical) {
  throw new Error('Usage: pnpm --filter @labmind/lab-crawlers match:manual -- --provider gemotest --provider-test-code "10.369" --canonical "Ферритин" [--matched-by local-admin] [--write]');
}

const repository = new LabCatalogRepository(createLabCrawlerSupabaseClient());
const result = await repository.manualMatchProviderTest({
  providerCode: args.provider,
  providerTestCode: args.providerTestCode,
  canonicalSearch: args.canonical,
  matchedBy: args.matchedBy,
  write: args.write,
});

console.log(JSON.stringify(result, null, 2));

function parseArgs(values: string[]): {
  provider?: string;
  providerTestCode?: string;
  canonical?: string;
  matchedBy?: string;
  write: boolean;
} {
  const parsed: {
    provider?: string;
    providerTestCode?: string;
    canonical?: string;
    matchedBy?: string;
    write: boolean;
  } = { write: false };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--provider') {
      parsed.provider = values[index + 1];
      index += 1;
    } else if (value === '--provider-test-code') {
      parsed.providerTestCode = values[index + 1];
      index += 1;
    } else if (value === '--canonical') {
      parsed.canonical = values[index + 1];
      index += 1;
    } else if (value === '--matched-by') {
      parsed.matchedBy = values[index + 1];
      index += 1;
    } else if (value === '--write') {
      parsed.write = true;
    } else if (value === '--dry-run') {
      parsed.write = false;
    }
  }

  return parsed;
}
