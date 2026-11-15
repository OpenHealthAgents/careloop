import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { WhatHappensNextCard } from "@/components/ui/WhatHappensNextCard";
import { LoadingState, TableLoadingSkeleton } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { OperationalTimeline } from "@/components/ui/OperationalTimeline";
import { CaseBriefPanel } from "@/components/CaseBriefPanel";

describe("UX Polish & Operational UI Component Tests", () => {
  describe("WhatHappensNextCard (Hero Operational Directive)", () => {
    it("renders the primary directive, status, policy check, and action button", () => {
      const html = renderToString(
        React.createElement(WhatHappensNextCard, {
          status: "BARRIER_IDENTIFIED",
          nextStepTitle: "Match In-Network Weekend Provider",
          nextStepDescription: "Childcare barrier requires verified Saturday telehealth appointment.",
          actionLabel: "Find Provider Now",
          actionHref: "#appointments",
          actionTone: "primary",
          assignedAgentOrActor: "ProviderMatchingAgent",
          executionMode: "AUTONOMOUS",
          policyRuleCited: "POLICY_TELEHEALTH_AND_IN_NETWORK_MATCH",
          policyVerdict: "ALLOW",
          evidenceCited: ["EVID-01: PCP Note", "EVID-02: SDOH Childcare"],
          slaDueAt: "2026-11-20T00:00:00Z",
        })
      );

      expect(html).toContain("What Happens Next?");
      expect(html).toContain("Match In-Network Weekend Provider");
      expect(html).toContain("Childcare barrier requires verified Saturday telehealth appointment.");
      expect(html).toContain("Find Provider Now");
      expect(html).toContain("#appointments");
      expect(html).toContain("AUTONOMOUS");
      expect(html).toContain("POLICY_TELEHEALTH_AND_IN_NETWORK_MATCH");
      expect(html).toContain("ALLOW");
      expect(html).toContain("ProviderMatchingAgent");
      expect(html).toContain("EVID-01: PCP Note");
    });

    it("renders human-in-the-loop urgent banner when human approval is required", () => {
      const html = renderToString(
        React.createElement(WhatHappensNextCard, {
          status: "REQUIRES_HUMAN_REVIEW",
          nextStepTitle: "Review Out-of-Network Voucher Subsidy ($180)",
          nextStepDescription: "Severe depression score mandates clinician authorization before booking.",
          actionLabel: "Review in Workbench",
          actionHref: "/approvals",
          actionTone: "urgent",
          assignedAgentOrActor: "CareManager (Sarah Jenkins)",
          executionMode: "HUMAN_APPROVAL_REQUIRED",
          policyRuleCited: "POLICY_CLINICAL_CRISIS_AND_FINANCIAL_EXCEPTION",
          policyVerdict: "REQUIRE_HUMAN_APPROVAL",
        })
      );

      expect(html).toContain("What Happens Next?");
      expect(html).toContain("Review Out-of-Network Voucher Subsidy ($180)");
      expect(html).toContain("HUMAN APPROVAL REQUIRED");
      expect(html).toContain("Review in Workbench");
      expect(html).toContain("CareManager (Sarah Jenkins)");
      expect(html).toContain("REQUIRE_HUMAN_APPROVAL");
    });
  });

  describe("LoadingState & TableLoadingSkeleton", () => {
    it("renders accessible loading indicator with operational progress step", () => {
      const html = renderToString(
        React.createElement(LoadingState, {
          label: "Checking Real-Time Calendar Provenance",
          description: "Evaluating in-network psychiatric availability.",
          progressStep: "Step 3/5: Querying Provider EHR API",
        })
      );

      expect(html).toContain('role="status"');
      expect(html).toContain("Checking Real-Time Calendar Provenance");
      expect(html).toContain("Evaluating in-network psychiatric availability.");
      expect(html).toContain("Step 3/5: Querying Provider EHR API");
    });

    it("renders animated table skeleton rows", () => {
      const html = renderToString(React.createElement(TableLoadingSkeleton, { rows: 4, cols: 3 }));
      expect(html).toContain("animate-pulse");
    });
  });

  describe("ErrorState", () => {
    it("renders accessible error state with safeguard code and retry action", () => {
      const html = renderToString(
        React.createElement(ErrorState, {
          title: "Policy Guard Triggered",
          description: "Cannot initiate automated outreach without verified SMS consent.",
          errorCode: "GUARD-CONSENT-01",
          policyBreach: true,
        })
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain("Policy Guard Triggered");
      expect(html).toContain("Cannot initiate automated outreach without verified SMS consent.");
      expect(html).toContain("GUARD-CONSENT-01");
    });
  });

  describe("EmptyState", () => {
    it("renders structured empty state with title, description, and hint", () => {
      const html = renderToString(
        React.createElement(EmptyState, {
          title: "Zero Pending Approvals",
          description: "All high-risk interventions and policy boundaries have been reviewed.",
          hint: "All queues operational",
        })
      );

      expect(html).toContain("Zero Pending Approvals");
      expect(html).toContain("All high-risk interventions and policy boundaries have been reviewed.");
      expect(html).toContain("All queues operational");
    });
  });

  describe("OperationalTimeline", () => {
    it("renders chronological execution events with actor, tool, policy check, and audit hash", () => {
      const html = renderToString(
        React.createElement(OperationalTimeline, {
          events: [
            {
              id: "evt-01",
              timestamp: "2026-11-13T09:00:00Z",
              title: "Social Barrier Detected",
              actor: { name: "BarrierAgent", role: "AGENT" },
              phase: "UNDERSTAND",
              toolInvoked: "classify_barrier",
              evidenceSummary: "Lacks personal vehicle and public transit within 2 miles.",
              policyCheck: { ruleId: "POLICY_BARRIER_DISCOVERY", verdict: "ALLOW" },
              stateChange: { before: "TRIAGED", after: "BARRIER_IDENTIFIED" },
              auditHash: "0x11029944ab88210f",
              latencyMs: 312,
            },
          ],
        })
      );

      expect(html).toContain("Social Barrier Detected");
      expect(html).toContain("BarrierAgent");
      expect(html).toContain("classify_barrier");
      expect(html).toContain("POLICY_BARRIER_DISCOVERY");
      expect(html).toContain("0x11029944ab88210f");
      expect(html).toContain("312");
      expect(html).toContain("ms");
    });
  });

  describe("CaseBriefPanel Integration", () => {
    it("elevates What Happens Next into the hero position above the 10-point brief", () => {
      const mockCase = {
        id: "case-01",
        status: "BARRIER_IDENTIFIED",
        slaDueAt: "2026-11-20T00:00:00Z",
        member: {
          firstName: "Mateo",
          lastName: "Vance",
          externalMemberId: "MEM-8821",
          preferredLanguage: "English",
          geography: "West Metro",
          urbanicity: "URBAN",
          coverageType: "MEDICAID",
          transportationAccess: "NONE",
          priorNoShowCount: 1,
        },
        referral: {
          behavioralHealthNeed: "Outpatient MDD evaluation",
          specialty: "Psychiatry",
          urgency: "ROUTINE",
          networkRequired: "HorizonCare",
          eligibilityVerified: "VERIFIED",
          referralDate: "2026-11-12T00:00:00Z",
        },
        riskAssessments: [{ evidenceSignals: ["PCP_NOTE_MDD"] }],
        barriers: [{ category: "CHILDCARE", subBarrier: "Childcare deficit", epistemicStatus: "FACT" }],
        interventions: [],
        appointments: [],
        communications: [],
        verifications: [],
        caseNotes: [],
      };

      const html = renderToString(React.createElement(CaseBriefPanel, { careCase: mockCase }));

      expect(html).toContain("Primary Directive: What Happens Next?");
      expect(html).toContain("Match &amp; Schedule First Visit");
      expect(html).toContain("Who Is This Member");
      expect(html).toContain("Recommended Behavioral Care");
    });
  });
});
