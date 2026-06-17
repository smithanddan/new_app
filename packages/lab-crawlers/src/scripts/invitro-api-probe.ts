import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  parseInvitroApiCatalogJson,
  parseInvitroApiPromotionsJson,
} from '../adapters/invitro.parser.js';

type ProbeFormat = 'json' | 'table';

type Args = {
  city: string;
  format: ProbeFormat;
  saveFixtures: boolean;
};

type ApiSnapshot = {
  endpoint: string;
  status: number;
  contentType: string | null;
  payload: unknown;
};

const args = parseArgs(process.argv.slice(2));
const report = await probeInvitroApi(args);

if (args.format === 'json') {
  console.log(JSON.stringify(report, null, 2));
} else {
  printTable(report);
}

async function probeInvitroApi(args: Args) {
  const cityId = await resolveCityId(args.city);
  const fetchedAt = new Date().toISOString();
  const snapshots = await fetchSnapshots(cityId);
  if (args.saveFixtures) {
    saveSnapshots(snapshots);
  }

  const context = {
    providerCode: 'invitro',
    fetchedAt,
    region: {
      code: args.city,
      city: args.city === 'moscow' ? 'Москва' : args.city,
      urlPrefix: `/${args.city}`,
      providerCityId: cityId,
    },
  } as const;

  const popular = parseInvitroApiCatalogJson(snapshotPayload(snapshots, 'popular'), context, {
    fetchedAt,
    sourceUrl: `https://www.invitro.ru/golk/tests/api/v1/popular?cityID=${cityId}`,
  });
  const tests = parseInvitroApiCatalogJson(snapshotPayload(snapshots, 'tests-page-1'), context, {
    fetchedAt,
    sourceUrl: `https://www.invitro.ru/golk/tests/api/v1/tests?cityID=${cityId}&limit=25&offset=0`,
  });
  const complexes = parseInvitroApiCatalogJson(snapshotPayload(snapshots, 'complexes-page-1'), context, {
    fetchedAt,
    sourceUrl: `https://www.invitro.ru/golk/tests/api/v1/complexes?cityID=${cityId}&limit=25&offset=0`,
    defaultKind: 'profile',
  });
  const promotions = parseInvitroApiPromotionsJson(snapshotPayload(snapshots, 'promotions-home'), context, {
    fetchedAt,
    sourceUrl: `https://www.invitro.ru/golk/cms/cms-proxy/promotions/filtered?targetPage=home&cityId=${cityId}&depth=3`,
  });

  return {
    provider: 'invitro',
    city: args.city,
    cityId,
    mode: 'api-probe',
    savedFixtures: args.saveFixtures,
    endpoints: snapshots.map((snapshot) => ({
      endpoint: snapshot.endpoint,
      status: snapshot.status,
      contentType: snapshot.contentType,
    })),
    parsed: {
      popular: {
        items: popular.tests.length,
        prices: popular.prices.length,
        firstItems: previewItems(popular.tests, popular.prices),
      },
      testsPage1: {
        items: tests.tests.length,
        prices: tests.prices.length,
        firstItems: previewItems(tests.tests, tests.prices),
      },
      complexesPage1: {
        items: complexes.tests.length,
        prices: complexes.prices.length,
        firstItems: previewItems(complexes.tests, complexes.prices),
      },
      promotions: {
        items: promotions.promotions.length,
        firstItems: promotions.promotions.slice(0, 5).map((promotion) => ({
          title: promotion.title,
          description: promotion.description,
          sourceUrl: promotion.sourceUrl,
        })),
      },
    },
  };
}

async function resolveCityId(city: string): Promise<string> {
  if (city === 'moscow') {
    return 'f1c3c4f0-3426-4cda-8449-e5d326e02f97';
  }
  return city;
}

async function fetchSnapshots(cityId: string): Promise<ApiSnapshot[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('https://www.invitro.ru/analizes', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2_000);

    const endpoints = [
      ['popular', `/golk/tests/api/v1/popular?cityID=${cityId}`],
      ['tests-page-1', `/golk/tests/api/v1/tests?cityID=${cityId}&limit=25&offset=0`],
      ['complexes-page-1', `/golk/tests/api/v1/complexes?cityID=${cityId}&limit=25&offset=0`],
      ['promotions-home', `/golk/cms/cms-proxy/promotions/filtered?targetPage=home&cityId=${cityId}&depth=3`],
    ] as const;

    const snapshots: ApiSnapshot[] = [];
    for (const [name, endpoint] of endpoints) {
      const result = await page.evaluate(async (endpointPath) => {
        const response = await fetch(endpointPath, { headers: { accept: 'application/json' } });
        const text = await response.text();
        const contentType = response.headers.get('content-type');
        return {
          status: response.status,
          contentType,
          text,
        };
      }, endpoint);

      snapshots.push({
        endpoint: name,
        status: result.status,
        contentType: result.contentType,
        payload: parseJson(result.text),
      });
    }

    return snapshots;
  } finally {
    await browser.close();
  }
}

function saveSnapshots(snapshots: ApiSnapshot[]): void {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(__dirname, '../..');
  const fixturesDir = path.join(packageRoot, 'fixtures/invitro');
  fs.mkdirSync(fixturesDir, { recursive: true });

  for (const snapshot of snapshots) {
    const filePath = path.join(fixturesDir, `api-${snapshot.endpoint}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(snapshot.payload, null, 2)}\n`, 'utf8');
  }
}

function snapshotPayload(snapshots: ApiSnapshot[], endpoint: string): unknown {
  return snapshots.find((snapshot) => snapshot.endpoint === endpoint)?.payload;
}

function previewItems(
  tests: Array<{ externalCode?: string; name: string; kind: string; sourceUrl: string }>,
  prices: Array<{ externalCode?: string; regularPriceRub?: number; effectivePriceRub?: number; biomaterialPriceRub?: number }>,
) {
  return tests.slice(0, 5).map((test) => {
    const price = prices.find((item) => item.externalCode === test.externalCode);
    return {
      code: test.externalCode,
      name: test.name,
      kind: test.kind,
      regularPriceRub: price?.regularPriceRub,
      effectivePriceRub: price?.effectivePriceRub,
      biomaterialPriceRub: price?.biomaterialPriceRub,
      sourceUrl: test.sourceUrl,
    };
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value.slice(0, 2000) };
  }
}

function printTable(report: Awaited<ReturnType<typeof probeInvitroApi>>): void {
  console.log(`INVITRO API probe / ${report.city}`);
  console.log(`cityId: ${report.cityId}`);
  console.table(report.endpoints);
  console.log('\nParsed:');
  console.log(JSON.stringify(report.parsed, null, 2));
}

function parseArgs(argv: string[]): Args {
  const normalized = argv.filter((item) => item !== '--');
  const getValue = (name: string) => {
    const index = normalized.indexOf(name);
    return index === -1 ? undefined : normalized[index + 1];
  };

  return {
    city: getValue('--city') ?? 'moscow',
    format: getValue('--format') === 'json' ? 'json' : 'table',
    saveFixtures: !normalized.includes('--no-save-fixtures'),
  };
}
