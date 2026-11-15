import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordAIDecisionTrace } from "@/services/decision-trace-service";
import {
  getActiveVersionManifest,
  getVersionProvenanceForTrace,
  rollbackTenantVersion,
} from "@/services/version-service";

describe("Agent Versioning & Rollback Integration (PostgreSQL + Audit + RBAC)", () => {
  let tenantAId = "";
  let tenantBId = "";
  let adminSessionA: SessionUser;
  let careManagerSessionA: SessionUser;
  let adminSessionB: SessionUser;

  let testMemberAId = "";
  let testReferralAId = "";
  let testCaseAId = "";
  const createdTraceIds: string[] = [];

  beforeAll(async () => {
    const tenantA = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const tenantB = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const adminA = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId: tenantAId, email: "admin@careloop.demo" } },
    });
    const cmA = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId: tenantAId, email: "care.manager@careloop.demo" } },
    });
    const adminB = await prisma.user.findFirstOrThrow({
      where: { tenantId: tenantBId, role: UserRole.ADMIN },
    });

    adminSessionA = {
      userId: adminA.id,
      tenantId: tenantAId,
      tenantSlug: tenantA.slug,
      email: adminA.email,
      name: adminA.name,
      role: adminA.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    careManagerSessionA = {
      userId: cmA.id,
      tenantId: tenantAId,
      tenantSlug: tenantA.slug,
      email: cmA.email,
      name: cmA.name,
      role: cmA.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    adminSessionB = {
      userId: adminB.id,
      tenantId: tenantBId,
      tenantSlug: tenantB.slug,
      email: adminB.email,
      name: adminB.name,
      role: adminB.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const memberA = await prisma.member.create({
      data: {
        tenantId: tenantAId,
        externalMemberId: `MEM-VER-${Date.now()}`,
        firstName: "Version",
        lastName: "Tester",
        dobYear: 1992,
        geography: "West Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "COMMERCIAL",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberAId = memberA.id;

    const referralA = await prisma.referral.create({
      data: {
        tenantId: tenantAId,
        memberId: memberA.id,
        externalReferralId: `REF-VER-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient psychiatric evaluation",
        specialty: "Psychiatry",
        urgency: "ROUTINE",
        geography: "West Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralAId = referralA.id;

    const careCaseA = await prisma.case.create({
      data: {
        tenantId: tenantAId,
        referralId: referralA.id,
        memberId: memberA.id,
        status: "NEW",
        riskLevel: "MEDIUM",
        priorityScore: 50,
      },
    });
    testCaseAId = careCaseA.id;
  });

  afterAll(async () => {
    await prisma.aIDecisionTrace.deleteMany({ where: { id: { in: createdTraceIds } } });
    await prisma.auditEvent.deleteMany({
      where: { tenantId: tenantAId, action: "AGENT_VERSION_ROLLBACK" },
    });
    await prisma.case.deleteMany({ where: { id: testCaseAId } });
    await prisma.referral.deleteMany({ where: { id: testReferralAId } });
    await prisma.member.deleteMany({ where: { id: testMemberAId } });

    // Reset tenant settings back to default
    await prisma.tenant.update({
      where: { id: tenantAId },
      data: { settings: {} },
    });
  });

  it("determines exact 9-component version provenance for any decision action", async () => {
    // 1. Record decision trace under default v2.1.0
    const trace = await recordAIDecisionTrace({
      tenantId: tenantAId,
      caseId: testCaseAId,
      decision: "Coordinate psychiatric evaluation",
      confidence: 0.92,
      evidence: ["Specialty match: Psychiatry"],
      policyResult: "ALLOW",
      toolSelected: "search_providers",
      humanApprovalRequired: false,
    });
    createdTraceIds.push(trace.decision_id);

    // 2. Fetch version provenance answering: Which version produced this action?
    const provenanceResult = await getVersionProvenanceForTrace(
      trace.decision_id,
      careManagerSessionA
    );

    expect(provenanceResult.traceId).toBe(trace.decision_id);
    expect(provenanceResult.caseId).toBe(testCaseAId);
    expect(provenanceResult.action).toBe("search_providers");
    expect(provenanceResult.isReproducible).toBe(true);

    // Check all 9 component versions
    const v = provenanceResult.versions;
    expect(v.agent).toBe("CareLoopCaseOrchestrator@2.1.0");
    expect(v.prompt).toBe("careloop-prompts@2.1.0");
    expect(v.model).toBe("careloop-orchestrator-v2.1@2.1.0");
    expect(v.tool).toBe("tool-registry@2.1.0");
    expect(v.policy).toBe("policy-engine@2.1.0");
    expect(v.workflow).toBe("workflow@2.0.0");
    expect(v.barrierClassifier).toBe("barrier-classifier@2.1.0");
    expect(v.riskModel).toBe("risk-model@2.1.0");
    expect(v.interventionStrategy).toBe("intervention-strategy@2.0.0");

    expect(provenanceResult.manifest.signature).toBeDefined();
  });

  it("executes version rollback with auditability, RBAC protection, and updates active execution version", async () => {
    // 1. Care manager cannot execute rollback -> AuthorizationError
    await expect(
      rollbackTenantVersion({
        session: careManagerSessionA,
        targetVersion: "v2.0.0",
        reason: "Unauthorized attempt",
      })
    ).rejects.toThrow(AuthorizationError);

    // 2. Rollback requires substantive reason -> ValidationError
    await expect(
      rollbackTenantVersion({
        session: adminSessionA,
        targetVersion: "v2.0.0",
        reason: "bad",
      })
    ).rejects.toThrow(ValidationError);

    // 3. Rollback from v2.1.0 to v2.0.0 by Admin
    const rollbackRes = await rollbackTenantVersion({
      session: adminSessionA,
      targetVersion: "v2.0.0",
      reason: "Rollback to stable v2.0.0 for regression verification",
      correlationId: `corr-rollback-${Date.now()}`,
    });

    expect(rollbackRes.success).toBe(true);
    expect(rollbackRes.previousVersion).toBe("v2.1.0");
    expect(rollbackRes.currentVersion).toBe("v2.0.0");
    expect(rollbackRes.manifest.versionLabel).toBe("v2.0.0");

    // 4. Verify tenant active manifest reflects rollback
    const activeManifest = await getActiveVersionManifest(tenantAId);
    expect(activeManifest.versionLabel).toBe("v2.0.0");

    // 5. Verify immutable AGENT_VERSION_ROLLBACK audit log was recorded
    const rollbackAudit = await prisma.auditEvent.findFirst({
      where: { tenantId: tenantAId, action: "AGENT_VERSION_ROLLBACK" },
      orderBy: { createdAt: "desc" },
    });
    expect(rollbackAudit).toBeDefined();
    expect(rollbackAudit?.actorId).toBe(adminSessionA.userId);
    expect(JSON.stringify(rollbackAudit?.previousState)).toContain("v2.1.0");
    expect(JSON.stringify(rollbackAudit?.newState)).toContain("v2.0.0");

    // 6. Record subsequent decision under rolled-back v2.0.0
    const postRollbackTrace = await recordAIDecisionTrace({
      tenantId: tenantAId,
      caseId: testCaseAId,
      decision: "Schedule appointment under v2.0.0",
      confidence: 0.88,
      evidence: ["Slot confirmed"],
      policyResult: "ALLOW",
      toolSelected: "schedule_appointment",
      humanApprovalRequired: false,
    });
    createdTraceIds.push(postRollbackTrace.decision_id);

    // 7. Provenance confirms it was produced by v2.0.0
    const rolledBackProvenance = await getVersionProvenanceForTrace(
      postRollbackTrace.decision_id,
      careManagerSessionA
    );
    expect(rolledBackProvenance.versions.agent).toBe("CareLoopCaseOrchestrator@2.0.0");
    expect(rolledBackProvenance.versions.model).toBe("careloop-orchestrator-v2@2.0.0");
    expect(rolledBackProvenance.versions.policy).toBe("policy-engine@2.0.0");

    // 8. Roll forward back to v2.1.0
    await rollbackTenantVersion({
      session: adminSessionA,
      targetVersion: "v2.1.0",
      reason: "Verification complete, restore v2.1.0",
    });
    const restoredManifest = await getActiveVersionManifest(tenantAId);
    expect(restoredManifest.versionLabel).toBe("v2.1.0");
  });

  it("enforces tenant isolation: blocks cross-tenant provenance lookup (404)", async () => {
    const trace = await recordAIDecisionTrace({
      tenantId: tenantAId,
      caseId: testCaseAId,
      decision: "Isolated tenant decision",
      confidence: 0.9,
      evidence: ["Signal X"],
      policyResult: "ALLOW",
      toolSelected: "run_ai_assessment",
      humanApprovalRequired: false,
    });
    createdTraceIds.push(trace.decision_id);

    // Tenant B attempts to read Tenant A's trace provenance -> 404
    await expect(
      getVersionProvenanceForTrace(trace.decision_id, adminSessionB)
    ).rejects.toThrow(NotFoundError);
  });
});
