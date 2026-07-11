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

export const CMD_BASE_URL = 'https://www.cmd-online.ru';
export const CMD_MOSCOW_CATALOG_URL = `${CMD_BASE_URL}/analizy-i-tseny/katalog-analizov/msk/`;
export const CMD_KARYOTYPE_SEARCH_TERMS = [
  'кариотип',
  'кариотипирование',
  'цитогенетическое',
  'хромосомный анализ',
];

const KARYOTYPE_PATTERNS = [
  /кариотип/i,
  /кариотипирован/i,
  /цитогенетическ/i,
  /хромосомн(?:ый|ое|ые|ых)?\s+анализ/i,
  /karyotyp/i,
  /cytogenetic/i,
];

export type CmdAnalyzeCard = {
  externalId?: string;
  externalCode?: string;
  name: string;
  href: string;
  regularPriceRub?: number;
  effectivePriceRub?: number;
  turnaroundTime?: string;
  urgentAvailable: boolean;
  homeCollectionAvailable: boolean;
  rawText: string;
};

export type CmdCatalogParseResult = {
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  cardsSeen: number;
  parsedCount: number;
  karyotypeProbe: {
    status: 'found' | 'not_found';
    matches: Array<{
      externalCode?: string;
      name: string;
      sourceUrl: string;
      effectivePriceRub?: number;
    }>;
  };
};

export function parseCmdCatalogHtml(
  html: string,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    maxItems?: number;
    sourceUrl?: string;
  } = {},
): CmdCatalogParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const cards = parseCmdAnalyzeCards(html, options.sourceUrl ?? CMD_MOSCOW_CATALOG_URL)
    .slice(0, maxItems);
  const parsed = cards
    .map((card) => mapCmdCard(card, context, fetchedAt))
    .filter((item): item is { test: ProviderTestRecord; price: ProviderTestPriceRecord } => item !== undefined);
  const karyotypeMatches = cards
    .filter((card) => isKaryotypeCandidate(card.name) || isKaryotypeCandidate(card.rawText))
    .map((card) => ({
      externalCode: card.externalCode,
      name: card.name,
      sourceUrl: card.href,
      effectivePriceRub: card.effectivePriceRub,
    }));

  return {
    tests: parsed.map((item) => item.test),
    prices: parsed.map((item) => item.price),
    cardsSeen: cards.length,
    parsedCount: parsed.length,
    karyotypeProbe: {
      status: karyotypeMatches.length > 0 ? 'found' : 'not_found',
      matches: karyotypeMatches,
    },
  };
}

