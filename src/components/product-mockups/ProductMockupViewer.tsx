"use client";

import React, { useState } from "react";
import {
  Sun,
  Compass,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { ScreenToday } from "./ScreenToday";
import { ScreenCareJourney } from "./ScreenCareJourney";
import { ScreenNextBestAction } from "./ScreenNextBestAction";
import { ScreenAppointmentPrep } from "./ScreenAppointmentPrep";
import { ScreenFollowThrough } from "./ScreenFollowThrough";

export type MockupScreenId =
  | "today"
  | "journey"
  | "next-action"
  | "prep"
  | "follow-through";

export interface ProductMockupViewerProps {
  initialScreen?: MockupScreenId;
  showTabs?: boolean;
  className?: string;
}

const SCREENS = [
  {
    id: "today" as MockupScreenId,
    title: "1. Today",
    shortTitle: "Today",
    icon: Sun,
    url: "careloop.app/today",
    description: "Daily overview of next steps, upcoming appointments, questions, and progress.",
  },
  {
    id: "journey" as MockupScreenId,
    title: "2. Care Journey",
    shortTitle: "Care Journey",
    icon: Compass,
    url: "careloop.app/journeys/cardiology",
    description: "End-to-end journey roadmap: Understand → Choose → Schedule → Prepare → Follow up.",
  },
  {
    id: "next-action" as MockupScreenId,
    title: "3. Next Best Action",
    shortTitle: "Next Best Action",
    icon: ArrowRight,
    url: "careloop.app/actions/schedule",
    description: "Concrete next action with why it matters, what to expect, and potential providers.",
  },
  {
    id: "prep" as MockupScreenId,
    title: "4. Appointment Prep",
    shortTitle: "Appointment Prep",
    icon: ClipboardList,
    url: "careloop.app/prep/dr-lin",
    description: "Questions to ask, documents to bring, medications to review, and symptoms to mention.",
  },
  {
    id: "follow-through" as MockupScreenId,
    title: "5. Follow Through",
    shortTitle: "Follow Through",
    icon: CheckCircle2,
    url: "careloop.app/follow-through/cardiology",
    description: "'How did it go?' prompt, completed takeaways, next recommended action, and reminders.",
  },
];

export function ProductMockupViewer({
  initialScreen = "today",
  showTabs = true,
  className = "",
}: ProductMockupViewerProps) {
  const [activeScreen, setActiveScreen] = useState<MockupScreenId>(initialScreen);

  const currentScreenMeta =
    SCREENS.find((s) => s.id === activeScreen) || SCREENS[0];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Interactive Screen Selector Tabs */}
      {showTabs && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Product UI preview screens">
            {SCREENS.map((sc) => {
              const Icon = sc.icon;
              const isActive = activeScreen === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  id={`tab-${sc.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${sc.id}`}
                  onClick={() => setActiveScreen(sc.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-[#0E6156] ${
                    isActive
                      ? "bg-[#0E6156] text-white shadow-soft"
                      : "bg-white text-[#5C5650] border border-[#E2DDD5] hover:bg-[#FAF8F5] hover:text-[#191716]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-[#8A8279]"}`} aria-hidden="true" />
                  <span>{sc.shortTitle}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-[#8A8279]">
            <span className="font-semibold text-[#0E6156]">{currentScreenMeta.title}:</span>
            <span className="line-clamp-1">{currentScreenMeta.description}</span>
          </div>
        </div>
      )}

      {/* Realistic Product Application Window */}
      <div className="overflow-hidden rounded-3xl border border-[#E2DDD5] bg-white shadow-elevated transition-all">
        {/* App Titlebar / Chrome */}
        <div className="flex items-center justify-between border-b border-[#E2DDD5]/80 bg-[#FAF8F5] px-4 py-3 sm:px-6">
          {/* macOS window controls */}
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#E57373] opacity-80" />
            <span className="h-3 w-3 rounded-full bg-[#FFB74D] opacity-80" />
            <span className="h-3 w-3 rounded-full bg-[#81C784] opacity-80" />
          </div>

          {/* Simulated URL bar */}
          <div className="flex items-center gap-2 rounded-full border border-[#E2DDD5] bg-white px-4 py-1 text-xs text-[#5C5650] shadow-2xs max-w-xs sm:max-w-md w-full justify-center">
            <span className="h-2 w-2 rounded-full bg-[#0E6156]" />
            <span className="font-mono text-[11px] font-medium text-[#191716] truncate">
              https://{currentScreenMeta.url}
            </span>
          </div>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0E6156]">
            <span className="hidden sm:inline-block">CareLoop v2.4</span>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase">
              Live
            </span>
          </div>
        </div>

        {/* Dynamic Screen View */}
        <div
          id={`panel-${activeScreen}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeScreen}`}
          tabIndex={0}
          className="overflow-y-auto max-h-[750px] focus:outline-hidden"
        >
          {activeScreen === "today" && (
            <ScreenToday />
          )}

          {activeScreen === "journey" && (
            <ScreenCareJourney />
          )}

          {activeScreen === "next-action" && (
            <ScreenNextBestAction
              onContinue={() => setActiveScreen("prep")}
            />
          )}

          {activeScreen === "prep" && (
            <ScreenAppointmentPrep />
          )}

          {activeScreen === "follow-through" && (
            <ScreenFollowThrough
              onTakeNextAction={() => setActiveScreen("today")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
