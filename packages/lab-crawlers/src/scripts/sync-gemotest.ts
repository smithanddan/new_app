import {
  CrawlerRunner,
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  type CrawlerRunMode,
  type ScraperRunSource,
} from '../index.js';

const parsedArgs = parseArgs(process.argv.slice(2));
const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');
const mode: CrawlerRunMode = writeMode ? 'write' : 'dry-run';

if (writeMode && args.has('--dry-run')) {
  throw new Error('Use either --dry-run or --write, not both');
}

const runner = new CrawlerRunner(
  mode === 'write'
    ? new LabCatalogRepository(createLabCrawlerSupabaseClient())
    : undefined,
);
const report = await runner.run({
  provider: 'gemotest',
  region: 'moskva',
  mode,
  runSource: parsedArgs.runSource,
  triggeredBy: process.env.GITHUB_ACTOR,
  workflowRunId: process.env.GITHUB_RUN_ID,
  command: 'sync:gemotest',
});

console.log(JSON.stringify(report.runs[0], null, 2));

function parseArgs(values: string[]): { runSource: ScraperRunSource } {
  const parsed = { runSource: 'manual' as ScraperRunSource };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--run-source') {
      const runSource = values[index + 1];
      if (runSource !== 'manual' && runSource !== 'scheduled' && runSource !== 'backfill' && runSource !== 'ci') {
        throw new Error('--run-source must be manual, scheduled, backfill, or ci');
      }
      parsed.runSource = runSource;
      index += 1;
    }
  }
  return parsed;
}
