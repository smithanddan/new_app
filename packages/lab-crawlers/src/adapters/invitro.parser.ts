import type {
  LabPromotionRecord,
  ProviderTestPriceRecord,
  ProviderTestRecord,
} from '../catalog-types.js';
import {
  effectivePriceRub,
  normalizeProviderName,
  toRubles,
  type ScraperContext,
} from '../provider-scraper.js';

export const INVITRO_BASE_URL = 'https://www.invitro.ru';
export const INVITRO_MOSCOW_CATALOG_URL = `${INVITRO_BASE_URL}/analizes`;
export const INVITRO_MOSCOW_DOCTOR_CATALOG_URL = `${INVITRO_BASE_URL}/analizes/for-doctors/`;
export const INVITRO_MOSCOW_ACTIONS_URL = `${INVITRO_BASE_URL}/moscow/ak/`;

export type InvitroCatalogCard = {
  externalId?: string;
  externalCode?: string;
  name: string;
  href: string;
  regularPriceRub?: number;
  promoPriceRub?: number;
  effectivePriceRub?: number;
  rawText: string;
};

export type InvitroCatalogParseResult = {
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  cardsSeen: number;
  parsedCount: number;
  links: Array<{ url: string; text: string }>;
};

export type InvitroActionsParseResult = {
  promotions: LabPromotionRecord[];
  links: Array<{ url: string; text: string }>;
  parsedCount: number;
};

export function parseInvitroCatalogHtml(
  html: string,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    maxItems?: number;
    sourceUrl?: string;
  } = {},
): InvitroCatalogParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const sourceUrl = options.sourceUrl ?? INVITRO_MOSCOW_CATALOG_URL;
  const cards = parseInvitroCatalogCards(html, sourceUrl).slice(0, options.maxItems ?? Number.POSITIVE_INFINITY);
  const parsed = cards
    .map((card) => mapInvitroCard(card, context, fetchedAt))
    .filter((item): item is { test: ProviderTestRecord; price: ProviderTestPriceRecord } => item !== undefined);

  return {
    tests: parsed.map((item) => item.test),
    prices: parsed.map((item) => item.price),
    cardsSeen: cards.length,
    parsedCount: parsed.length,
    links: extractInvitroCatalogLinks(html, sourceUrl),
  };
}

export function parseInvitroActionsHtml(
  html: string,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    maxItems?: number;
    sourceUrl?: string;
  } = {},
): InvitroActionsParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const sourceUrl = options.sourceUrl ?? INVITRO_MOSCOW_ACTIONS_URL;
  const promoCards = extractPromoCards(html)
    .slice(0, options.maxItems ?? Number.POSITIVE_INFINITY)
    .map((card, index) => ({
      providerCode: 'invitro',
      regionCode: context.region.code,
      externalId: `invitro-promo-${index + 1}-${slugify(card.title)}`,
      title: card.title,
      description: card.description,
      offerType: 'promo' as const,
      regionScope: context.region.city,
      sourceUrl,
      fetchedAt,
      rawPayload: {
        parser: 'invitro-promo-card',
        card,
      },
    }));

  return {
    promotions: promoCards,
    links: extractInvitroActionLinks(html, sourceUrl),
    parsedCount: promoCards.length,
  };
}

export function parseInvitroCatalogCard(rawHtml: string, sourceUrl = INVITRO_MOSCOW_CATALOG_URL): InvitroCatalogCard | undefined {
  const anchor = rawHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const href = attr(rawHtml, 'href') ?? anchor?.[1];
  const rawText = cleanText(anchor?.[2] ?? rawHtml);
  const priceText = matchFirst(rawText, /([0-9][0-9\s]*)(?:\s*)₽/);
  const regularPriceRub = toRubles(priceText);

  if (!href || !regularPriceRub) {
    return undefined;
  }

  const name = cleanTestName(rawText);
  if (!name || isNavigationText(name)) {
    return undefined;
  }

  const normalizedUrl = normalizeInvitroUrl(href, sourceUrl);
  const externalCode = extractExternalCode(normalizedUrl);

  return {
    externalId: externalCode ?? normalizedUrl,
    externalCode,
    name,
    href: normalizedUrl,
    regularPriceRub,
    effectivePriceRub: effectivePriceRub({ regularPriceRub }),
    rawText,
  };
}

