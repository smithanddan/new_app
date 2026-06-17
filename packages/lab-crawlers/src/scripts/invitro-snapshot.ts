import {
  createProviderAdapter,
  getDefaultInvitroSnapshotPath,
  writeLocalMarketSnapshot,
  type LocalMarketSnapshot,
} from '../index.js';

type Args = {
  city: string;
  output?: string;
};

const args = parseArgs(process.argv.slice(2));
const adapter = createProviderAdapter('invitro');
const context = adapter.buildContext(args.city);
const catalog = await adapter.crawlCatalog(context);
const promotions = await adapter.crawlPromotions(context);

const snapshot: LocalMarketSnapshot = {
  provider: 'invitro',
  region: context.region.code,
  city: context.region.city,
  fetchedAt: catalog.fetchedAt,
  tests: catalog.tests,
  prices: catalog.prices,
  promotions: promotions.promotions,
  promotionItems: promotions.promotionItems,
  rawPayload: {
    catalog: catalog.rawPayload,
    promotions: promotions.rawPayload,
  },
};

const outputPath = args.output ?? getDefaultInvitroSnapshotPath(context.region.code);
writeLocalMarketSnapshot(outputPath, snapshot);

console.log(JSON.stringify({
  provider: snapshot.provider,
  region: snapshot.region,
  city: snapshot.city,
  outputPath,
  catalogItems: snapshot.tests.length,
  prices: snapshot.prices.length,
  promotions: snapshot.promotions.length,
  promotionItems: snapshot.promotionItems.length,
}, null, 2));

function parseArgs(values: string[]): Args {
  const normalized = values.filter((item) => item !== '--');
  const getValue = (name: string) => {
    const index = normalized.indexOf(name);
    return index === -1 ? undefined : normalized[index + 1];
  };

  return {
    city: getValue('--city') ?? 'moscow',
    output: getValue('--output'),
  };
}
