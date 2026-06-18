import type { MetadataRoute } from "next";
import { getSiteUrl } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/search", "/scan", "/compare", "/basket", "/api-docs", "/pricing", "/analizy", "/uzi", "/mrt-kt", "/vrachi", "/kliniki", "/stomatologiya"],
      disallow: ["/seo", "/dashboard", "/match", "/runs", "/sources"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
