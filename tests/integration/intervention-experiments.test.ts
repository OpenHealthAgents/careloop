import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { selectInterventionForBarrier } from "@/domain/interventions/selection-and-experiments";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  createInterventionExperiment,
  getInterventionEffectivenessMetrics,
  recordExperimentOutcome,
} from "@/services/intervention-experiment-service";

describe("Intervention Engine — Barrier->Intervention->Tool Mapping & Measurable Experiments", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  let testCaseId = "";
  let testMemberId = "";
  let testReferralId = "";

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = tenant.id;
    const cm = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: "care.manager@careloop.demo" } },
    });

    careManagerSession = {
      userId: cm.id,
      tenantId,
      tenantSlug: tenant.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-EXP-${Date.now()}`,
        firstName: "Experiment",
        lastName: "Tester",
        dobYear: 1992,
        geography: "Central Metro",
        urbanicity: "URBAN",
        preferredLanguage: "Spanish",
        coverageType: "MEDICAID",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-EXP-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient counseling",
        specialty: "Outpatient Therapy",
        urgency: "MEDIUM",
        geography: "Central Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "Spanish",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "BARRIER_IDENTIFIED",
        riskLevel: "MEDIUM",
        priorityScore: 55,
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.interventionOutcome.deleteMany({
        where: { tenantId, intervention: { caseId: testCaseId } },
      });
      await prisma.intervention.deleteMany({ where: { tenantId, caseId: testCaseId } });
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testReferralId) await prisma.referral.deleteMany({ where: { id: testReferralId } });
    if (testMemberId) await prisma.member.deleteMany({ where: { id: testMemberId } });
  });

  it("maps Barrier -> Intervention -> Tool -> Expected Outcome deterministically", () => {
    const access = selectInterventionForBarrier({ caseId: "c1", barrier: "ACCESS" });
    expect(access.tool).toBe("searchProviders");
    expect(access.interventionType).toBe("ALTERNATIVE_PROVIDER_SEARCH");
    expect(access.expectedOutcome.length).toBeGreaterThan(0);

    const scheduling = selectInterventionForBarrier({
      caseId: "c1",
      barrier: "SCHEDULING_FRICTION",
    });
    expect(scheduling.tool).toBe("requestScheduling");
    expect(scheduling.interventionType).toBe("ASSISTED_SCHEDULING");

    const comm = selectInterventionForBarrier({
      caseId: "c1",
      barrier: "COMMUNICATION_BARRIER",
    });
    expect(comm.tool).toBe("sendMemberMessage");
    expect(comm.interventionType).toBe("LANGUAGE_COMPATIBLE_PROVIDER_SEARCH");

    const admin = selectInterventionForBarrier({
      caseId: "c1",
      barrier: "ADMINISTRATIVE_BARRIER",
    });
    expect(admin.tool).toBe("createHumanTask");
    expect(admin.interventionType).toBe("REFERRAL_COMPLETION_ASSISTANCE");
  });

  it("persists interventions as measurable experiments and computes effectiveness metrics", async () => {
    const exp1 = await createInterventionExperiment({
      session: careManagerSession,
      caseId: testCaseId,
      barrier: "ACCESS",
      subBarrier: "provider shortage",
      evidenceSignals: ["0 verified slots in Central Metro"],
      correlationId: "exp-1",
    });
    expect(exp1.spec.tool).toBe("searchProviders");

    const exp2 = await createInterventionExperiment({
      session: careManagerSession,
      caseId: testCaseId,
      barrier: "COMMUNICATION",
      subBarrier: "language",
      evidenceSignals: ["Member prefers Spanish"],
      correlationId: "exp-2",
    });
    expect(exp2.spec.tool).toBe("sendMemberMessage");

    await recordExperimentOutcome({
      session: careManagerSession,
      interventionId: exp1.experimentId,
      outcomeStatus: "RESOLVED",
      summary: "Expanded provider search identified 2 verified in-network providers.",
      barriersResolved: true,
      correlationId: "exp-1-out",
    });

    await recordExperimentOutcome({
      session: careManagerSession,
      interventionId: exp2.experimentId,
      outcomeStatus: "UNRESOLVED",
      summary: "Member did not respond to initial portal outreach.",
      barriersResolved: false,
      followUpRequired: true,
      correlationId: "exp-2-out",
    });

    const report = await getInterventionEffectivenessMetrics(careManagerSession);
    expect(report.totalExperiments).toBeGreaterThanOrEqual(2);
    expect(report.evaluatedExperiments).toBeGreaterThanOrEqual(2);
    expect(report.overallEffectivenessRate).toBeGreaterThan(0);

    const accessRow = report.byIntervention.find(
      (r) =>
        r.interventionType === "ALTERNATIVE_PROVIDER_SEARCH" &&
        r.barrierCategory === "ACCESS"
    );
    expect(accessRow).toBeDefined();
    expect(accessRow!.effectiveExperiments).toBeGreaterThanOrEqual(1);
  });
});
