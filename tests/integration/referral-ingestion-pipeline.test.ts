import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runReferralIngestionPipeline } from "@/services/ingestion-service";

describe("Referral Ingestion Pipeline (UPLOAD -> VALIDATE -> NORMALIZE -> DEDUPLICATE -> CREATE_REFERRALS -> CREATE_CASES -> PRIORITIZE -> START_AGENT)", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  const createdCaseIds: string[] = [];
  const createdReferralIds: string[] = [];
  const createdMemberIds: string[] = [];
  let createdBatchId = "";

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
  });

  afterAll(async () => {
    for (const caseId of createdCaseIds) {
      await prisma.evidence.deleteMany({ where: { tenantId, caseId } });
      await prisma.executionJournalEvent.deleteMany({ where: { tenantId, caseId } });
      await prisma.aIDecisionTrace.deleteMany({ where: { tenantId, caseId } });
      await prisma.agentRun.deleteMany({ where: { tenantId, caseId } });
      await prisma.approvalRequest.deleteMany({ where: { tenantId, caseId } });
      await prisma.riskAssessment.deleteMany({ where: { tenantId, caseId } });
      await prisma.barrier.deleteMany({ where: { tenantId, caseId } });
      await prisma.workflowEvent.deleteMany({ where: { tenantId, caseId } });
      await prisma.case.deleteMany({ where: { id: caseId } });
    }
    if (createdReferralIds.length > 0) {
      await prisma.referral.deleteMany({ where: { id: { in: createdReferralIds } } });
    }
    if (createdMemberIds.length > 0) {
      await prisma.consent.deleteMany({ where: { memberId: { in: createdMemberIds } } });
      await prisma.member.deleteMany({ where: { id: { in: createdMemberIds } } });
    }
    if (createdBatchId) {
      await prisma.ingestionBatch.deleteMany({ where: { id: createdBatchId } });
    }
  });

  it("executes all 8 stages, deduplicates & reports errors, prioritizes cases, starts agent, and never auto-initiates outreach", async () => {
    const ts = Date.now();
    const extRef1 = `REF-PIPE-${ts}-1`;
    const extMem1 = `MEM-PIPE-${ts}-1`;

    const today = new Date().toISOString().slice(0, 10);
    const csvText = [
      "member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,geography,network,eligibility_verified,preferred_language,urgency,operational_notes",
      `${extMem1},Pipeline,Tester,${extRef1},${today},Anxiety and depression counseling,Outpatient Therapy,Central Metro,HorizonCare,VERIFIED,English,EXPEDITED,Portal preferred`,
      // Duplicate in file
      `${extMem1},Pipeline,Tester,${extRef1},${today},Anxiety and depression counseling,Outpatient Therapy,Central Metro,HorizonCare,VERIFIED,English,EXPEDITED,Duplicate row`,
      // Invalid row (missing specialty & bad date)
      `MEM-PIPE-BAD-${ts},Bad,Row,REF-PIPE-BAD-${ts},invalid-date,Therapy,,Central Metro,HorizonCare,VERIFIED,English,ROUTINE,Malformed`,
    ].join("\n");

    const result = await runReferralIngestionPipeline({
      session: careManagerSession,
      fileName: `pipeline-test-${ts}.csv`,
      csvText,
      correlationId: `pipe-${ts}`,
    });

    createdBatchId = result.batch.id;
    for (const c of result.createdCases) {
      createdCaseIds.push(c.caseId);
      createdReferralIds.push(c.referralId);
    }
    const mem = await prisma.member.findFirst({
      where: { tenantId, externalMemberId: extMem1 },
    });
    if (mem) createdMemberIds.push(mem.id);

    expect(result.stagesExecuted).toEqual([
      "UPLOAD",
      "VALIDATE",
      "NORMALIZE",
      "DEDUPLICATE",
      "CREATE_REFERRALS",
      "CREATE_CASES",
      "PRIORITIZE",
      "START_AGENT",
    ]);

    expect(result.errors.filter((e) => e.errorType === "PERSISTENCE_ERROR")).toEqual([]);
    expect(result.createdCases).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.createdCases[0].riskTier).toBeTruthy();
    expect(result.createdCases[0].agentRunId).toBeTruthy();
    expect(result.createdCases[0].outreachInitiated).toBe(false);

    // Confirm zero outbound communications were auto-initiated
    const commsCount = await prisma.communication.count({
      where: { tenantId, caseId: result.createdCases[0].caseId },
    });
    expect(commsCount).toBe(0);
  });
});
