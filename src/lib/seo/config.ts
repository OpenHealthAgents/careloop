export const SITE_CONFIG = {
  name: "CareLoop",
  legalName: "CareLoop Health Inc.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://careloop.health",
  tagline: "Healthcare is complicated. Getting care shouldn't be.",
  description:
    "CareLoop is an intelligent healthcare navigation and follow-through companion. We turn doctor recommendations, specialist referrals, and care plans into completed care.",
  locale: "en_US",
  twitterHandle: "@CareLoopHealth",
};

/**
 * Generates Schema.org JSON-LD for the CareLoop Organization
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_CONFIG.name,
    legalName: SITE_CONFIG.legalName,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/careloop-logo.png`,
    description: SITE_CONFIG.description,
    sameAs: [
      "https://twitter.com/CareLoopHealth",
      "https://linkedin.com/company/careloop-health",
    ],
    knowsAbout: [
      "Healthcare Navigation",
      "Patient Navigation",
      "Care Coordination",
      "Healthcare Organization",
      "Doctor Appointments",
      "Caregiver Support",
      "Healthcare Follow-Through",
    ],
  };
}

/**
 * Generates Schema.org JSON-LD for the CareLoop WebSite
 */
export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_CONFIG.url}/faq?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Generates Schema.org JSON-LD for FAQ Page
 */
export function getFaqSchema(faqs: { question: string; answerText: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answerText,
      },
    })),
  };
}
