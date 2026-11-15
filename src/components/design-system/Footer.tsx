import React from "react";
import Link from "next/link";
import { ShieldAlert, Lock, HeartHandshake } from "lucide-react";

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  columns?: FooterColumn[];
  className?: string;
}

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Platform",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "For Individuals", href: "/for-you" },
      { label: "For Families & Caregivers", href: "/for-families" },
      { label: "Our Approach", href: "/our-approach" },
      { label: "Healthcare Guides", href: "/resources" },
      { label: "Join the CareLoop", href: "/join" },
    ],
  },
  {
    title: "Support & Trust",
    links: [
      { label: "Frequently Asked Questions", href: "/faq" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Safety & Non-Diagnostic Limits", href: "/our-approach#safety" },
      { label: "Security & Data Rights", href: "/privacy#security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Our Mission", href: "/about" },
      { label: "Contact Care Team", href: "/contact" },
      { label: "Care Operations Portal", href: "/login" },
      { label: "Design System Showcase", href: "/design-system" },
    ],
  },
];

export function Footer({ columns = DEFAULT_COLUMNS, className = "" }: FooterProps) {
  return (
    <footer className={`border-t border-[#E2DDD5] bg-[#06312B] text-[#C8E4DE] ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Brand & Core Positioning */}
          <div className="space-y-4 lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#0E6156] via-[#09473F] to-[#06312B] text-white shadow-sm ring-1 ring-[#0E6156]/40">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-white"
                  aria-hidden="true"
                >
                  <path
                    d="M9 16C9 12.134 12.134 9 16 9C19.866 9 23 12.134 23 16C23 19.866 19.866 23 16 23"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 23C13.2386 23 11 20.7614 11 18C11 15.2386 13.2386 13 16 13C18.7614 13 21 15.2386 21 18C21 20.7614 18.7614 23 16 23Z"
                    stroke="#C8E4DE"
                    strokeWidth="2"
                    strokeDasharray="2 3"
                  />
                  <circle cx="16" cy="9" r="2.2" fill="#5eead4" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Care<span className="font-light text-[#5eead4]">Loop</span>
              </span>
            </Link>

            <p className="text-xs sm:text-sm leading-relaxed text-[#C8E4DE]/80 max-w-sm">
              CareLoop helps people get the healthcare they need — from knowing what to do,
              to actually getting it done. Closing the execution gap between recommendations and completed care.
            </p>

            <div className="flex flex-col gap-2 pt-2 text-xs text-[#C8E4DE]/70">
              <div className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#5eead4]" />
                <span>Zero health data monetization. Strictly confidential.</span>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <HeartHandshake className="h-3.5 w-3.5 text-[#5eead4]" />
                <span>AI intelligence with dedicated human Care Guide backup.</span>
              </div>
            </div>
          </div>

          {/* Links Columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {columns.map((col, idx) => (
              <div key={idx} className="space-y-3">
                <h3 className="text-xs font-semibold tracking-wider text-white uppercase">{col.title}</h3>
                <ul className="space-y-2">
                  {col.links.map((link, linkIdx) => (
                    <li key={linkIdx}>
                      <Link
                        href={link.href}
                        className="text-xs sm:text-sm text-[#C8E4DE]/75 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical Disclaimer & Emergency Advisory */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 text-xs text-[#C8E4DE]/80">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-[#E6A15C] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">
                Important Medical Notice & Emergency Guidance
              </p>
              <p className="leading-relaxed text-[#C8E4DE]/75">
                CareLoop is a healthcare navigation, coordination, and follow-through companion. CareLoop is not a medical device, hospital, or healthcare provider, and does not provide clinical diagnoses, medical advice, or emergency triage. If you are experiencing a medical emergency, please call <strong>911</strong> immediately or go to the nearest emergency room.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row text-xs text-[#C8E4DE]/60">
          <p>© {new Date().getFullYear()} CareLoop Technologies, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
