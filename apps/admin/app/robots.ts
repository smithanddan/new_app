import type { MetadataRoute } from "next";
import { getSiteUrl } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/search", "/test", "/compare", "/city", "/basket", "/api-docs", "/pricing"],
      disallow: ["/dashboard", "/match", "/runs", "/sources"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
