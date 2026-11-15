import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CaseStatus } from "@prisma/client";
import { AIPolicyViolationError } from "@/ai";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  AuthorizationError,
  InvalidStateTransitionError,
  ValidationError,
} from "@/lib/errors";
import { executeCareLoopTool } from "@/services/tool-executor";

describe("Unified Tool Execution Contract Integration", () => {
  let tenantId = "";
  let careManagerSession: SessionUser;
  let execSession: SessionUser;
  let testCaseId = "";
  let noConsentCaseId = "";
  let testReferralIds: string[] = [];
  let testMemberIds: string[] = [];

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = tenant.id;
    const cm = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: "care.manager@careloop.demo" } },
    });
    const exec = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: "exec@careloop.demo" } },
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
    execSession = {
      userId: exec.id,
      tenantId,
      tenantSlug: tenant.slug,
      email: exec.email,
      name: exec.name,
      role: exec.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const m1 = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-TOOL-${Date.now()}-1`,
        firstName: "Tool",
        lastName: "Tester",
        dobYear: 1990,
        geography: "Central Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "MEDICAID",
        consentOutreach: true,
        consentSms: true,
      },
    });
    const m2 = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-TOOL-${Date.now()}-2`,
        firstName: "OptOut",
        lastName: "Member",
        dobYear: 1992,
        geography: "Central Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "MEDICAID",
        consentOutreach: false,
        consentSms: false,
      },
    });
    testMemberIds = [m1.id, m2.id];

    const r1 = await prisma.referral.create({
      data: {
        tenantId,
        externalReferralId: `REF-TOOL-${Date.now()}-1`,
        memberId: m1.id,
        specialty: "Outpatient Behavioral Health",
        behavioralHealthNeed: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
        referralDate: new Date(),
      },
    });
    const r2 = await prisma.referral.create({
      data: {
        tenantId,
        externalReferralId: `REF-TOOL-${Date.now()}-2`,
        memberId: m2.id,
        specialty: "Outpatient Behavioral Health",
        behavioralHealthNeed: "Outpatient Therapy",
        urgency: "ROUTINE",
        geography: "Central Metro",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
        referralDate: new Date(),
      },
    });
    testReferralIds = [r1.id, r2.id];

    const c1 = await prisma.case.create({
      data: { tenantId, referralId: r1.id, memberId: m1.id, status: CaseStatus.NEW },
    });
    const c2 = await prisma.case.create({
      data: { tenantId, referralId: r2.id, memberId: m2.id, status: CaseStatus.INTERVENTION_IN_PROGRESS },
    });
    testCaseId = c1.id;
    noConsentCaseId = c2.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({
      where: { tenantId, entityId: { in: [testCaseId, noConsentCaseId] } },
    });
    await prisma.case.deleteMany({ where: { id: { in: [testCaseId, noConsentCaseId] } } });
    await prisma.referral.deleteMany({ where: { id: { in: testReferralIds } } });
    await prisma.member.deleteMany({ where: { id: { in: testMemberIds } } });
  });

  it("enforces input validation, RBAC authorization, state validation, policy checks, and consent gates before tool execution", async () => {
    // 1. Input schema validation
    await expect(
      executeCareLoopTool({
        session: careManagerSession,
        tool: "search_providers",
        input: { tenantId }, // missing required specialty
      })
    ).rejects.toThrowError(ValidationError);

    // 2. RBAC authorization check (EXECUTIVE_READ_ONLY cannot escalate)
    await expect(
      executeCareLoopTool({
        session: execSession,
        tool: "escalate_to_human",
        input: { tenantId, caseId: testCaseId, escalationReason: "Blocked test" },
        humanApproved: true,
      })
    ).rejects.toThrowError(AuthorizationError);

    // 3. Case state machine check (NEW -> CLOSED invalid)
    await expect(
      executeCareLoopTool({
        session: careManagerSession,
        tool: "run_ai_assessment",
        input: { tenantId, caseId: testCaseId },
        proposedNextState: CaseStatus.CLOSED,
      })
    ).rejects.toThrowError(InvalidStateTransitionError);

    // 4. Policy guard: clinical advice blocked & human approval enforced
    await expect(
      executeCareLoopTool({
        session: careManagerSession,
        tool: "escalate_to_human",
        input: { tenantId, caseId: testCaseId, escalationReason: "Need to prescribe SSRI dosage" },
        humanApproved: true,
      })
    ).rejects.toThrowError(AIPolicyViolationError);

    await expect(
      executeCareLoopTool({
        session: careManagerSession,
        tool: "escalate_to_human",
        input: { tenantId, caseId: testCaseId, escalationReason: "Member unreachable after 3 calls" },
        humanApproved: false,
      })
    ).rejects.toThrowError(AIPolicyViolationError);

    // 5. Consent/privacy check before outbound member communication
    await expect(
      executeCareLoopTool({
        session: careManagerSession,
        tool: "send_member_communication",
        input: {
          tenantId,
          caseId: noConsentCaseId,
          channel: "SMS",
          messageType: "HUMAN_OUTREACH",
          body: "Hello, we can help you book your first behavioral-health visit.",
          sensitive: true,
        },
        humanApproved: true,
      })
    ).rejects.toThrowError(ValidationError);
  });

  it("executes read and write tools, validates outputs, replays idempotent keys, and writes audit evidence", async () => {
    const searchRes = await executeCareLoopTool({
      session: execSession, // read-only role CAN execute LOW-risk read-only search_providers
      tool: "search_providers",
      input: {
        tenantId,
        specialty: "Outpatient Behavioral Health",
        geography: "Central Metro",
        preferredLanguage: "English",
      },
    });
    expect(searchRes.replayed).toBe(false);
    expect(searchRes.evidenceRecorded).toBe(true);
    expect((searchRes.output as { providers: unknown[] }).providers.length).toBeGreaterThan(0);

    const idemKey = `idem-escalate-${Date.now()}`;
    const firstExec = await executeCareLoopTool({
      session: careManagerSession,
      tool: "escalate_to_human",
      input: {
        tenantId,
        caseId: testCaseId,
        escalationReason: "Requires supervisor review for complex transit barrier.",
      },
      proposedNextState: CaseStatus.ESCALATED,
      idempotencyKey: idemKey,
      humanApproved: true,
    });
    expect(firstExec.replayed).toBe(false);
    expect(firstExec.auditEventType).toBe("CASE_ESCALATED");
    expect((firstExec.output as { status: string }).status).toBe("ESCALATED");

    // Second call with same idempotencyKey replays safely without invalid ESCALATED->ESCALATED transition error
    const replayExec = await executeCareLoopTool({
      session: careManagerSession,
      tool: "escalate_to_human",
      input: {
        tenantId,
        caseId: testCaseId,
        escalationReason: "Requires supervisor review for complex transit barrier.",
      },
      idempotencyKey: idemKey,
      humanApproved: true,
    });
    expect(replayExec.replayed).toBe(true);
    expect(replayExec.output).toEqual(firstExec.output);

    const auditCount = await prisma.auditEvent.count({
      where: {
        tenantId,
        entityId: testCaseId,
        action: "TOOL_EXECUTION_COMPLETED",
        correlationId: idemKey,
      },
    });
    expect(auditCount).toBe(1);
  });
});
