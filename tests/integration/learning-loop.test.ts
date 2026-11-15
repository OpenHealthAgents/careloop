import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  getLearningInsights,
  recommendExecutionStrategy,
  recordCaseLearningOutcome,
} from "@/services/learning-loop-service";

describe("Learning Loop Integration", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  let completedCaseId = "";
  let escalatedCaseId = "";
  const testMemberIds: string[] = [];
  const testReferralIds: string[] = [];
  const testCaseIds: string[] = [];

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

    const m1 = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-LRN-${Date.now()}-1`,
        firstName: "Learn",
        lastName: "One",
        dobYear: 1990,
        geography: "Rural North",
        urbanicity: "RURAL",
        preferredLanguage: "Spanish",
        coverageType: "MEDICAID",
        digitalAccessLevel: "LOW",
        consentOutreach: true,
        consentSms: true,
      },
    });
    const m2 = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-LRN-${Date.now()}-2`,
        firstName: "Learn",
        lastName: "Two",
        dobYear: 1988,
        geography: "Rural North",
        urbanicity: "RURAL",
        preferredLanguage: "Spanish",
        coverageType: "MEDICAID",
        digitalAccessLevel: "LOW",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberIds.push(m1.id, m2.id);

    const r1 = await prisma.referral.create({
      data: {
        tenantId,
        memberId: m1.id,
        externalReferralId: `REF-LRN-${Date.now()}-1`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient therapy",
        specialty: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Rural North",
        networkRequired: "HorizonCare",
        preferredLanguage: "Spanish",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    const r2 = await prisma.referral.create({
      data: {
        tenantId,
        memberId: m2.id,
        externalReferralId: `REF-LRN-${Date.now()}-2`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient therapy",
        specialty: "Outpatient Therapy",
        urgency: "HIGH",
        geography: "Rural North",
        networkRequired: "HorizonCare",
        preferredLanguage: "Spanish",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralIds.push(r1.id, r2.id);

    const now = new Date();
    const earlier = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const c1 = await prisma.case.create({
      data: {
        tenantId,
        referralId: r1.id,
        memberId: m1.id,
        status: "VERIFIED",
        riskLevel: "MEDIUM",
        primaryBarrierCategory: "SOCIAL_LOGISTICAL",
        firstCompletedVisitAt: now,
        createdAt: earlier,
      },
    });
    const c2 = await prisma.case.create({
      data: {
        tenantId,
        referralId: r2.id,
        memberId: m2.id,
        status: "ESCALATED",
        riskLevel: "HIGH",
        primaryBarrierCategory: "SOCIAL_LOGISTICAL",
        humanReviewRequired: true,
        createdAt: earlier,
      },
    });
    completedCaseId = c1.id;
    escalatedCaseId = c2.id;
    testCaseIds.push(c1.id, c2.id);

    await prisma.barrier.createMany({
      data: [
        {
          tenantId,
          caseId: c1.id,
          category: "SOCIAL_LOGISTICAL",
          subBarrier: "Transportation access barrier",
          epistemicStatus: "FACT",
          confidence: 0.9,
          evidenceSummary: "Confirmed transit barrier",
          confirmedByHuman: true,
          resolved: true,
        },
        {
          tenantId,
          caseId: c2.id,
          category: "SOCIAL_LOGISTICAL",
          subBarrier: "Transportation access barrier",
          epistemicStatus: "INFERENCE",
          confidence: 0.72,
          evidenceSummary: "Inferred transit barrier",
          confirmedByHuman: false,
          resolved: false,
        },
      ],
    });

    await prisma.intervention.createMany({
      data: [
        {
          tenantId,
          caseId: c1.id,
          type: "TRANSPORTATION_SUPPORT",
          reason: "Member reported lack of reliable transit.",
          recommendedAction: "Provide non-emergency medical transportation voucher",
          status: "COMPLETED",
        },
        {
          tenantId,
          caseId: c2.id,
          type: "ESCALATION",
          reason: "High-risk unreachable referral.",
          recommendedAction: "Escalate to senior care manager",
          status: "RECOMMENDED",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.executionLearningRecord.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.intervention.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.barrier.deleteMany({ where: { caseId: { in: testCaseIds } } });
    await prisma.case.deleteMany({ where: { id: { in: testCaseIds } } });
    await prisma.referral.deleteMany({ where: { id: { in: testReferralIds } } });
    await prisma.member.deleteMany({ where: { id: { in: testMemberIds } } });
  });

  it("captures context -> barrier -> intervention -> strategy -> outcome and recommends winning strategies", async () => {
    const rec1 = await recordCaseLearningOutcome({ tenantId, caseId: completedCaseId });
    const rec2 = await recordCaseLearningOutcome({ tenantId, caseId: escalatedCaseId });

    expect(rec1.population_segment).toBe("RURAL:MEDICAID:Spanish");
    expect(rec1.barrier.primary_barrier).toBe("SOCIAL_LOGISTICAL");
    expect(rec1.action).toBe("TRANSPORTATION_SUPPORT");
    expect(rec1.execution_strategy).toBe("AUTONOMOUS_AGENT");
    expect(rec1.outcome.verified_completion).toBe(true);
    expect(rec1.outcome.barrier_resolved).toBe(true);
    expect(rec1.outcome.outcome_status).toBe("COMPLETED_VERIFIED");
    expect(rec1.time_to_resolution_ms).toBeGreaterThan(0);

    expect(rec2.execution_strategy).toBe("MANUAL_ESCALATION");
    expect(rec2.outcome.verified_completion).toBe(false);

    const insights = await getLearningInsights(careManagerSession, {
      primaryBarrier: "SOCIAL_LOGISTICAL",
      urbanicity: "RURAL",
    });

    expect(insights.total_records).toBeGreaterThanOrEqual(2);
    expect(insights.context_barrier_strategy_matrix.length).toBeGreaterThanOrEqual(2);
    expect(insights.best_strategies_by_barrier.length).toBeGreaterThanOrEqual(2);
    expect(insights.population_outcomes.some((p) => p.population_segment === "RURAL:MEDICAID:Spanish")).toBe(
      true
    );

    const rec = await recommendExecutionStrategy(careManagerSession, {
      primaryBarrier: "SOCIAL_LOGISTICAL",
      urbanicity: "RURAL",
      coverageType: "MEDICAID",
      preferredLanguage: "Spanish",
    });

    expect(rec.recommendations.length).toBeGreaterThanOrEqual(2);
    expect(rec.recommendations[0].execution_strategy).toBe("AUTONOMOUS_AGENT");
    expect(rec.recommendations[0].recommended_action).toBe("TRANSPORTATION_SUPPORT");
    expect(rec.recommendations[0].verified_completion_rate).toBe(1);
  });
});
