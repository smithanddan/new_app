import * as cheerio from "cheerio";
import { z } from "zod";
import { normalizePrice } from "../normalizers/price.js";

export const CssExtractorConfigSchema = z.object({
  itemSelector: z.string().optional(),
  titleSelector: z.string(),
  priceSelector: z.string(),
  availabilitySelector: z.string().optional(),
  urlSelector: z.string().optional(),
  defaultCurrency: z.string().default("RUB")
});

export type ExtractedOffer = {
  title: string;
  priceAmount: number | null;
  currency: string | null;
  availability: string | null;
  sourceUrl: string | null;
  raw: Record<string, unknown>;
};

export function extractOffersWithCss(html: string, pageUrl: string, config: unknown): ExtractedOffer[] {
  const parsed = CssExtractorConfigSchema.parse(config);
  const $ = cheerio.load(html);
  const containers = parsed.itemSelector ? $(parsed.itemSelector).toArray() : [$.root()[0]];

  return containers
    .map((el) => {
      const scope = $(el);
      const title = scope.find(parsed.titleSelector).first().text().trim() || $(parsed.titleSelector).first().text().trim();
      const rawPrice = scope.find(parsed.priceSelector).first().text().trim() || $(parsed.priceSelector).first().text().trim();
      const price = normalizePrice(rawPrice, parsed.defaultCurrency);
      const availability = parsed.availabilitySelector ? scope.find(parsed.availabilitySelector).first().text().trim() || null : null;
      const href = parsed.urlSelector ? scope.find(parsed.urlSelector).first().attr("href") : null;
      const sourceUrl = href ? new URL(href, pageUrl).toString() : pageUrl;

      return {
        title,
        priceAmount: price?.amount ?? null,
        currency: price?.currency ?? null,
        availability,
        sourceUrl,
        raw: { rawPrice, href }
      };
    })
    .filter((offer) => offer.title || offer.priceAmount !== null);
}
