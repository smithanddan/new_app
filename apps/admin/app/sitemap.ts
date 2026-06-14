import type { MetadataRoute } from "next";
import { getCanonicalSlug, getSeoTestsSafe, getSiteUrl, SEO_BASKETS, SEO_CITIES } from "./lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const tests = await getSeoTestsSafe();
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [
    route(siteUrl, "/search", now, "daily", 0.8),
    route(siteUrl, "/api-docs", now, "monthly", 0.5),
    route(siteUrl, "/pricing", now, "monthly", 0.6),
  ];

  for (const test of tests) {
    const slug = getCanonicalSlug(test);
    urls.push(route(siteUrl, `/test/${slug}`, now, "daily", 0.9));
    urls.push(route(siteUrl, `/compare/${slug}`, now, "daily", 1));
    for (const city of SEO_CITIES) {
      urls.push(route(siteUrl, `/city/${city.slug}/${slug}-price`, now, "daily", 0.95));
    }
  }

  for (const basket of SEO_BASKETS) {
    urls.push(route(siteUrl, `/basket/${basket.slug}`, now, "daily", 0.85));
  }

  return urls;
}

function route(
  siteUrl: string,
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}
