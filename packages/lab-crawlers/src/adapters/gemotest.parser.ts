import type {
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from '../catalog-types.js';
import {
  effectivePriceRub,
  normalizeProviderName,
  toRubles,
  type ScraperContext,
} from '../provider-scraper.js';

export const GEMOTEST_BASE_URL = 'https://gemotest.ru';
export const GEMOTEST_MOSCOW_CATALOG_URL = `${GEMOTEST_BASE_URL}/moskva/catalog/`;
export const GEMOTEST_MOSCOW_CATALOG_SECTION_URLS = [
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-krovi/klinicheskie-issledovaniya/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-krovi/biokhimiya/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-krovi/biokhimiya/uglevodnyy-obmen/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-krovi/biokhimiya/lipidnyy-obmen/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-krovi/biokhimiya/pochki/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-krovi/biokhimiya/obmen-zheleza/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-krovi/gormony/shchitovidnaya-zheleza/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}issledovaniya-mochi/klinicheskie-issledovaniya/`,
  `${GEMOTEST_MOSCOW_CATALOG_URL}chasto-ishchut/aktsii/`,
];

export type GemotestProductCard = {
  externalId?: string;
  externalCode?: string;
  name: string;
  href: string;
  regularPriceRub?: number;
  promoPriceRub?: number;
  effectivePriceRub?: number;
  biomaterialPriceRub?: number;
  biomaterial?: string;
  turnaroundTime?: string;
  category?: string;
  rawText: string;
};

export type GemotestCatalogParseResult = {
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  cardsSeen: number;
  parsedCount: number;
};

export function parseGemotestCatalogHtml(
  html: string,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    maxItems?: number;
    sourceUrl?: string;
  } = {},
): GemotestCatalogParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const cards = parseGemotestProductCards(html, options.sourceUrl ?? GEMOTEST_MOSCOW_CATALOG_URL)
    .slice(0, maxItems);
  const parsed = cards
    .map((card) => mapGemotestCard(card, context, fetchedAt))
    .filter((item): item is { test: ProviderTestRecord; price: ProviderTestPriceRecord } => item !== undefined);

  return {
    tests: parsed.map((item) => item.test),
    prices: parsed.map((item) => item.price),
    cardsSeen: cards.length,
    parsedCount: parsed.length,
  };
}

export function parseGemotestProductCard(rawHtml: string, sourceUrl = GEMOTEST_MOSCOW_CATALOG_URL): GemotestProductCard | undefined {
  const dataName = attr(rawHtml, 'data-name');
  const anchor = rawHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const href = attr(rawHtml, 'data-url') ?? anchor?.[1];
  const name = cleanText(dataName ?? anchor?.[2] ?? matchFirst(rawHtml, /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) ?? '');
  const rawText = cleanText(rawHtml);

  if (!href || !name) {
    return undefined;
  }

  const regularPriceRub = toRubles(attr(rawHtml, 'data-regular-price-rub') ?? findPrimaryPrice(rawText));
  const promoPriceRub = toRubles(attr(rawHtml, 'data-promo-price-rub') ?? findPromoPrice(rawText));
  const biomaterial = cleanText(attr(rawHtml, 'data-biomaterial') ?? matchFirst(rawText, /((?:Вен\.|Капилл\.)\s*кровь|Моча|Кал|Слюна)/i) ?? '');
  const biomaterialPriceRub = toRubles(attr(rawHtml, 'data-biomaterial-price-rub') ?? matchFirst(rawText, /(?:Вен\.|Капилл\.)\s*кровь\s*(?:\(\+)?\s*([0-9\s]+)\s*₽/i) ?? matchFirst(rawText, /Моча\s*([0-9\s]+)\s*₽/i));
  const code = cleanText(attr(rawHtml, 'data-code') ?? matchFirst(rawText, /Код(?:\s+на\s+бланке)?\s*([0-9.]+)/i) ?? '');

  return {
    externalId: code || normalizeGemotestUrl(href, sourceUrl),
    externalCode: code || undefined,
    name,
    href: normalizeGemotestUrl(href, sourceUrl),
    regularPriceRub,
    promoPriceRub,
    effectivePriceRub: effectivePriceRub({ regularPriceRub, promoPriceRub }),
    biomaterialPriceRub,
    biomaterial: biomaterial || undefined,
    turnaroundTime: cleanText(matchFirst(rawText, /(\d+\s*(?:день|дня|дней|час(?:а|ов)?|на месте))/i) ?? '') || undefined,
    category: cleanText(attr(rawHtml, 'data-category') ?? '') || undefined,
    rawText,
  };
}

function parseGemotestProductCards(html: string, sourceUrl: string): GemotestProductCard[] {
  const fixtureCards = [...html.matchAll(/<article\b[^>]*data-gemotest-product\b[^>]*>[\s\S]*?<\/article>/gi)]
    .map((match) => parseGemotestProductCard(match[0], sourceUrl))
    .filter((item): item is GemotestProductCard => item !== undefined);

  if (fixtureCards.length > 0) {
    return dedupeCards(fixtureCards);
  }

  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']*\/catalog\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const cards = anchors
    .map((match, index) => {
      const start = match.index ?? 0;
      const nextStart = anchors[index + 1]?.index ?? html.length;
      const block = html.slice(start, Math.min(nextStart, start + 3_000));
      if (!/₽|руб/i.test(block)) {
        return undefined;
      }

      return parseGemotestProductCard(block, sourceUrl);
    })
    .filter((item): item is GemotestProductCard => item !== undefined);

  return dedupeCards(cards);
}

function mapGemotestCard(
  card: GemotestProductCard,
  context: ScraperContext,
  fetchedAt: string,
): { test: ProviderTestRecord; price: ProviderTestPriceRecord } | undefined {
  if (card.effectivePriceRub === undefined) {
    return undefined;
  }

  const price: ProviderTestPriceRecord = {
    providerCode: 'gemotest',
    regionCode: context.region.code,
    city: context.region.city,
    externalId: card.externalId,
    externalCode: card.externalCode,
    currency: 'RUB',
    regularPriceRub: card.regularPriceRub,
    promoPriceRub: card.promoPriceRub,
    effectivePriceRub: card.effectivePriceRub,
    biomaterialPriceRub: card.biomaterialPriceRub,
    offerType: card.promoPriceRub === undefined ? 'regular' : 'promo',
    sourceUrl: card.href,
    fetchedAt,
    rawPayload: {
      parser: 'gemotest-catalog-card',
      card,
    },
  };

  return {
    test: {
      providerCode: 'gemotest',
      regionCode: context.region.code,
      externalId: card.externalId,
      externalCode: card.externalCode,
      name: card.name,
      normalizedName: normalizeProviderName(card.name),
      kind: 'analysis',
      category: card.category,
      biomaterial: card.biomaterial,
      turnaroundTime: card.turnaroundTime,
      sourceUrl: card.href,
      matchStatus: 'unmatched',
      fetchedAt,
      rawPayload: {
        parser: 'gemotest-catalog-card',
        price,
        card,
      },
    },
    price,
  };
}

function findPrimaryPrice(value: string): string | undefined {
  const prices = [...value.matchAll(/([0-9][0-9\s]*)(?:\s*)₽/g)].map((match) => match[1]);
  return prices[0];
}

function findPromoPrice(value: string): string | undefined {
  return /–|-|−|Суперцена/i.test(value) ? findPrimaryPrice(value) : undefined;
}

function dedupeCards(cards: GemotestProductCard[]): GemotestProductCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.externalCode ?? card.href;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeGemotestUrl(href: string, sourceUrl: string): string {
  return new URL(decodeHtml(href), sourceUrl).toString();
}

function attr(html: string, name: string): string | undefined {
  return html.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))?.[1];
}

function matchFirst(value: string, pattern: RegExp, group = 1): string | undefined {
  return value.match(pattern)?.[group];
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
