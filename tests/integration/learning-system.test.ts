import { beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME, SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  captureDetailedLearningSnapshot,
  findOptimalInterventionWithLeastFriction,
  listPolicyGovernanceProposals,
  reviewPolicyGovernanceProposal,
  submitPolicyGovernanceProposal,
} from "@/services/learning-loop-service";
import { PolicyGovernanceViolationError } from "@/domain/learning/learning-system";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { GET as getOptimalInterventionRoute } from "@/app/api/analytics/learning/optimal-intervention/route";
import {
  GET as getProposalsRoute,
  POST as postProposalRoute,
} from "@/app/api/governance/policy-proposals/route";
import { POST as postReviewRoute } from "@/app/api/governance/policy-proposals/[id]/review/route";

describe("Learning System & Policy Governance Integration Tests", () => {
  let horizonTenantId = "";
  let supervisorSession: SessionUser;
  let careManagerSession: SessionUser;
  let supervisorToken = "";
  let careManagerToken = "";
  let testCaseId = "";
  let testMemberId = "";
  let testReferralId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    horizonTenantId = horizon.id;

    const sup = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.ADMIN },
    });
    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });

    supervisorSession = {
      userId: sup.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: sup.email,
      name: sup.name,
      role: sup.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    careManagerSession = {
      userId: cm.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    supervisorToken = createSessionToken(supervisorSession);
    careManagerToken = createSessionToken(careManagerSession);

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId: horizonTenantId,
        externalMemberId: `MEM-LEARN-${suffix}`,
        firstName: "Mateo",
        lastName: "Navarro",
        preferredLanguage: "Spanish",
        geography: "West Metro",
        urbanicity: "URBAN",
        coverageType: "MEDICAID",
        raceEthnicityCohort: "Hispanic/Latino",
        ageGroupCohort: "ADULT_18_39",
        digitalAccessLevel: "LIMITED",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-LEARN-${suffix}`,
        referralDate: new Date(Date.now() - 10 * 86400000),
        behavioralHealthNeed: "Outpatient Psychotherapy",
        specialty: "Outpatient Behavioral Health",
        urgency: "HIGH",
        geography: "West Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "Spanish",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        referralId: referral.id,
        status: "VERIFIED",
        goal: "First completed outpatient behavioral health visit",
        priorityScore: 78,
        riskLevel: "MEDIUM",
        primaryBarrierCategory: "SOCIAL_LOGISTICAL",
        primaryBarrierCode: "NO_RELIABLE_TRANSIT",
        firstCompletedVisitAt: new Date(),
        closedAt: new Date(),
        closureReason: "First behavioral-health visit verified",
      },
    });
    testCaseId = careCase.id;

    await prisma.barrier.create({
      data: {
        tenantId: horizonTenantId,
        caseId: careCase.id,
        category: "SOCIAL_LOGISTICAL",
        subBarrier: "NO_RELIABLE_TRANSIT",
        epistemicStatus: "FACT",
        confidence: 0.96,
        evidenceSummary: "Operational notes confirm member lacks transit in West Metro",
        confirmedByHuman: true,
        resolved: true,
      },
    });

    await prisma.intervention.create({
      data: {
        tenantId: horizonTenantId,
        caseId: careCase.id,
        type: "TRANSPORTATION_SUPPORT",
        reason: "Issue complimentary rideshare voucher",
        recommendedAction: "Automated Rideshare Transit Voucher",
        status: "COMPLETED",
        automationEligible: true,
      },
    });

    await prisma.workflowEvent.createMany({
      data: [
        {
          tenantId: horizonTenantId,
          caseId: careCase.id,
          eventType: "CASE_CREATED",
          fromStatus: "NEW",
          toStatus: "NEW",
          actorId: careManagerSession.userId,
          actorRole: careManagerSession.role,
          reason: "Initial referral ingested and case created",
        },
        {
          tenantId: horizonTenantId,
          caseId: careCase.id,
          eventType: "COMPLETION_VERIFIED",
          fromStatus: "APPOINTMENT_COMPLETED",
          toStatus: "VERIFIED",
          actorId: careManagerSession.userId,
          actorRole: careManagerSession.role,
          reason: "Dual-source verification confirmed clinic encounter",
        },
      ],
    });
  });

  describe("Capture Detailed Learning Snapshot (All 10 Dimensions)", () => {
    it("captures initial context, barrier, confidence, intervention, execution path, human involvement, time, cost, outcome, and equity cohort", async () => {
      const snapshot = await captureDetailedLearningSnapshot({
        tenantId: horizonTenantId,
        caseId: testCaseId,
      });

      // 1. Initial Context
      expect(snapshot.initialContext.memberId).toBe(testMemberId);
      expect(snapshot.initialContext.coverageType).toBe("MEDICAID");
      expect(snapshot.initialContext.preferredLanguage).toBe("Spanish");
      expect(snapshot.initialContext.urbanicity).toBe("URBAN");
      expect(snapshot.initialContext.priorityScore).toBe(78);

      // 2. Barrier
      expect(snapshot.barrier.primaryCategory).toBe("SOCIAL_LOGISTICAL");
      expect(snapshot.barrier.subBarrierCode).toBe("NO_RELIABLE_TRANSIT");
      expect(snapshot.barrier.confidence).toBe(0.96);

      // 3. Confidence
      expect(snapshot.confidence.barrierDetectionConfidence).toBeGreaterThan(0.9);

      // 4. Intervention
      expect(snapshot.intervention.interventionType).toBe("TRANSPORTATION_SUPPORT");

      // 5. Execution Path
      expect(snapshot.executionPath.stateSequence).toContain("VERIFIED");

      // 6. Human Involvement
      expect(snapshot.humanInvolvement.careManagerLaborMinutes).toBeGreaterThan(0);

      // 7. Time
      expect(snapshot.time.timeToCompletionDays).toBeGreaterThan(0);

      // 8. Cost
      expect(snapshot.cost.voucherCostUSD).toBe(25.0);
      expect(snapshot.cost.totalCostUSD).toBeGreaterThan(0);

      // 9. Outcome
      expect(snapshot.outcome.verifiedCompletion).toBe(true);
      expect(snapshot.outcome.finalStatus).toBe("VERIFIED");

      // 10. Equity Cohort
      expect(snapshot.equityCohort.coverageType).toBe("MEDICAID");
      expect(snapshot.equityCohort.preferredLanguage).toBe("Spanish");
    });
  });

  describe("Optimal Intervention Analytics Query", () => {
    it("answers: which intervention has historically produced the best completion outcome with the least friction?", async () => {
      const result = await findOptimalInterventionWithLeastFriction(careManagerSession, {
        barrierCategory: "SOCIAL_LOGISTICAL",
        subBarrierCode: "NO_RELIABLE_TRANSIT",
        context: {
          coverageType: "MEDICAID",
          preferredLanguage: "Spanish",
          urbanicity: "URBAN",
        },
      });

      expect(result.matchingHistoricalCasesCount).toBeGreaterThan(0);
      expect(result.bestIntervention).toBeDefined();
      expect(result.bestIntervention.frictionScore).toBeGreaterThanOrEqual(0);
      expect(result.bestIntervention.frictionScore).toBeLessThanOrEqual(100);
      expect(result.bestIntervention.compositeEfficiencyScore).toBeGreaterThan(0);
      expect(result.clinicalRationale).toBeTruthy();
      expect(result.governanceStatus).toBe("ADVISORY_PROPOSAL_ONLY");
      expect(result.prohibitsAutonomousMutation).toBe(true);
    });
  });

  describe("Policy Governance & Anti-Self-Modification Layer", () => {
    let proposalId = "";

    it("allows care managers to submit an advisory policy proposal", async () => {
      const proposal = await submitPolicyGovernanceProposal(careManagerSession, {
        proposalType: "INTERVENTION_MAPPING_OPTIMIZATION",
        targetBarrierCategory: "SOCIAL_LOGISTICAL",
        recommendedInterventionType: "TRANSPORTATION_SUPPORT",
        historicalEvidenceN: 140,
        historicalCompletionRatePct: 68.2,
        frictionReductionPct: 54.0,
        rationale: "Automated rideshare vouchers achieve 68.2% completion with 54% less labor friction.",
      });

      proposalId = proposal.id;
      expect(proposal.id).toBeTruthy();
      expect(proposal.status).toBe("PENDING_SUPERVISOR_REVIEW");

      const list = listPolicyGovernanceProposals(horizonTenantId);
      expect(list.some((p) => p.id === proposalId)).toBe(true);
    });

    it("prohibits non-supervisor roles from autonomously approving policy proposals", async () => {
      await expect(
        reviewPolicyGovernanceProposal(careManagerSession, proposalId, {
          decision: "APPROVE",
          clinicalNotes: "Attempting unprivileged approval",
        })
      ).rejects.toThrowError(PolicyGovernanceViolationError);
    });

    it("allows clinical supervisors to formally review, approve, and record audit trail", async () => {
      const finalized = await reviewPolicyGovernanceProposal(supervisorSession, proposalId, {
        decision: "APPROVE",
        clinicalNotes: "Approved based on solid N=140 evidence and 54% friction reduction.",
      });

      expect(finalized.status).toBe("APPROVED");
      expect(finalized.reviewedByRole).toBe(UserRole.ADMIN);

      // Verify tamper-evident audit event was recorded
      const auditEvt = await prisma.auditEvent.findFirst({
        where: {
          tenantId: horizonTenantId,
          action: "POLICY_GOVERNANCE_PROPOSAL_APPROVED",
          entityId: proposalId,
        },
      });
      expect(auditEvt).toBeDefined();
      expect(auditEvt!.actorRole).toBe(UserRole.ADMIN);
    });
  });

  describe("API Endpoints", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockCookieMap.clear();
      const req = new Request("http://localhost:3000/api/analytics/learning/optimal-intervention");
      const res = await getOptimalInterventionRoute(req);
      expect(res.status).toBe(401);
    });

    it("GET /api/analytics/learning/optimal-intervention returns least-friction recommendations", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);
      const req = new Request(
        "http://localhost:3000/api/analytics/learning/optimal-intervention?barrierCategory=SOCIAL_LOGISTICAL&coverageType=MEDICAID"
      );
      const res = await getOptimalInterventionRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.bestIntervention).toBeDefined();
      expect(json.governanceStatus).toBe("ADVISORY_PROPOSAL_ONLY");
    });

    it("POST /api/governance/policy-proposals creates proposal and review endpoint finalizes it", async () => {
      mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);
      const postReq = new Request("http://localhost:3000/api/governance/policy-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalType: "PRIORITIZATION_WEIGHT_TUNE",
          targetBarrierCategory: "COMMUNICATION",
          recommendedInterventionType: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
          historicalEvidenceN: 85,
          historicalCompletionRatePct: 62.0,
          frictionReductionPct: 40.0,
          rationale: "Language-concordant match draft reduces member drop-off by 40%.",
        }),
      });

      const postRes = await postProposalRoute(postReq);
      expect(postRes.status).toBe(201);
      const created = await postRes.json();

      // Clinical supervisor approves via review route
      mockCookieMap.set(SESSION_COOKIE_NAME, supervisorToken);
      const reviewReq = new Request(
        `http://localhost:3000/api/governance/policy-proposals/${created.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: "APPROVE",
            clinicalNotes: "Clinical supervisor verified language concordance impact.",
          }),
        }
      );

      const reviewRes = await postReviewRoute(reviewReq, { params: Promise.resolve({ id: created.id }) });
      expect(reviewRes.status).toBe(200);
      const approved = await reviewRes.json();
      expect(approved.status).toBe("APPROVED");
    });
  });
});
