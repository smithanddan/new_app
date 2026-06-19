import type { MetadataRoute } from "next";
import { getSiteUrl, SEO_BASKETS } from "./lib/seo";
import { getIndexableSeoPages } from "./lib/seo-verticals";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const seoPages = await getIndexableSeoPages();
  const now = new Date();
  const urls: MetadataRoute.Sitemap = [
    route(siteUrl, "/search", now, "daily", 0.8),
    route(siteUrl, "/scan", now, "daily", 0.75),
    route(siteUrl, "/api-docs", now, "monthly", 0.5),
    route(siteUrl, "/pricing", now, "monthly", 0.6),
  ];

  for (const page of seoPages) {
    urls.push(route(siteUrl, page.canonicalPath, now, "daily", page.kind === "compare_service" ? 1 : 0.9));
  }

  for (const basket of SEO_BASKETS) {
    urls.push(route(siteUrl, `/basket/${basket.slug}`, now, "daily", 0.85));
  }

  return dedupeRoutes(urls);
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

function dedupeRoutes(routes: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return routes.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
