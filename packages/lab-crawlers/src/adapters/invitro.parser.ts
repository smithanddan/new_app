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

export type InvitroApiProduct = {
  id?: string;
  product_id?: string;
  bitrix_id?: number | string;
  category_bitrix_id?: number | string;
  category_name?: string;
  categories?: Array<{
    bitrix_id?: number | string;
    title?: string;
  }>;
  code?: string;
  deadline?: number | string;
  price?: number | string;
  product_type?: 'TEST' | 'COMPLEX' | string;
  title?: string;
  subtitle?: string;
  is_promo?: boolean;
  additional_services?: Array<{
    id?: string;
    price?: number | string;
    title?: string;
  }>;
};

export type InvitroApiCatalogParseResult = {
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  productsSeen: number;
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

export function parseInvitroApiCatalogJson(
  input: unknown,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    sourceUrl?: string;
    defaultKind?: ProviderTestRecord['kind'];
    maxItems?: number;
  } = {},
): InvitroApiCatalogParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const products = extractInvitroApiProducts(input).slice(0, options.maxItems ?? Number.POSITIVE_INFINITY);
  const parsed = products
    .map((product) => mapInvitroApiProduct(product, context, fetchedAt, {
      endpointUrl: options.sourceUrl,
      defaultKind: options.defaultKind,
    }))
    .filter((item): item is { test: ProviderTestRecord; price: ProviderTestPriceRecord } => item !== undefined);

  return {
    tests: parsed.map((item) => item.test),
    prices: parsed.map((item) => item.price),
    productsSeen: products.length,
    parsedCount: parsed.length,
  };
}

