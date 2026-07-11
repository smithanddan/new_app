import {
  DiscoveryRunner,
  buildDiscoveryAdapter,
  type DiscoveryRunMode,
  type NormalizedProviderDiscoveryCandidate,
} from '../provider-discovery.js';
import { createLabCrawlerSupabaseClient } from '../supabase-client.js';
import { LabCatalogRepository, type ScraperRunSource } from '../supabase-lab-catalog.repository.js';

type Args = {
  city: string;
  query: string;
  source: string;
  mode: DiscoveryRunMode;
  runSource: ScraperRunSource;
  limit: number;
  format: 'table' | 'json';
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const adapter = buildDiscoveryAdapter(args.source);
  const repository = shouldUseRepository(args.mode)
    ? new LabCatalogRepository(createLabCrawlerSupabaseClient())
    : undefined;
  const runner = new DiscoveryRunner(repository, adapter);
  const report = await runner.run({
    city: args.city,
    query: args.query,
    mode: args.mode,
    limit: args.limit,
    runSource: args.runSource,
  });

  if (args.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printReport(report);
}

function parseArgs(argv: string[]): Args {
  const values = stripPnpmSeparator(argv);
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      continue;
    }
    const key = value.slice(2);
    if (key === 'dry-run' || key === 'write') {
      args[key] = true;
      continue;
    }
    args[key] = values[index + 1] ?? '';
    index += 1;
  }

  const city = String(args.city || '').trim();
  const query = String(args.query || '').trim();
  if (!city || !query) {
    throw new Error('Usage: discovery:providers -- --city "Москва" --query "сдать анализы" --dry-run');
  }

  const runSource = String(args['run-source'] || 'manual') as ScraperRunSource;
  if (!['manual', 'scheduled', 'backfill', 'ci'].includes(runSource)) {
    throw new Error(`Unsupported --run-source: ${runSource}`);
  }

  const source = String(args.source || 'manual');
  const limit = Number(args.limit || 25);
  return {
    city,
    query,
    source,
    mode: args.write === true ? 'write' : 'dry-run',
    runSource,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 25,
    format: args.format === 'json' ? 'json' : 'table',
  };
}

function stripPnpmSeparator(argv: string[]): string[] {
  return argv[0] === '--' ? argv.slice(1) : argv;
}

function shouldUseRepository(mode: DiscoveryRunMode): boolean {
  if (mode === 'write') {
    return true;
  }
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function printReport(report: Awaited<ReturnType<DiscoveryRunner['run']>>): void {
  console.log(`Provider discovery: ${report.source} / ${report.city}`);
  console.log(`Query: ${report.query}`);
  console.log(`Mode: ${report.mode} | Run source: ${report.run_source} | Run id: ${report.run_id ?? 'dry-run'}`);
  console.log(`Candidates: ${report.candidates_count} | duplicates: ${report.duplicate_count} | needs review: ${report.needs_review_count} | errors: ${report.errors_count}`);
  console.log('');

  const rows = report.candidates.map((candidate) => [
    candidate.name,
    candidate.city,
    candidate.address ?? '',
    candidate.phone ?? '',
    candidate.domain ?? '',
    candidate.sourceType,
    candidate.confidence.toFixed(2),
    candidate.status,
    candidate.suggestedAction,
    candidate.duplicateHint ?? '',
  ]);
  printTable(
    ['candidate', 'city', 'address', 'phone', 'site', 'source', 'conf', 'status', 'action', 'hint'],
    rows,
  );

  if (report.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const error of report.errors) {
      console.log(`- ${error}`);
    }
  }
}

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((header, column) => {
    const maxCell = Math.max(...rows.map((row) => visibleLength(row[column] ?? '')), 0);
    return Math.min(Math.max(visibleLength(header), maxCell), column === 9 ? 42 : 24);
  });
  console.log(formatRow(headers, widths));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) {
    console.log(formatRow(row.map(truncateCell), widths));
  }
}

function formatRow(row: string[], widths: number[]): string {
  return row.map((cell, index) => padCell(cell, widths[index])).join('  ');
}

function padCell(value: string, width: number): string {
  const length = visibleLength(value);
  return length >= width ? value : `${value}${' '.repeat(width - length)}`;
}

function truncateCell(value: string): string {
  return value.length > 44 ? `${value.slice(0, 41)}...` : value;
}

function visibleLength(value: string): number {
  return [...value].length;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
