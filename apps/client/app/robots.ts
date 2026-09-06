import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/templates"],
      // Workspace surfaces are per-instance working state, not content to index.
      disallow: ["/dashboard", "/editor/", "/assets", "/health"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
