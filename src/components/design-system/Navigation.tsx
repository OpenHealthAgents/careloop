"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "./Button";

export interface NavChildItem {
  label: string;
  href: string;
  description?: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChildItem[];
}

export interface NavigationProps {
  navLinks?: NavItem[];
  primaryCtaText?: string;
  primaryCtaHref?: string;
  onPrimaryCtaClick?: () => void;
  className?: string;
}

export const DEFAULT_NAV_LINKS: NavItem[] = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "For You", href: "/for-you" },
  { label: "For Families", href: "/for-families" },
  { label: "Our Approach", href: "/our-approach" },
  {
    label: "Resources",
    href: "/resources",
    children: [
      { label: "Healthcare Guides", href: "/resources", description: "Guides on referrals, caregiving & visits" },
      { label: "FAQ", href: "/faq", description: "Common questions on navigation & privacy" },
      { label: "About CareLoop", href: "/about", description: "Our mission, philosophy, and team" },
      { label: "Contact Us", href: "/contact", description: "Get in touch with our care team" },
    ],
  },
];

export function Navigation({
  navLinks = DEFAULT_NAV_LINKS,
  primaryCtaText = "Join the CareLoop",
  primaryCtaHref = "/join",
  onPrimaryCtaClick,
  className = "",
}: NavigationProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 ${
        scrolled
          ? "border-b border-[#E2DDD5]/80 bg-white/95 shadow-soft backdrop-blur-md"
          : "border-b border-transparent bg-[#FAF8F5]/85 backdrop-blur-xs"
      } ${className}`}
    >
      {/* Accessible Skip-to-Content Link for Screen Readers & Keyboard Navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[#0E6156] focus:px-4 focus:py-2.5 focus:text-xs focus:font-bold focus:text-white focus:shadow-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0E6156]"
      >
        Skip to main content
      </a>

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 transition-opacity hover:opacity-95"
          aria-label="CareLoop Home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#0E6156] via-[#09473F] to-[#06312B] p-1.5 shadow-sm ring-1 ring-[#0E6156]/30">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-full w-full text-white"
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
              <circle cx="23" cy="16" r="2.2" fill="#ffffff" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#191716]">
            Care<span className="font-light text-[#0E6156]">Loop</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main Navigation" ref={dropdownRef}>
          {navLinks.map((link) => {
            const hasChildren = link.children && link.children.length > 0;
            const isChildActive = hasChildren && link.children?.some((child) => pathname === child.href);
            const isActive = pathname === link.href || isChildActive;

            if (hasChildren) {
              const isOpen = openDropdown === link.label;
              return (
                <div key={link.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(isOpen ? null : link.label)}
                    aria-expanded={isOpen}
                    className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      isActive || isOpen
                        ? "bg-[#EBF5F3] text-[#0E6156] font-semibold"
                        : "text-[#5C5650] hover:bg-[#F4F0EB] hover:text-[#191716]"
                    }`}
                  >
                    {link.label}
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-150 ${isOpen ? "rotate-180 text-[#0E6156]" : "text-[#8A8279]"}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl border border-[#E2DDD5] bg-white p-2 shadow-elevated transition-all">
                      {link.children?.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpenDropdown(null)}
                          className={`block rounded-xl px-3 py-2 text-left transition-colors ${
                            pathname === child.href ? "bg-[#EBF5F3] text-[#0E6156]" : "hover:bg-[#FAF8F5]"
                          }`}
                        >
                          <div className="text-xs font-semibold text-[#191716]">{child.label}</div>
                          {child.description && (
                            <div className="text-[11px] text-[#8A8279] mt-0.5 line-clamp-1">{child.description}</div>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={link.label}
                href={link.href}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#EBF5F3] text-[#0E6156] font-semibold"
                    : "text-[#5C5650] hover:bg-[#F4F0EB] hover:text-[#191716]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right CTA / Portal Access */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-xs font-medium text-[#5C5650] hover:text-[#191716] transition-colors"
          >
            Log In
          </Link>

          <Button
            size="sm"
            variant="primary"
            href={onPrimaryCtaClick ? undefined : primaryCtaHref}
            onClick={onPrimaryCtaClick}
            rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            {primaryCtaText}
          </Button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Button
            size="sm"
            variant="primary"
            href={onPrimaryCtaClick ? undefined : primaryCtaHref}
            onClick={onPrimaryCtaClick}
            className="font-bold text-xs px-3.5 py-2 min-h-[44px] min-w-[44px]"
          >
            Join
          </Button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2.5 text-[#5C5650] hover:bg-[#F4F0EB] hover:text-[#191716] transition-colors focus-visible:outline-2 focus-visible:outline-[#0E6156]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-[#E2DDD5] bg-white px-4 pt-3 pb-6 shadow-elevated md:hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              if (link.children) {
                return (
                  <div key={link.label} className="pt-2">
                    <div className="px-3 py-1 text-[11px] font-semibold tracking-wider text-[#8A8279] uppercase">
                      {link.label}
                    </div>
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                          pathname === child.href
                            ? "bg-[#EBF5F3] text-[#0E6156] font-semibold"
                            : "text-[#191716] hover:bg-[#F4F0EB]"
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                );
              }

              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex min-h-[44px] items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#EBF5F3] text-[#0E6156] font-semibold"
                      : "text-[#191716] hover:bg-[#F4F0EB]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-4 border-t border-[#E2DDD5] pt-4 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-center text-sm font-medium text-[#5C5650] hover:bg-[#F4F0EB]"
              >
                Member Log In
              </Link>
              <Button
                variant="primary"
                href={primaryCtaHref}
                onClick={() => {
                  setMobileMenuOpen(false);
                  onPrimaryCtaClick?.();
                }}
                className="w-full justify-center"
              >
                {primaryCtaText}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
