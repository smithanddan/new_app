import {
  CrawlerRunner,
  LabCatalogRepository,
  createLabCrawlerSupabaseClient,
  type CrawlerRunMode,
} from '../index.js';

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
  provider: 'dnkom',
  region: 'moscow',
  mode,
  command: 'sync:dnkom',
});

console.log(JSON.stringify(report.runs[0], null, 2));
