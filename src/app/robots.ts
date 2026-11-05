import type { MetadataRoute } from "next";

/** Internal tool: nothing here should be crawled. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
