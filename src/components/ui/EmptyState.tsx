import React from "react";
import { Inbox, LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  hint,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center transition-all">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-4 ring-slate-50">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500 font-normal">{description}</p>
      {hint && (
        <span className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {hint}
        </span>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
