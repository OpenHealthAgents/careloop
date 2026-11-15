import type { Metadata, Viewport } from "next";
import "./globals.css";
import {
  SITE_CONFIG,
  getOrganizationSchema,
  getWebSiteSchema,
} from "@/lib/seo/config";

export const viewport: Viewport = {
  themeColor: "#0e6156",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: "CareLoop — Healthcare is Complicated. Getting Care Shouldn't Be.",
    template: "%s | CareLoop",
  },
  description:
    "CareLoop is an intelligent healthcare navigation companion. We turn doctor recommendations, specialist referrals, and care plans into completed care with step-by-step guidance and follow-through.",
  keywords: [
    "healthcare navigation",
    "healthcare guidance",
    "care coordination",
    "healthcare organization",
    "healthcare journey",
    "caregiver support",
    "healthcare appointments",
    "healthcare follow-through",
    "healthcare access",
    "patient navigation",
  ],
  authors: [{ name: SITE_CONFIG.name }],
  creator: SITE_CONFIG.name,
  publisher: SITE_CONFIG.legalName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CareLoop — Healthcare is Complicated. Getting Care Shouldn't Be.",
    description:
      "CareLoop helps you understand what to do, find your next step, and follow through — so healthcare feels less overwhelming and more manageable.",
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.locale,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CareLoop — Healthcare Navigation & Follow-Through",
    description:
      "CareLoop closes the execution gap between knowing what care you need and getting it done.",
    creator: SITE_CONFIG.twitterHandle,
  },
  icons: {
    icon: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSchema = getOrganizationSchema();
  const webSiteSchema = getWebSiteSchema();

  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-[#FAF8F5] font-sans text-[#191716] antialiased selection:bg-[#EBF5F3] selection:text-[#0E6156]">
        {children}
      </body>
    </html>
  );
}
