import type {
  LabPromotionItemRecord,
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

export const DNKOM_BASE_URL = 'https://dnkom.ru';
export const DNKOM_CATALOG_URL = `${DNKOM_BASE_URL}/analizy-i-tseny/po-tipu/`;
export const DNKOM_ACTIONS_URL = `${DNKOM_BASE_URL}/actions/`;

export type DnkomProductInfo = {
  id?: string;
  name?: string;
  price?: number;
  sourceUrl?: string;
};

export type DnkomCatalogParseResult = {
  tests: ProviderTestRecord[];
  prices: ProviderTestPriceRecord[];
  productsSeen: number;
  links: Array<{ url: string; text: string }>;
  parsedCount: number;
};

export type DnkomActionsParseResult = {
  promotions: LabPromotionRecord[];
  promotionItems: LabPromotionItemRecord[];
  links: Array<{ url: string; text: string }>;
  parsedCount: number;
};

type RequiredDnkomProductInfo = DnkomProductInfo & {
  id: string;
  name: string;
  price: number;
};

export function parseDnkomCatalogHtml(
  html: string,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    maxItems?: number;
    sourceUrl?: string;
    detailHtmlByUrl?: Record<string, string>;
  } = {},
): DnkomCatalogParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const sourceUrl = options.sourceUrl ?? DNKOM_CATALOG_URL;
  const productItems = parseCatalogProducts(html, sourceUrl, context, fetchedAt).slice(0, maxItems);
  const links = productItems.length === 0 ? parseCatalogLinks(html).slice(0, maxItems) : [];
  const detailItems = links
    .map((link) => {
      const detailHtml = options.detailHtmlByUrl?.[link.url];
      return detailHtml ? parseCatalogDetail(detailHtml, link.url, context, fetchedAt) : undefined;
    })
    .filter((item): item is { test: ProviderTestRecord; price: ProviderTestPriceRecord } => item !== undefined);
  const parsedItems = productItems.length > 0 ? productItems : detailItems;

  return {
    tests: parsedItems.map((item) => item.test),
    prices: parsedItems.map((item) => item.price),
    productsSeen: productItems.length,
    links,
    parsedCount: parsedItems.length,
  };
}

export function parseDnkomActionsHtml(
  html: string,
  context: ScraperContext,
  options: {
    fetchedAt?: string;
    maxItems?: number;
    detailHtmlByUrl?: Record<string, string>;
  } = {},
): DnkomActionsParseResult {
  const fetchedAt = options.fetchedAt ?? context.fetchedAt ?? new Date().toISOString();
  const links = parseActionLinks(html).slice(0, options.maxItems ?? Number.POSITIVE_INFINITY);
  const parsedDetails = links
    .map((link) => {
      const detailHtml = options.detailHtmlByUrl?.[link.url];
      return detailHtml ? parseActionDetail(detailHtml, link.url, context, fetchedAt) : undefined;
    })
    .filter((item): item is { promotion: LabPromotionRecord; items: LabPromotionItemRecord[] } => item !== undefined);
  const detailByExternalId = new Map(parsedDetails.map((item) => [item.promotion.externalId, item]));
  const promotions: LabPromotionRecord[] = links.map((link) => {
    const parsed = detailByExternalId.get(link.url);
    return parsed?.promotion ?? {
      providerCode: 'dnkom',
      regionCode: context.region.code,
      externalId: link.url,
      title: link.text,
      offerType: 'promo' as const,
      regionScope: context.region.city,
      sourceUrl: link.url,
      fetchedAt,
      rawPayload: {
        parser: 'dnkom-actions-list',
        link,
      },
    };
  });

  return {
    promotions,
    promotionItems: parsedDetails.flatMap((item) => item.items),
    links,
    parsedCount: promotions.length,
  };
}

export function parseDnkomProductInfo(rawDataProductInfo: string): DnkomProductInfo | undefined {
  try {
    const parsed = JSON.parse(decodeHtml(rawDataProductInfo));
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      id: item.id === undefined ? undefined : String(item.id),
      name: item.name === undefined ? undefined : String(item.name),
      price: item.price === undefined ? undefined : Number(item.price),
    };
  } catch {
    return undefined;
  }
}

export function parseDnkomCatalogLinks(html: string): Array<{ url: string; text: string }> {
  return parseCatalogLinks(html);
}

