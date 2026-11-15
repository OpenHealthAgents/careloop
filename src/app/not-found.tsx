import React from "react";
import Link from "next/link";
import { ArrowRight, Compass, HelpCircle, Home, Mail } from "lucide-react";
import { Navigation } from "@/components/design-system/Navigation";
import { Footer } from "@/components/design-system/Footer";
import { Button } from "@/components/design-system";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F5] text-[#191716]">
      <Navigation />

      <main id="main-content" className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0E6156]/20 bg-[#EBF5F3] px-3.5 py-1 text-xs font-semibold text-[#0E6156]">
            <span>Page Not Found</span>
            <span className="text-[#0E6156]/40">•</span>
            <span className="font-normal text-[#5C5650]">Error 404</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-[#191716] leading-tight">
            We couldn&apos;t find that page.
          </h1>

          <p className="text-base text-[#5C5650] leading-relaxed max-w-md mx-auto">
            The link you followed may be outdated, or the address may have a typo. Let&apos;s get you back to where you need to be.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" variant="primary" href="/" leftIcon={<Home className="h-4 w-4" />}>
              Back to Home
            </Button>
            <Button size="lg" variant="secondary" href="/how-it-works" rightIcon={<ArrowRight className="h-4 w-4" />}>
              See how it works
            </Button>
          </div>

          <div className="pt-8 border-t border-[#E2DDD5]/70 grid grid-cols-2 gap-4 text-left max-w-sm mx-auto text-xs">
            <Link
              href="/faq"
              className="flex items-center gap-2 p-3 rounded-2xl border border-[#E2DDD5] bg-white hover:border-[#0E6156]/40 transition-colors"
            >
              <HelpCircle className="h-4 w-4 text-[#0E6156] shrink-0" />
              <div>
                <div className="font-bold text-[#191716]">FAQ</div>
                <div className="text-[11px] text-[#8A8279]">Common questions</div>
              </div>
            </Link>

            <Link
              href="/contact"
              className="flex items-center gap-2 p-3 rounded-2xl border border-[#E2DDD5] bg-white hover:border-[#0E6156]/40 transition-colors"
            >
              <Mail className="h-4 w-4 text-[#0E6156] shrink-0" />
              <div>
                <div className="font-bold text-[#191716]">Contact</div>
                <div className="text-[11px] text-[#8A8279]">Care support team</div>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
