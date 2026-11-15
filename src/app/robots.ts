import type { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/how-it-works",
          "/for-you",
          "/for-families",
          "/our-approach",
          "/faq",
          "/about",
          "/resources",
          "/resources/*",
          "/contact",
          "/join",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/dashboard",
          "/dashboard/*",
          "/cases",
          "/cases/*",
          "/appointments",
          "/appointments/*",
          "/referrals",
          "/referrals/*",
          "/approvals",
          "/approvals/*",
          "/member-portal",
          "/member-portal/*",
          "/members",
          "/audit-log",
          "/worklist",
          "/settings",
          "/health-equity",
          "/analytics",
          "/interventions",
        ],
      },
    ],
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  };
}
