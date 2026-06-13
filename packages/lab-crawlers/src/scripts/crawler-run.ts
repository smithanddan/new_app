import {
  CrawlerRunner,
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  type CrawlerRunMode,
  type CrawlerRunProviderInput,
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
  command: 'crawler:run',
});

console.log(JSON.stringify(report, null, 2));

function parseArgs(values: string[]): {
  provider: CrawlerRunProviderInput;
  region: string;
  mode: CrawlerRunMode;
  withRepository: boolean;
} {
  const parsed: {
    provider?: CrawlerRunProviderInput;
    region?: string;
    mode: CrawlerRunMode;
    withRepository: boolean;
  } = {
    mode: 'dry-run',
    withRepository: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--provider') {
      const provider = values[index + 1];
      if (provider !== 'dnkom' && provider !== 'gemotest' && provider !== 'all') {
        throw new Error('--provider must be dnkom, gemotest, or all');
      }
      parsed.provider = provider;
      index += 1;
    } else if (value === '--region') {
      parsed.region = values[index + 1];
      index += 1;
    } else if (value === '--dry-run') {
      parsed.mode = 'dry-run';
    } else if (value === '--write') {
      parsed.mode = 'write';
      parsed.withRepository = true;
    }
  }

  if (!parsed.provider || !parsed.region) {
    throw new Error('Usage: pnpm --filter @labmind/lab-crawlers crawler:run -- --provider dnkom|gemotest|all --region moscow|moskva|Москва [--dry-run|--write]');
  }

  if (values.includes('--write') && values.includes('--dry-run')) {
    throw new Error('Use either --dry-run or --write, not both');
  }

  return {
    provider: parsed.provider,
    region: parsed.region,
    mode: parsed.mode,
    withRepository: parsed.withRepository,
  };
}