export function parseDnkomNextCatalogPageUrl(html: string): string | undefined {
  const nextUrl = matchFirst(html, /AskronUtil\.loadAjaxPage\(['"]([^'"]*PAGEN_2=\d+[^'"]*)['"]\)/i);
  return nextUrl ? new URL(decodeHtml(nextUrl), DNKOM_BASE_URL).toString() : undefined;
}

export function parseDnkomActionLinks(html: string): Array<{ url: string; text: string }> {
  return parseActionLinks(html);
}

export function parseDnkomCatalogDetailHtml(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt = context.fetchedAt ?? new Date().toISOString(),
): { test: ProviderTestRecord; price: ProviderTestPriceRecord } | undefined {
  return parseCatalogDetail(html, url, context, fetchedAt);
}

export function parseDnkomActionDetailHtml(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt = context.fetchedAt ?? new Date().toISOString(),
): { promotion: LabPromotionRecord; items: LabPromotionItemRecord[] } | undefined {
  return parseActionDetail(html, url, context, fetchedAt);
}

export function extractDnkomCurrentCity(html: string): string | undefined {
  return extractCurrentCity(html);
}

function parseCatalogLinks(html: string): Array<{ url: string; text: string }> {
  const seen = new Set<string>();
  return extractLinks(html)
    .filter((link) => link.href.startsWith('/analizy-i-tseny/po-tipu/'))
    .filter((link) => link.href !== '/analizy-i-tseny/po-tipu/')
    .filter((link) => link.text.length > 8)
    .map((link) => ({ url: new URL(link.href, DNKOM_BASE_URL).toString(), text: link.text }))
    .filter((link) => {
      if (seen.has(link.url)) {
        return false;
      }
      seen.add(link.url);
      return true;
    });
}

function parseActionLinks(html: string): Array<{ url: string; text: string }> {
  const seen = new Set<string>();
  return extractLinks(html)
    .filter((link) => /^\/actions\/[^/]+\/$/.test(link.href))
    .filter((link) => link.text.length > 5)
    .map((link) => ({ url: new URL(link.href, DNKOM_BASE_URL).toString(), text: link.text }))
    .filter((link) => {
      if (seen.has(link.url)) {
        return false;
      }
      seen.add(link.url);
      return true;
    });
}

function parseCatalogProducts(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt: string,
): Array<{ test: ProviderTestRecord; price: ProviderTestPriceRecord }> {
  return extractProductInfos(html)
    .filter(hasRequiredProductFields)
    .map((product) => {
      const sourceUrl = product.sourceUrl ?? url;
      const regularPriceRub = toRubles(product.price);
      const price: ProviderTestPriceRecord = {
        providerCode: 'dnkom',
        regionCode: context.region.code,
        city: context.region.city,
        externalId: product.id,
        externalCode: product.id,
        currency: 'RUB',
        regularPriceRub,
        effectivePriceRub: effectivePriceRub({ regularPriceRub }),
        offerType: 'regular',
        sourceUrl,
        fetchedAt,
        rawPayload: {
          parser: 'dnkom-catalog-product',
          product,
          detectedCity: extractCurrentCity(html),
        },
      };

      return {
        test: {
          providerCode: 'dnkom',
          regionCode: context.region.code,
          externalId: product.id,
          externalCode: product.id,
          name: product.name,
          normalizedName: normalizeProviderName(product.name),
          kind: 'analysis',
          sourceUrl,
          matchStatus: 'unmatched',
          fetchedAt,
          rawPayload: {
            parser: 'dnkom-catalog-product',
            price,
            product,
          },
        },
        price,
      };
    });
}

function parseCatalogDetail(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt: string,
): { test: ProviderTestRecord; price: ProviderTestPriceRecord } | undefined {
  const product = extractFirstProductInfo(html);
  const name = cleanText(
    product?.name
      ?? matchFirst(html, /<h1[^>]*class=["'][^"']*header[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      ?? matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
      ?? '',
  ).replace(/\s+в Москве$/i, '');
  const externalCode = product?.id ?? cleanText(matchFirst(html, /<div[^>]*class=["'][^"']*code data[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ?? '');
  const regularPriceRub = toRubles(
    product?.price
      ?? matchFirst(html, /<meta\s+itemprop=["']price["']\s+content=["']([^"']+)["']/i)
      ?? matchFirst(html, /<div[^>]*class=["'][^"']*price-value[^"']*["'][^>]*>([\s\S]*?)<\/div>/i),
  );

  if (!name || regularPriceRub === undefined) {
    return undefined;
  }

  const effective = effectivePriceRub({ regularPriceRub });
  const price: ProviderTestPriceRecord = {
    providerCode: 'dnkom',
    regionCode: context.region.code,
    city: context.region.city,
    externalId: externalCode || url,
    externalCode: externalCode || undefined,
    currency: 'RUB',
    regularPriceRub,
    effectivePriceRub: effective,
    offerType: 'regular',
    sourceUrl: url,
    fetchedAt,
    rawPayload: {
      parser: 'dnkom-detail',
      product,
      detectedCity: extractCurrentCity(html),
    },
  };

  return {
    test: {
      providerCode: 'dnkom',
      regionCode: context.region.code,
      externalId: price.externalId,
      externalCode: price.externalCode,
      name,
      normalizedName: normalizeProviderName(name),
      kind: 'analysis',
      sourceUrl: url,
      matchStatus: 'unmatched',
      fetchedAt,
      rawPayload: {
        parser: 'dnkom-detail',
        price,
        product,
      },
    },
    price,
  };
}

function parseActionDetail(
  html: string,
  url: string,
  context: ScraperContext,
  fetchedAt: string,
): { promotion: LabPromotionRecord; items: LabPromotionItemRecord[] } | undefined {
  const title = cleanText(
    matchFirst(html, /<h1[^>]*class=["'][^"']*(?:banner-heading|heading)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
      ?? matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
      ?? matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
      ?? '',
  ).replace(/\s+в Москве.*$/i, '');
  const validTo = parseRussianDate(matchFirst(html, /до\s+(\d{2}\.\d{2}\.\d{4})/i));
  const product = extractFirstProductInfo(html);
  const itemName = cleanText(
    product?.name
      ?? matchFirst(html, /<div[^>]*class=["'][^"']*item-main-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      ?? title,
  );
  const promoPriceRub = toRubles(
    product?.price
      ?? matchFirst(html, /<div[^>]*class=["'][^"']*item-price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i),
  );
  const externalCode = product?.id ?? cleanText(matchFirst(html, /<span[^>]*class=["'][^"']*item-main-code[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ?? '');

  if (!title) {
    return undefined;
  }

  const promotion: LabPromotionRecord = {
    providerCode: 'dnkom',
    regionCode: context.region.code,
    externalId: url,
    title,
    offerType: 'promo',
    endsOn: validTo,
    regionScope: context.region.city,
    sourceUrl: url,
    fetchedAt,
    rawPayload: {
      parser: 'dnkom-action',
      product,
      detectedCity: extractCurrentCity(html),
    },
  };

  const items: LabPromotionItemRecord[] = promoPriceRub === undefined ? [] : [{
    promotionExternalId: promotion.externalId,
    providerCode: 'dnkom',
    regionCode: context.region.code,
    externalId: externalCode || url,
    originalName: itemName || title,
    promoPriceRub,
    effectivePriceRub: promoPriceRub,
    sourceUrl: url,
    rawPayload: {
      parser: 'dnkom-action-item',
      product,
    },
  }];

  return { promotion, items };
}

function extractLinks(html: string): Array<{ href: string; text: string }> {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: decodeHtml(match[1]),
      text: cleanText(
        match[2]
          .replace(/<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi, ' $1 ')
          .replace(/<img\b[^>]*title=["']([^"']+)["'][^>]*>/gi, ' $1 '),
      ),
    }));
}

function extractFirstProductInfo(html: string): DnkomProductInfo | undefined {
  return extractProductInfos(html)[0];
}

function extractProductInfos(html: string): DnkomProductInfo[] {
  return [...html.matchAll(/data-product-info=(["'])([\s\S]*?)\1/gi)]
    .map<DnkomProductInfo | undefined>((match) => {
      const product = parseDnkomProductInfo(match[2]);
      if (!product) {
        return undefined;
      }

      return {
        ...product,
        sourceUrl: extractNearestHrefBefore(html, match.index ?? 0),
      };
    })
    .filter((item): item is DnkomProductInfo => item !== undefined);
}

function hasRequiredProductFields(product: DnkomProductInfo): product is RequiredDnkomProductInfo {
  return Boolean(product.id && product.name && product.price !== undefined);
}

function extractNearestHrefBefore(html: string, index: number): string | undefined {
  const nearby = html.slice(Math.max(0, index - 2_000), index);
  const links = [...nearby.matchAll(/href=["']([^"']+)["']/gi)];
  const href = links.at(-1)?.[1];
  return href?.startsWith('/') ? new URL(href, DNKOM_BASE_URL).toString() : href;
}

function extractCurrentCity(html: string): string | undefined {
  return cleanText(
    matchFirst(html, /<span[^>]*class=["'][^"']*(?:current-city|city-name)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) ?? '',
  ) || undefined;
}

function parseRussianDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function matchFirst(html: string, pattern: RegExp, group = 1): string | undefined {
  return html.match(pattern)?.[group];
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