export function parseCmdAnalyzeCard(rawHtml: string, sourceUrl = CMD_MOSCOW_CATALOG_URL): CmdAnalyzeCard | undefined {
  const anchor = rawHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const href = anchor?.[1];
  const name = cleanText(matchFirst(rawHtml, /<div\b[^>]*class=["'][^"']*analyze-item__title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ?? anchor?.[2] ?? '');
  const rawText = cleanText(rawHtml);

  if (!href || !name) {
    return undefined;
  }

  const externalCode = cleanText(
    attr(rawHtml, 'data-code')
      ?? matchFirst(rawHtml, /<dt>\s*Код:\s*<\/dt>\s*<dd>\s*([\s\S]*?)\s*<\/dd>/i)
      ?? '',
  ) || undefined;
  const regularPriceRub = toRubles(
    matchFirst(rawHtml, /<div\b[^>]*class=["'][^"']*analyze-item__price[^"']*["'][^>]*>[\s\S]*?Цена:\s*<\/span>\s*([0-9\s.,]+)\s*(?:р|руб)\.?/i)
      ?? matchFirst(rawText, /Цена:\s*([0-9\s.,]+)\s*(?:р|руб)\.?/i)
      ?? findPrimaryPrice(rawText),
  );

  return {
    externalId: externalCode ? `CMD-${externalCode}` : normalizeCmdUrl(href, sourceUrl),
    externalCode,
    name,
    href: normalizeCmdUrl(href, sourceUrl),
    regularPriceRub,
    effectivePriceRub: effectivePriceRub({ regularPriceRub }),
    turnaroundTime: cleanText(matchFirst(rawHtml, /<dt>\s*Срок:\s*<\/dt>\s*<dd>\s*([\s\S]*?)\s*<\/dd>/i) ?? '') || undefined,
    urgentAvailable: /срочн/i.test(rawText),
    homeCollectionAvailable: /на дому|выезд на дом/i.test(rawText),
    rawText,
  };
}

export function parseCmdAnalyzeCards(html: string, sourceUrl = CMD_MOSCOW_CATALOG_URL): CmdAnalyzeCard[] {
  return dedupeCards(
    [...html.matchAll(/<article\b[^>]*class=["'][^"']*analyze-item[^"']*["'][^>]*>[\s\S]*?<\/article>/gi)]
      .map((match) => parseCmdAnalyzeCard(match[0], sourceUrl))
      .filter((item): item is CmdAnalyzeCard => item !== undefined),
  );
}

export function isKaryotypeCandidate(value: string): boolean {
  return KARYOTYPE_PATTERNS.some((pattern) => pattern.test(value));
}

export function buildCmdAnalyzeSearchUrl(term: string): string {
  const url = new URL('/search/', CMD_BASE_URL);
  url.searchParams.set('q', term);
  url.searchParams.set('type', 'analyzes');
  url.searchParams.set('action', 'popup');
  return url.toString();
}

function mapCmdCard(
  card: CmdAnalyzeCard,
  context: ScraperContext,
  fetchedAt: string,
): { test: ProviderTestRecord; price: ProviderTestPriceRecord } | undefined {
  if (card.effectivePriceRub === undefined) {
    return undefined;
  }

  const price: ProviderTestPriceRecord = {
    providerCode: 'cmd',
    regionCode: context.region.code,
    city: context.region.city,
    externalId: card.externalId,
    externalCode: card.externalCode,
    currency: 'RUB',
    regularPriceRub: card.regularPriceRub,
    effectivePriceRub: card.effectivePriceRub,
    offerType: 'regular',
    sourceUrl: card.href,
    fetchedAt,
    rawPayload: {
      parser: 'cmd-analyze-card',
      card,
    },
  };

  return {
    test: {
      providerCode: 'cmd',
      regionCode: context.region.code,
      externalId: card.externalId,
      externalCode: card.externalCode,
      name: card.name,
      normalizedName: normalizeProviderName(card.name),
      kind: 'analysis',
      turnaroundTime: card.turnaroundTime,
      sourceUrl: card.href,
      canonicalCode: isStrongCmdKaryotypeMatch(card) ? 'KARYOTYPE' : undefined,
      matchStatus: isStrongCmdKaryotypeMatch(card) ? 'auto_matched' : 'unmatched',
      matchConfidence: isStrongCmdKaryotypeMatch(card) ? 1 : undefined,
      fetchedAt,
      rawPayload: {
        parser: 'cmd-analyze-card',
        source: 'public_catalog_html',
        matchReason: isStrongCmdKaryotypeMatch(card) ? 'exact_provider_code' : undefined,
        urgentAvailable: card.urgentAvailable,
        homeCollectionAvailable: card.homeCollectionAvailable,
        price,
        card,
      },
    },
    price,
  };
}

function isStrongCmdKaryotypeMatch(card: CmdAnalyzeCard): boolean {
  return card.externalCode === '190204' || isKaryotypeCandidate(card.name);
}

function findPrimaryPrice(value: string): string | undefined {
  return value.match(/([0-9][0-9\s.,]*)\s*(?:р|руб)\.?/i)?.[1];
}

function dedupeCards(cards: CmdAnalyzeCard[]): CmdAnalyzeCard[] {
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

function normalizeCmdUrl(href: string, sourceUrl: string): string {
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