export function extractInvitroCatalogLinks(html: string, sourceUrl = INVITRO_MOSCOW_CATALOG_URL): Array<{ url: string; text: string }> {
  const seen = new Set<string>();
  return extractLinks(html)
    .filter((link) => /^\/analizes\/(?:for-doctors|profi)\//.test(link.href))
    .filter((link) => link.text.length > 3)
    .map((link) => ({ url: normalizeInvitroUrl(link.href, sourceUrl), text: link.text }))
    .filter((link) => uniqueByUrl(seen, link.url));
}

export function extractInvitroActionLinks(html: string, sourceUrl = INVITRO_MOSCOW_ACTIONS_URL): Array<{ url: string; text: string }> {
  const seen = new Set<string>();
  return extractLinks(html)
    .filter((link) => /^\/[a-z0-9_-]+\/ak\/$/i.test(link.href) || /^\/moscow\/ak\//i.test(link.href))
    .filter((link) => link.text.length > 2)
    .map((link) => ({ url: normalizeInvitroUrl(link.href, sourceUrl), text: link.text }))
    .filter((link) => uniqueByUrl(seen, link.url));
}

function parseInvitroCatalogCards(html: string, sourceUrl: string): InvitroCatalogCard[] {
  const cardClassBlocks = [...html.matchAll(/<a\b[^>]*href=["'][^"']*\/analizes\/(?:for-doctors|profi)\/[^"']+["'][^>]*>[\s\S]*?<\/a>/gi)]
    .map((match) => parseInvitroCatalogCard(match[0], sourceUrl))
    .filter((item): item is InvitroCatalogCard => item !== undefined);

  return dedupeCards(cardClassBlocks);
}

function mapInvitroCard(
  card: InvitroCatalogCard,
  context: ScraperContext,
  fetchedAt: string,
): { test: ProviderTestRecord; price: ProviderTestPriceRecord } | undefined {
  if (card.effectivePriceRub === undefined) {
    return undefined;
  }

  const price: ProviderTestPriceRecord = {
    providerCode: 'invitro',
    regionCode: context.region.code,
    city: context.region.city,
    externalId: card.externalId,
    externalCode: card.externalCode,
    currency: 'RUB',
    regularPriceRub: card.regularPriceRub,
    promoPriceRub: card.promoPriceRub,
    effectivePriceRub: card.effectivePriceRub,
    offerType: card.promoPriceRub === undefined ? 'regular' : 'promo',
    sourceUrl: card.href,
    fetchedAt,
    rawPayload: {
      parser: 'invitro-catalog-card',
      card,
    },
  };

  return {
    test: {
      providerCode: 'invitro',
      regionCode: context.region.code,
      externalId: card.externalId,
      externalCode: card.externalCode,
      name: card.name,
      normalizedName: normalizeProviderName(card.name),
      kind: classifyInvitroTest(card.name),
      sourceUrl: card.href,
      matchStatus: 'unmatched',
      fetchedAt,
      rawPayload: {
        parser: 'invitro-catalog-card',
        price,
        card,
      },
    },
    price,
  };
}

function extractPromoCards(html: string): Array<{ title: string; description?: string; rawText: string }> {
  const cards = [...html.matchAll(/<div\b[^>]*class=["'][^"']*PromoCard[\s\S]*?(?=<div\b[^>]*class=["'][^"']*PromoCard|<\/main>|<\/body>)/gi)]
    .map((match) => {
      const rawText = cleanText(match[0]);
      const title = cleanText(matchFirst(match[0], /<p\b[^>]*class=["'][^"']*PromoCard__title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) ?? '');
      const description = cleanText(matchFirst(match[0], /<p\b[^>]*class=["'][^"']*PromoCard__description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) ?? '');
      return {
        title,
        description: description || undefined,
        rawText,
      };
    })
    .filter((card) => card.title.length > 2);

  return dedupeBy(cards, (card) => `${card.title}:${card.description ?? ''}`);
}

function classifyInvitroTest(name: string): ProviderTestRecord['kind'] {
  const normalized = normalizeProviderName(name);
  return ['профиль', 'комплекс', 'чекап', 'check-up', 'скрининг'].some((marker) => normalized.includes(marker))
    ? 'profile'
    : 'analysis';
}

function cleanTestName(value: string): string {
  return value
    .replace(/\s*[0-9][0-9\s]*\s*₽.*$/u, '')
    .replace(/\bВ корзину\b/giu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNavigationText(value: string): boolean {
  return /^(анализы|акции|чекапы|все)$/i.test(value.trim());
}

function extractExternalCode(url: string): string | undefined {
  const match = url.match(/\/analizes\/(?:for-doctors|profi)\/([0-9]+)\/([0-9]+)\/?$/i);
  return match ? match[2] : undefined;
}

function extractLinks(html: string): Array<{ href: string; text: string }> {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: decodeHtml(match[1] ?? ''),
      text: cleanText(match[2] ?? ''),
    }))
    .filter((link) => link.href.length > 0);
}

function dedupeCards(cards: InvitroCatalogCard[]): InvitroCatalogCard[] {
  return dedupeBy(cards, (card) => card.externalCode ?? card.href);
}

function dedupeBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueByUrl(seen: Set<string>, url: string): boolean {
  if (seen.has(url)) {
    return false;
  }
  seen.add(url);
  return true;
}

function normalizeInvitroUrl(href: string, sourceUrl: string): string {
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

function slugify(value: string): string {
  return normalizeProviderName(value)
    .replace(/[^a-zа-я0-9]+/giu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
