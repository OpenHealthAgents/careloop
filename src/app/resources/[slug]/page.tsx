import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import { Button, H1 } from "@/components/design-system";
import { EDUCATIONAL_GUIDES } from "@/lib/resources/guides";
import { SITE_CONFIG } from "@/lib/seo/config";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return EDUCATIONAL_GUIDES.map((guide) => ({
    slug: guide.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = EDUCATIONAL_GUIDES.find((g) => g.slug === slug);

  if (!guide) {
    return {
      title: "Guide Not Found",
    };
  }

  const url = `${SITE_CONFIG.url}/resources/${guide.slug}`;

  return {
    title: guide.title,
    description: guide.summary,
    keywords: guide.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: guide.title,
      description: guide.summary,
      url,
      type: "article",
      publishedTime: guide.publishedDate,
      authors: ["CareLoop Care Navigation Team"],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.summary,
    },
  };
}

export default async function EducationalGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = EDUCATIONAL_GUIDES.find((g) => g.slug === slug);

  if (!guide) {
    notFound();
  }

  // Article JSON-LD Structured Data
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    datePublished: guide.publishedDate,
    author: {
      "@type": "Organization",
      name: "CareLoop Health",
      url: SITE_CONFIG.url,
    },
    publisher: {
      "@type": "Organization",
      name: "CareLoop",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_CONFIG.url}/careloop-logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_CONFIG.url}/resources/${guide.slug}`,
    },
  };

  // Breadcrumb JSON-LD Structured Data
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_CONFIG.url,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Resources",
        item: `${SITE_CONFIG.url}/resources`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: guide.title,
        item: `${SITE_CONFIG.url}/resources/${guide.slug}`,
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716] selection:bg-[#EBF5F3] selection:text-[#0E6156]">
      {/* Structured Data injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Navigation />

      <main id="main-content" className="flex-1 py-10 sm:py-16">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-xs text-[#8A8279]">
              <li>
                <Link href="/" className="hover:text-[#191716] transition-colors">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/resources" className="hover:text-[#191716] transition-colors">
                  Resources
                </Link>
              </li>
              <li>/</li>
              <li className="text-[#0E6156] font-semibold truncate max-w-[200px] sm:max-w-none">
                {guide.category}
              </li>
            </ol>
          </nav>

          {/* Article Header */}
          <header className="rounded-3xl border border-[#E2DDD5] bg-white p-6 sm:p-10 shadow-soft mb-10 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0E6156] bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                {guide.category}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#8A8279]">
                <Clock className="h-3.5 w-3.5" />
                {guide.readTime}
              </span>
              <span className="text-xs text-[#8A8279]">
                Published {guide.publishedDate}
              </span>
            </div>

            <H1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#191716] tracking-tight leading-tight">
              {guide.title}
            </H1>

            <p className="text-sm sm:text-base text-[#5C5650] leading-relaxed pt-2 border-t border-[#E2DDD5]/70">
              {guide.summary}
            </p>
          </header>

          {/* Article Body Content */}
          <div className="rounded-3xl border border-[#E2DDD5] bg-white p-6 sm:p-10 shadow-soft space-y-10">
            {guide.content.map((sec, idx) => (
              <section key={idx} className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#191716] tracking-tight">
                  {sec.sectionTitle}
                </h2>

                <div className="space-y-4 text-sm sm:text-base text-[#5C5650] leading-relaxed">
                  {sec.paragraphs.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}
                </div>

                {sec.actionTakeaway && (
                  <div className="rounded-2xl border border-teal-200 bg-[#EBF5F3]/70 p-4 sm:p-5 text-xs sm:text-sm text-[#0E6156] flex items-start gap-3 mt-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#191716] mb-0.5">Key CareLoop Takeaway:</strong>
                      <span>{sec.actionTakeaway}</span>
                    </div>
                  </div>
                )}
              </section>
            ))}

            {/* In-Article Conversion Callout */}
            <div className="mt-12 rounded-2xl border-2 border-[#0E6156] bg-[#FAF8F5] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-base font-bold text-[#191716]">
                  Ready to turn this guidance into completed care?
                </h3>
                <p className="text-xs text-[#5C5650]">
                  CareLoop handles the scheduling, preparation, and follow-through for your appointments.
                </p>
              </div>

              <Button size="sm" variant="primary" href="/join" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Join the CareLoop
              </Button>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8 text-center sm:text-left">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#0E6156] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to all healthcare guides</span>
            </Link>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
