import {
  CrawlerRunner,
  CRAWLER_PROVIDER_KEYS,
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  type CrawlerProviderKey,
  type CrawlerRunMode,
  type CrawlerRunProviderInput,
  type ScraperRunSource,
} from '../index.js';

const args = parseArgs(process.argv.slice(2));

if (args.mode === 'write' && !args.withRepository) {
  throw new Error('Internal argument parsing error: write mode requires repository');
}

const runner = new CrawlerRunner(
  args.mode === 'write'
    ? new LabCatalogRepository(createLabCrawlerSupabaseClient())
    : undefined,
);
const report = await runner.run({
  provider: args.provider,
  region: args.region,
  mode: args.mode,
  runSource: args.runSource,
  triggeredBy: process.env.GITHUB_ACTOR,
  workflowRunId: process.env.GITHUB_RUN_ID,
  command: 'crawler:run',
});

console.log(JSON.stringify(report, null, 2));

function parseArgs(values: string[]): {
  provider: CrawlerRunProviderInput;
  region: string;
  mode: CrawlerRunMode;
  runSource: ScraperRunSource;
  withRepository: boolean;
} {
  const parsed: {
    provider?: CrawlerRunProviderInput;
    region?: string;
    mode: CrawlerRunMode;
    runSource: ScraperRunSource;
    withRepository: boolean;
  } = {
    mode: 'dry-run',
    runSource: 'manual',
    withRepository: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--provider') {
      const provider = values[index + 1];
      if (provider !== 'all' && !CRAWLER_PROVIDER_KEYS.includes(provider as CrawlerProviderKey)) {
        throw new Error(`--provider must be one of: ${CRAWLER_PROVIDER_KEYS.join(', ')}, all`);
      }
      parsed.provider = provider === 'all' ? 'all' : provider as CrawlerProviderKey;
      index += 1;
    } else if (value === '--region') {
      parsed.region = values[index + 1];
      index += 1;
    } else if (value === '--dry-run') {
      parsed.mode = 'dry-run';
    } else if (value === '--write') {
      parsed.mode = 'write';
      parsed.withRepository = true;
    } else if (value === '--run-source') {
      const runSource = values[index + 1];
      if (runSource !== 'manual' && runSource !== 'scheduled' && runSource !== 'backfill' && runSource !== 'ci') {
        throw new Error('--run-source must be manual, scheduled, backfill, or ci');
      }
      parsed.runSource = runSource;
      index += 1;
    }
  }

  if (!parsed.provider || !parsed.region) {
    throw new Error(`Usage: pnpm --filter @labmind/lab-crawlers crawler:run -- --provider ${CRAWLER_PROVIDER_KEYS.join('|')}|all --region moscow|moskva|msk|Москва [--dry-run|--write]`);
  }

  if (values.includes('--write') && values.includes('--dry-run')) {
    throw new Error('Use either --dry-run or --write, not both');
  }

  return {
    provider: parsed.provider,
    region: parsed.region,
    mode: parsed.mode,
    runSource: parsed.runSource,
    withRepository: parsed.withRepository,
  };
}
