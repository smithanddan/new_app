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

const args = parseArgs(process.argv.slice(2));
const report = await probeInvitro(args.city);

if (args.format === 'json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

async function probeInvitro(city: string): Promise<InvitroProbeReport> {
  const baseUrl = 'https://www.invitro.ru';
  const pages = [
    `${baseUrl}/analizes/for-doctors/`,
    `${baseUrl}/analizes`,
    `${baseUrl}/${city}/ak/`,
  ];
  const probes = [];

  for (const url of pages) {
    probes.push(await probePage(url));
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

async function probePage(url: string): Promise<PageProbe> {
  const httpProbe = await probePageWithHttp(url);
  if (httpProbe.status && httpProbe.status < 400 && httpProbe.blockingSignals.length === 0) {
    return httpProbe;
  }

  const playwrightProbe = await probePageWithPlaywright(url);
  return {
    ...playwrightProbe,
    blockingSignals: [...new Set([...httpProbe.blockingSignals, ...playwrightProbe.blockingSignals])],
    error: playwrightProbe.error ?? httpProbe.error,
  };
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
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await browser?.close();
  }
}

function buildPageProbe(url: string, status: number | null, html: string, transport: PageProbe['transport']): PageProbe {
  return {
    url,
    status,
    transport,
    blockingSignals: detectBlockingSignals(status, html),
    selectorCandidates: detectSelectorCandidates(html),
    structureNotes: detectStructureNotes(url, html),
  };
}

function detectBlockingSignals(status: number | null, html: string): string[] {
  const signals = [];
  const lower = html.toLocaleLowerCase('ru-RU');
  if (status === 403) signals.push('403');
  if (status === 429) signals.push('429');
  if (/ddos|captcha|cloudflare|access denied|bot/i.test(lower)) signals.push('anti_bot_text');
  if (/checking your browser|проверка браузера/i.test(lower)) signals.push('browser_check');
  return signals;
}

function detectSelectorCandidates(html: string): string[] {
  const candidates = [
    ['catalog cards', /class=["'][^"']*(?:analyzes|analysis|catalog|result)[^"']*["']/i],
    ['price nodes', /(?:price|стоимост|₽|руб)/i],
    ['promo cards', /(?:акци|discount|promo|sale)/i],
    ['links to analyses', /href=["'][^"']*\/analizes\/[^"']*["']/i],
    ['json data', /<script[^>]+type=["']application\/ld\+json["']/i],
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
  return notes;
}

function resolveBlockingLevel(probes: PageProbe[]): BlockingLevel {
  const signals = probes.flatMap((probe) => probe.blockingSignals);
  if (signals.some((signal) => signal === '403' || signal === '429' || signal === 'browser_check')) {
    return 'high';
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

function parseArgs(values: string[]): { city: string; format: ProbeFormat } {
  const parsed = {
    city: 'moscow',
    format: 'table' as ProbeFormat,
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
    }
  }

  return parsed;
}
