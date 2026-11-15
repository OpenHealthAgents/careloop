import { describe, expect, it } from "vitest";
import { createAgentServiceIdentity } from "@/lib/auth/agent-identity";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { AuthorizationError } from "@/lib/errors";
import {
  executeInitialCareLoopTool,
  INITIAL_CARELOOP_TOOLS,
  ToolRegistry,
} from "@/tools";

describe("Initial CareLoop Tools (18 Typed Tools with Auth, Policy, Audit & Idempotency)", () => {
  it("registers all 18 CareLoop tools in ToolRegistry with schemas, permissions, and idempotency", () => {
    const expectedNames = [
      "getCase",
      "getMemberPreferences",
      "getReferral",
      "getCaseHistory",
      "classifyBarrier",
      "searchProviders",
      "checkProviderAvailability",
      "selectProvider",
      "sendMemberMessage",
      "sendReminder",
      "requestScheduling",
      "scheduleAppointment",
      "checkAppointmentStatus",
      "verifyAppointment",
      "verifyCompletion",
      "createHumanTask",
      "requestApproval",
      "escalateCase",
    ];

    expect(INITIAL_CARELOOP_TOOLS).toHaveLength(18);
    for (const name of expectedNames) {
      const spec = ToolRegistry.get(name);
      expect(spec.name).toBe(name);
      expect(spec.version).toBe("1.0.0");
      expect(spec.input_schema).toBeDefined();
      expect(spec.output_schema).toBeDefined();
      expect(spec.permissions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("executes tools via scoped AGENT_SERVICE identity, enforces RBAC, writes audit events, and honors idempotency", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const careCase = await prisma.case.findFirstOrThrow({
      where: { tenantId: horizon.id, deletedAt: null },
    });
    const provider = await prisma.provider.findFirstOrThrow({
      where: { tenantId: horizon.id, acceptingNewPatients: true, deletedAt: null },
    });

    const agentSession = createAgentServiceIdentity({
      serviceId: "initial-tools-agent",
      serviceName: "CareLoop Initial Tools Agent",
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      scopedPermissions: [
        PERMISSIONS.CASES_READ,
        PERMISSIONS.CASES_WRITE,
        PERMISSIONS.MEMBER_READ,
        PERMISSIONS.REFERRALS_READ,
        PERMISSIONS.PROVIDER_READ,
        PERMISSIONS.APPOINTMENTS_READ,
        PERMISSIONS.AGENT_RUN,
        PERMISSIONS.AI_RUN,
      ],
    });

    // 1. Read tools
    const getCaseRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "getCase",
      input: { caseId: careCase.id },
    });
    expect(getCaseRes.success).toBe(true);
    expect((getCaseRes.data as { caseId: string }).caseId).toBe(careCase.id);

    const prefsRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "getMemberPreferences",
      input: { caseId: careCase.id },
    });
    expect(prefsRes.success).toBe(true);

    const refRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "getReferral",
      input: { caseId: careCase.id },
    });
    expect(refRes.success).toBe(true);

    const histRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "getCaseHistory",
      input: { caseId: careCase.id, limit: 5 },
    });
    expect(histRes.success).toBe(true);

    const barrierRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "classifyBarrier",
      input: { caseId: careCase.id },
    });
    expect(barrierRes.success).toBe(true);

    const apptStatusRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "checkAppointmentStatus",
      input: { caseId: careCase.id },
    });
    expect(apptStatusRes.success).toBe(true);

    // 2. Write tools + idempotency + audit event verification
    const idemKey = `sel-prov-${Date.now()}`;
    const selectRes1 = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "selectProvider",
      input: { caseId: careCase.id, providerId: provider.id },
      idempotencyKey: idemKey,
    });
    expect(selectRes1.success).toBe(true);
    expect(selectRes1.metadata.replayed).toBe(false);

    const selectRes2 = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "selectProvider",
      input: { caseId: careCase.id, providerId: provider.id },
      idempotencyKey: idemKey,
    });
    expect(selectRes2.success).toBe(true);
    expect(selectRes2.metadata.replayed).toBe(true);

    // Verify audit event persisted
    const audit = await prisma.auditEvent.findFirst({
      where: {
        tenantId: horizon.id,
        entityId: careCase.id,
        action: "TOOL_SELECT_PROVIDER",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();

    // 3. Human task & approval request tools
    const taskRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "createHumanTask",
      input: {
        caseId: careCase.id,
        title: "Verify clinic slot",
        instructions: "Confirm morning intake availability with clinic coordinator.",
      },
    });
    expect(taskRes.success).toBe(true);

    const approvalRes = await executeInitialCareLoopTool({
      session: agentSession,
      tool: "requestApproval",
      input: {
        caseId: careCase.id,
        action: "sendMemberMessage",
        reason: "High-risk case requires human approval before SMS outreach.",
        riskLevel: "HIGH",
      },
    });
    expect(approvalRes.success).toBe(true);
    expect((approvalRes.data as { status: string }).status).toBe("PENDING");

    // 4. Scoped permission enforcement: agent without CASES_ESCALATE cannot call escalateCase
    await expect(
      executeInitialCareLoopTool({
        session: agentSession,
        tool: "escalateCase",
        input: { caseId: careCase.id, reason: "Testing scoped permission rejection" },
      })
    ).rejects.toThrow(AuthorizationError);
  });
});
