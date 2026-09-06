import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.upgence.com";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-user"],
      disallow: [
        "/dashboard/",
        "/client/",
        "/contracts/",
        "/find-work/",
        "/interview/",
        "/jobs/",
        "/message/",
        "/messages/",
        "/profile/",
        "/health",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
