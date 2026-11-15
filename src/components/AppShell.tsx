"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BriefcaseMedical,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  GitPullRequest,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import type { Permission } from "@/lib/auth/rbac";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Care Operations",
    items: [
      { label: "Referral Worklist", href: "/worklist", icon: ClipboardList, permission: "cases.read" },
      { label: "Cases", href: "/cases", icon: BriefcaseMedical, permission: "cases.read" },
      { label: "Appointments", href: "/appointments", icon: CalendarCheck, permission: "appointments.read" },
      { label: "Interventions", href: "/interventions", icon: GitPullRequest, permission: "interventions.read" },
      { label: "Pending Approvals", href: "/approvals", icon: ShieldCheck, permission: "ai.review" },
      { label: "Provider Network", href: "/providers", icon: Stethoscope, permission: "providers.read" },
    ],
  },
  {
    heading: "Population & Intake",
    items: [
      { label: "Members", href: "/members", icon: Users, permission: "members.read" },
      { label: "Referrals Intake", href: "/referrals", icon: FileSpreadsheet, permission: "referrals.read" },
      { label: "Member Portal", href: "/member-portal", icon: HeartHandshake, permission: "cases.read" },
    ],
  },
  {
    heading: "Outcomes & Governance",
    items: [
      { label: "Executive Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.read" },
      { label: "Health Equity", href: "/health-equity", icon: Scale, permission: "equity.read" },
      { label: "Analytics", href: "/analytics", icon: BarChart3, permission: "analytics.read" },
      { label: "Audit Log", href: "/audit-log", icon: ShieldCheck, permission: "audit.read" },
      { label: "Settings", href: "/settings", icon: Settings, permission: "settings.read" },
    ],
  },
];

export interface AppShellProps {
  user: {
    name: string;
    email: string;
    role: string;
    tenantSlug: string;
  };
  permissions: Permission[];
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function SidebarNavContent({
  user,
  permSet,
  pathname,
  onNavigate,
  onLogout,
  signingOut,
}: {
  user: AppShellProps["user"];
  permSet: Set<Permission>;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <div className="border-b border-slate-800 px-5 py-4">
        <Link href="/worklist" onClick={onNavigate} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white">CareLoop</div>
            <div className="text-[11px] font-medium text-slate-400">
              Behavioral Care Coordination
            </div>
          </div>
        </Link>
      </div>

      <nav aria-label="Primary Workspace Navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading}>
            <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.heading}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const allowed = !item.permission || permSet.has(item.permission);
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                if (!allowed) {
                  return (
                    <div
                      key={item.href}
                      aria-disabled="true"
                      title="Role lacks permission for this view"
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] text-slate-600"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-teal-600/20 text-teal-200 ring-1 ring-inset ring-teal-500/40"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Active Session</span>
          <span className="font-mono text-slate-300">{user.tenantSlug}</span>
        </div>
        <div className="mt-1 truncate text-sm font-medium text-white">{user.name}</div>
        <div className="truncate text-xs text-slate-400">{user.email}</div>
        <div className="mt-2 inline-flex rounded border border-teal-700/60 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
          {user.role.replaceAll("_", " ")}
        </div>
        <button
          type="button"
          disabled={signingOut}
          onClick={onLogout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {signingOut ? "Signing out..." : "Switch Role / Sign Out"}
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  permissions,
  title,
  subtitle,
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const permSet = new Set(permissions);
  const [openAtPath, setOpenAtPath] = useState<string | null>(null);
  const mobileNavOpen = openAtPath === pathname;
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenAtPath(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-teal-700 focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarNavContent
            user={user}
            permSet={permSet}
            pathname={pathname}
            onLogout={handleLogout}
            signingOut={signingOut}
          />
        </div>
      </aside>

      {/* Mobile / Tablet Slide-over Navigation Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace Navigation"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setOpenAtPath(null)}
          />
          <aside id="mobile-nav" className="relative z-10 w-72 max-w-[85vw] shadow-2xl">
            <button
              type="button"
              onClick={() => setOpenAtPath(null)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3.5 z-20 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarNavContent
              user={user}
              permSet={permSet}
              pathname={pathname}
              onNavigate={() => setOpenAtPath(null)}
              onLogout={handleLogout}
              signingOut={signingOut}
            />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav"
                aria-label="Open navigation menu"
                onClick={() => setOpenAtPath(pathname)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                    {title}
                  </h1>
                  <span className="hidden rounded border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 sm:inline-flex">
                    Operational Intelligence • Trustworthy Execution
                  </span>
                </div>
                {subtitle && (
                  <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {actions}
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
