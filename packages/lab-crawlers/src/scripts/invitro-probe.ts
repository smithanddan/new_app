import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type ProbeFormat = 'table' | 'json';
type BlockingLevel = 'low' | 'medium' | 'high';
type RecommendedStrategy = 'http' | 'playwright' | 'hybrid';

type PageProbe = {
  url: string;
  status: number | null;
  transport: 'http' | 'playwright';
  blockingSignals: string[];
  selectorCandidates: string[];
  structureNotes: string[];
  htmlBytes: number;
  fixturePath?: string;
  error?: string;
};

type InvitroProbeReport = {
  provider: 'invitro';
  city: string;
  checkedAt: string;
  blockingLevel: BlockingLevel;
  recommendedStrategy: RecommendedStrategy;
  regionBehavior: string[];
  catalogStructureMap: PageProbe[];
  promoStructureMap: PageProbe[];
};

export {};

const htmlSnapshot = Symbol('htmlSnapshot');

const args = parseArgs(process.argv.slice(2));
const report = await probeInvitro(args.city, { saveFixtures: args.saveFixtures });

if (args.format === 'json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

async function probeInvitro(city: string, options: { saveFixtures: boolean }): Promise<InvitroProbeReport> {
  const baseUrl = 'https://www.invitro.ru';
  const pages = [
    `${baseUrl}/analizes/for-doctors/`,
    `${baseUrl}/analizes`,
    `${baseUrl}/${city}/ak/`,
  ];
  const probes = [];

  for (const url of pages) {
    probes.push(await probePage(url, options));
  }

  const blockingLevel = resolveBlockingLevel(probes);
  const recommendedStrategy = blockingLevel === 'high' ? 'playwright' : blockingLevel === 'medium' ? 'hybrid' : 'http';

  return {
    provider: 'invitro',
    city,
    checkedAt: new Date().toISOString(),
    blockingLevel,
    recommendedStrategy,
    regionBehavior: [
      `City is represented in URL path for promo pages: /${city}/ak/`,
      'Catalog pages are also available without explicit city path; prices may require city-aware session validation before ingestion.',
      'No Supabase writes or ingestion performed by this probe.',
    ],
    catalogStructureMap: probes.filter((probe) => probe.url.includes('/analizes')),
    promoStructureMap: probes.filter((probe) => probe.url.includes('/ak/')),
  };
}

async function probePage(url: string, options: { saveFixtures: boolean }): Promise<PageProbe> {
  const httpProbe = await probePageWithHttp(url);
  if (httpProbe.status && httpProbe.status < 400 && httpProbe.blockingSignals.length === 0 && !isSpaShellProbe(httpProbe)) {
    return options.saveFixtures ? saveProbeFixture(httpProbe) : httpProbe;
  }

  const playwrightProbe = await probePageWithPlaywright(url);
  const mergedProbe = {
    ...playwrightProbe,
    blockingSignals: [...new Set([...httpProbe.blockingSignals, ...playwrightProbe.blockingSignals])],
    error: playwrightProbe.error ?? httpProbe.error,
  };
  const snapshot = (playwrightProbe as PageProbe & { [htmlSnapshot]?: string })[htmlSnapshot]
    ?? (httpProbe as PageProbe & { [htmlSnapshot]?: string })[htmlSnapshot];
  if (snapshot) {
    Object.defineProperty(mergedProbe, htmlSnapshot, {
      value: snapshot,
      enumerable: false,
    });
  }
  return options.saveFixtures ? saveProbeFixture(mergedProbe) : mergedProbe;
}

async function probePageWithHttp(url: string): Promise<PageProbe> {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 lab-crawlers-invitro-probe/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = await response.text();
    return buildPageProbe(url, response.status, html, 'http');
  } catch (error) {
    return {
      url,
      status: null,
      transport: 'http',
      blockingSignals: ['http_error'],
      selectorCandidates: [],
      structureNotes: [],
      htmlBytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probePageWithPlaywright(url: string): Promise<PageProbe> {
  let browser: Awaited<ReturnType<typeof import('playwright')['chromium']['launch']>> | undefined;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500);
    const html = await page.content();
    return buildPageProbe(url, response?.status() ?? null, html, 'playwright');
  } catch (error) {
    return {
      url,
      status: null,
      transport: 'playwright',
      blockingSignals: ['playwright_error'],
      selectorCandidates: [],
      structureNotes: [],
      htmlBytes: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await browser?.close();
  }
}

function buildPageProbe(url: string, status: number | null, html: string, transport: PageProbe['transport']): PageProbe {
  const probe: PageProbe = {
    url,
    status,
    transport,
    blockingSignals: detectBlockingSignals(status, html),
    selectorCandidates: detectSelectorCandidates(html),
    structureNotes: detectStructureNotes(url, html),
    htmlBytes: Buffer.byteLength(html, 'utf8'),
  };
  Object.defineProperty(probe, htmlSnapshot, {
    value: html,
    enumerable: false,
  });
  return probe;
}

function detectBlockingSignals(status: number | null, html: string): string[] {
  const signals = [];
  const lower = html.toLocaleLowerCase('ru-RU');
  if (status === 403) signals.push('403');
  if (status === 429) signals.push('429');
  if (/ddos|captcha|cloudflare|access denied|anti[- ]?bot|bot protection|проверка.+бот|защит[аы] от бот/i.test(lower)) {
    signals.push('anti_bot_text');
  }
  if (/checking your browser|проверка браузера/i.test(lower)) signals.push('browser_check');
  if (isSpaShellHtml(html)) signals.push('spa_shell');
  if (/gmonit\.js|csrf-token-name|hmac-token-name/i.test(html) && !/(₽|руб|акци|анализ|catalog|price)/i.test(html)) {
    signals.push('gmonit_shell');
  }
  return signals;
}

function detectSelectorCandidates(html: string): string[] {
  const candidates = [
    ['catalog cards', /class=["'][^"']*(?:analyzes|analysis|catalog|result)[^"']*["']/i],
    ['price nodes', /(?:price|стоимост|₽|руб)/i],
    ['promo cards', /(?:акци|discount|promo|sale)/i],
    ['links to analyses', /href=["'][^"']*\/analizes\/[^"']*["']/i],
    ['json data', /<script[^>]+type=["']application\/ld\+json["']/i],
    ['spa root', /<div[^>]+id=["']root["'][^>]*>/i],
    ['frontend assets', /\/assets\/index-[^"']+\.js/i],
  ];

  return candidates
    .filter(([, pattern]) => (pattern as RegExp).test(html))
    .map(([label]) => label as string);
}

function detectStructureNotes(url: string, html: string): string[] {
  const notes = [];
  if (url.includes('/ak/')) {
    notes.push('promo page candidate');
  }
  if (url.includes('/analizes')) {
    notes.push('catalog page candidate');
  }
  if (/data-[a-z-]+=/i.test(html)) {
    notes.push('contains data-* attributes');
  }
  if (/\/local\/|bitrix|BX\./i.test(html)) {
    notes.push('Bitrix-like frontend signals');
  }
  if (isSpaShellHtml(html)) {
    notes.push('SPA shell; rendered catalog likely requires frontend API/runtime');
  }
  if (/\/assets\/index-[^"']+\.js/i.test(html)) {
    notes.push('contains bundled frontend asset');
  }
  if (Buffer.byteLength(html, 'utf8') < 10_000) {
    notes.push('small html body; likely shell, not catalog content');
  }
  return notes;
}

function resolveBlockingLevel(probes: PageProbe[]): BlockingLevel {
  const signals = probes.flatMap((probe) => probe.blockingSignals);
  if (signals.some((signal) => signal === '403' || signal === '429' || signal === 'browser_check')) {
    return 'high';
  }
  if (signals.some((signal) => signal === 'spa_shell' || signal === 'gmonit_shell')) {
    return 'medium';
  }
  if (signals.length > 0) {
    return 'medium';
  }
  return 'low';
}

function printReport(report: InvitroProbeReport) {
  console.log(`INVITRO probe / ${report.city}`);
  printRows([
    {
      'Blocking': report.blockingLevel,
      'Strategy': report.recommendedStrategy,
      'Checked at': report.checkedAt,
    },
  ]);

  console.log('\nCatalog structure map:');
  printPageProbes(report.catalogStructureMap);

  console.log('\nPromo structure map:');
  printPageProbes(report.promoStructureMap);

  console.log('\nRegion behavior:');
  for (const note of report.regionBehavior) {
    console.log(`- ${note}`);
  }
}

function printPageProbes(probes: PageProbe[]) {
  printRows(probes.map((probe) => ({
    'URL': probe.url,
    'Status': probe.status === null ? '-' : String(probe.status),
    'Transport': probe.transport,
    'Blocking': probe.blockingSignals.join(', ') || '-',
    'Selectors': probe.selectorCandidates.join(', ') || '-',
    'Bytes': String(probe.htmlBytes),
    'Fixture': probe.fixturePath ?? '-',
    'Notes': probe.structureNotes.join(', ') || '-',
  })));
}

function printRows(rows: Array<Record<string, string>>) {
  if (rows.length === 0) {
    console.log('Нет данных');
    return;
  }

  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) => Math.max(
    header.length,
    ...rows.map((row) => row[header].length),
  ));
  const separator = widths.map((width) => '-'.repeat(width)).join('  ');

  console.log(headers.map((header, index) => header.padEnd(widths[index])).join('  '));
  console.log(separator);
  for (const row of rows) {
    console.log(headers.map((header, index) => row[header].padEnd(widths[index])).join('  '));
  }
}

function parseArgs(values: string[]): { city: string; format: ProbeFormat; saveFixtures: boolean } {
  const parsed = {
    city: 'moscow',
    format: 'table' as ProbeFormat,
    saveFixtures: true,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--city') {
      parsed.city = values[index + 1];
      index += 1;
    } else if (value === '--format') {
      const format = values[index + 1];
      if (format !== 'table' && format !== 'json') {
        throw new Error('--format must be either table or json');
      }
      parsed.format = format;
      index += 1;
    } else if (value === '--no-save-fixtures') {
      parsed.saveFixtures = false;
    }
  }

  return parsed;
}

function isSpaShellProbe(probe: PageProbe): boolean {
  return probe.blockingSignals.includes('spa_shell') || probe.blockingSignals.includes('gmonit_shell');
}

function isSpaShellHtml(html: string): boolean {
  return /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i.test(html)
    && /\/assets\/index-[^"']+\.js/i.test(html);
}

function saveProbeFixture(probe: PageProbe): PageProbe {
  if (probe.htmlBytes === 0) {
    return probe;
  }

  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const fixturesDir = path.join(packageRoot, 'fixtures/invitro');
  fs.mkdirSync(fixturesDir, { recursive: true });

  const fileName = `${probe.transport}-${new URL(probe.url).pathname
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9а-яё]+/giu, '-')
    .replace(/^-+|-+$/g, '') || 'root'}.html`;
  const fixturePath = path.join(fixturesDir, fileName);
  const html = (probe as PageProbe & { [htmlSnapshot]?: string })[htmlSnapshot];
  if (!html) {
    return probe;
  }
  fs.writeFileSync(fixturePath, `${probeHtmlComment(probe)}${html}`, 'utf8');

  return {
    ...probe,
    fixturePath: path.relative(packageRoot, fixturePath),
  };
}

function probeHtmlComment(probe: PageProbe): string {
  return [
    '<!--',
    `INVITRO probe fixture`,
    `url: ${probe.url}`,
    `transport: ${probe.transport}`,
    `saved_at: ${new Date().toISOString()}`,
    `blocking: ${probe.blockingSignals.join(', ') || '-'}`,
    '-->',
    '',
  ].join('\n');
}