export function parseInvitroApiPromotionsJson(
  input: unknown,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    sourceUrl?: string;
    maxItems?: number;
  } = {},
): InvitroActionsParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const docs = extractInvitroPromotionDocs(input).slice(0, options.maxItems ?? Number.POSITIVE_INFINITY);
  const sourceUrl = options.sourceUrl ?? INVITRO_MOSCOW_ACTIONS_URL;
  const promotions: LabPromotionRecord[] = docs
    .flatMap((doc, index): LabPromotionRecord[] => {
      const title = stringValue(doc.title);
      if (!title) {
        return [];
      }
      const slug = extractPromotionSlug(doc);
      return [{
        providerCode: 'invitro',
        regionCode: context.region.code,
        externalId: stringValue(doc.id) ?? slug ?? `invitro-api-promo-${index + 1}`,
        title,
        description: stringValue(doc.description),
        offerType: 'promo' as const,
        regionScope: context.region.city,
        sourceUrl: slug ? normalizeInvitroUrl(`/${context.region.code}/ak/${slug}/`, sourceUrl) : sourceUrl,
        fetchedAt,
        rawPayload: {
          parser: 'invitro-promotions-api',
          doc,
        },
      }];
    });

  return {
    promotions,
    links: promotions.map((promotion) => ({ url: promotion.sourceUrl, text: promotion.title })),
    parsedCount: promotions.length,
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

function extractInvitroApiProducts(input: unknown): InvitroApiProduct[] {
  if (Array.isArray(input)) {
    return input.filter(isRecord) as InvitroApiProduct[];
  }

  if (!isRecord(input)) {
    return [];
  }

  if (input.title !== undefined && input.price !== undefined) {
    return [input as InvitroApiProduct];
  }

  if (Array.isArray(input.data)) {
    return input.data.flatMap((category) => {
      if (!isRecord(category) || !Array.isArray(category.products)) {
        return [];
      }
      return category.products
        .filter(isRecord)
        .map((product) => ({
          category_name: stringValue(category.category_name),
          ...product,
        })) as InvitroApiProduct[];
    });
  }

  if (Array.isArray(input.products)) {
    return input.products.filter(isRecord) as InvitroApiProduct[];
  }

  return [];
}

function mapInvitroApiProduct(
  product: InvitroApiProduct,
  context: ScraperContext,
  fetchedAt: string,
  options: {
    endpointUrl?: string;
    defaultKind?: ProviderTestRecord['kind'];
  } = {},
): { test: ProviderTestRecord; price: ProviderTestPriceRecord } | undefined {
  const name = cleanText(product.title ?? '');
  const regularPriceRub = toRubles(product.price);
  if (!name || regularPriceRub === undefined) {
    return undefined;
  }

  const externalCode = stringValue(product.code) ?? stringValue(product.bitrix_id);
  const externalId = stringValue(product.id) ?? stringValue(product.product_id) ?? externalCode;
  const productKind = product.product_type === 'COMPLEX' ? 'profile' : options.defaultKind ?? classifyInvitroTest(name);
  const itemSourceUrl = buildInvitroProductUrl(product, productKind);
  const biomaterialService = product.additional_services?.find((service) => /взятие|кров/i.test(service.title ?? ''));
  const biomaterialPriceRub = toRubles(biomaterialService?.price);
  const price: ProviderTestPriceRecord = {
    providerCode: 'invitro',
    regionCode: context.region.code,
    city: context.region.city,
    externalId,
    externalCode,
    currency: 'RUB',
    regularPriceRub,
    effectivePriceRub: effectivePriceRub({ regularPriceRub }),
    biomaterialPriceRub,
    offerType: product.is_promo ? 'promo' : 'regular',
    sourceUrl: itemSourceUrl,
    fetchedAt,
    rawPayload: {
      parser: 'invitro-tests-api',
      endpointUrl: options.endpointUrl,
      product,
    },
  };

  return {
    test: {
      providerCode: 'invitro',
      regionCode: context.region.code,
      externalId,
      externalCode,
      name,
      normalizedName: normalizeProviderName(name),
      kind: productKind,
      category: getInvitroProductCategoryName(product),
      biomaterial: biomaterialService?.title,
      turnaroundTime: product.deadline === undefined ? undefined : `${product.deadline} дн.`,
      sourceUrl: itemSourceUrl,
      matchStatus: 'unmatched',
      fetchedAt,
      rawPayload: {
        parser: 'invitro-tests-api',
        endpointUrl: options.endpointUrl,
        price,
        product,
      },
    },
    price,
  };
}

function buildInvitroProductUrl(product: InvitroApiProduct, kind: ProviderTestRecord['kind']): string {
  const categoryBitrixId = getInvitroProductCategoryBitrixId(product);
  const bitrixId = stringValue(product.bitrix_id);
  if (categoryBitrixId && bitrixId) {
    const section = kind === 'profile' ? 'profi' : 'for-doctors';
    return `${INVITRO_BASE_URL}/analizes/${section}/${categoryBitrixId}/${bitrixId}/`;
  }

  return INVITRO_MOSCOW_CATALOG_URL;
}

function getInvitroProductCategoryBitrixId(product: InvitroApiProduct): string | undefined {
  const directCategoryId = stringValue(product.category_bitrix_id);
  if (directCategoryId) {
    return directCategoryId;
  }

  return product.categories
    ?.map((category) => stringValue(category.bitrix_id))
    .filter((value): value is string => value !== undefined)
    .at(-1);
}

function getInvitroProductCategoryName(product: InvitroApiProduct): string | undefined {
  const directCategoryName = stringValue(product.category_name);
  if (directCategoryName) {
    return directCategoryName;
  }

  return product.categories
    ?.map((category) => stringValue(category.title))
    .filter((value): value is string => value !== undefined)
    .at(-1);
}

function extractInvitroPromotionDocs(input: unknown): Array<Record<string, unknown>> {
  if (!isRecord(input) || !Array.isArray(input.docs)) {
    return [];
  }
  return input.docs.filter(isRecord);
}

function extractPromotionSlug(doc: Record<string, unknown>): string | undefined {
  const page = doc.page;
  if (!Array.isArray(page)) {
    return undefined;
  }
  for (const item of page) {
    if (!isRecord(item) || !isRecord(item.newPage)) {
      continue;
    }
    const slug = stringValue(item.newPage.slug);
    if (slug) {
      return slug;
    }
  }
  return undefined;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const stringified = String(value).trim();
  return stringified || undefined;
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
