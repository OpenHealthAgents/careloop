import { z } from "zod";
import { getAIProvider } from "@/ai";
import { CaseOrchestratorTool } from "@/ai/schemas";
import { getPermissionsForRole, PERMISSIONS } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { careLoopPolicyEvaluator } from "@/policy";
import { requestHumanApproval } from "@/services/approval-service";
import { recordAuditEvent } from "@/services/audit-service";
import { executeCareLoopTool } from "@/services/tool-executor";
import { ToolResult } from "./contracts";
import { defaultToolRegistry, RegisteredToolSpec } from "./registry";

export type InitialCareLoopToolName =
  | "getCase"
  | "getMemberPreferences"
  | "getReferral"
  | "getCaseHistory"
  | "classifyBarrier"
  | "searchProviders"
  | "checkProviderAvailability"
  | "selectProvider"
  | "sendMemberMessage"
  | "sendReminder"
  | "requestScheduling"
  | "scheduleAppointment"
  | "checkAppointmentStatus"
  | "verifyAppointment"
  | "verifyCompletion"
  | "createHumanTask"
  | "requestApproval"
  | "escalateCase";

const CaseScopedInput = z.object({
  caseId: z.string().min(1),
});

export const INITIAL_CARELOOP_TOOLS: RegisteredToolSpec[] = [
  {
    name: "getCase",
    version: "1.0.0",
    description: "Fetch tenant-scoped case summary, status, risk tier, and matched provider.",
    input_schema: CaseScopedInput,
    output_schema: z.object({
      caseId: z.string(),
      status: z.string(),
      riskLevel: z.string().nullable(),
      priorityScore: z.number().nullable(),
      matchedProviderId: z.string().nullable(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.CASES_READ],
    side_effects: { kind: "NONE", summary: "Read-only case lookup", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Idempotent read-only query" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_GET_CASE",
  },
  {
    name: "getMemberPreferences",
    version: "1.0.0",
    description: "Fetch member language, modality, channel, and consent preferences for a case.",
    input_schema: CaseScopedInput,
    output_schema: z.object({
      caseId: z.string(),
      preferredLanguage: z.string(),
      preferredContactChannel: z.string(),
      preferredModality: z.string().nullable(),
      preferredTimeWindow: z.string().nullable(),
      consentOutreach: z.boolean(),
      consentSms: z.boolean(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.MEMBER_READ],
    side_effects: { kind: "NONE", summary: "Read-only member preferences lookup", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Idempotent read-only query" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_GET_MEMBER_PREFERENCES",
  },
  {
    name: "getReferral",
    version: "1.0.0",
    description: "Fetch referral specialty, behavioral health need, urgency, and network details.",
    input_schema: CaseScopedInput,
    output_schema: z.object({
      referralId: z.string(),
      specialty: z.string(),
      behavioralHealthNeed: z.string(),
      urgency: z.string(),
      networkRequired: z.string(),
      eligibilityVerified: z.string(),
      status: z.string(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.REFERRALS_READ],
    side_effects: { kind: "NONE", summary: "Read-only referral lookup", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Idempotent read-only query" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_GET_REFERRAL",
  },
  {
    name: "getCaseHistory",
    version: "1.0.0",
    description: "Fetch chronological workflow and execution journal history for a case.",
    input_schema: CaseScopedInput.extend({ limit: z.number().int().min(1).max(50).optional() }),
    output_schema: z.object({
      caseId: z.string(),
      events: z.array(
        z.object({
          eventType: z.string(),
          actorType: z.string(),
          timestamp: z.string(),
        })
      ),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.CASES_READ],
    side_effects: { kind: "NONE", summary: "Read-only history lookup", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Idempotent read-only query" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_GET_CASE_HISTORY",
  },
  {
    name: "classifyBarrier",
    version: "1.0.0",
    description: "Classify primary behavioral-health access/logistical barrier using AIProvider.",
    input_schema: CaseScopedInput,
    output_schema: z.object({
      caseId: z.string(),
      category: z.string(),
      subBarrier: z.string(),
      epistemicStatus: z.string(),
      confidence: z.number(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.CASES_READ, PERMISSIONS.AGENT_RUN, PERMISSIONS.AI_RUN],
    side_effects: { kind: "NONE", summary: "Read-only AI barrier inference", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Deterministic/stateless inference" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_CLASSIFY_BARRIER",
  },
  {
    name: "searchProviders",
    version: "1.0.0",
    description: "Search and rank in-network providers with verified vs directory availability.",
    input_schema: CaseScopedInput.extend({
      specialty: z.string().optional(),
      geography: z.string().optional(),
      preferredLanguage: z.string().optional(),
    }),
    output_schema: z.object({ matches: z.array(z.unknown()) }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.PROVIDER_READ],
    side_effects: { kind: "NONE", summary: "Read-only provider search", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Idempotent read-only search" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_SEARCH_PROVIDERS",
  },
  {
    name: "checkProviderAvailability",
    version: "1.0.0",
    description: "Check verified open appointment slots for a provider.",
    input_schema: z.object({
      providerId: z.string().min(1),
      caseId: z.string().min(1).optional(),
    }),
    output_schema: z.object({
      providerId: z.string(),
      verifiedSlotsCount: z.number().int(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.PROVIDER_READ],
    side_effects: { kind: "NONE", summary: "Read-only availability check", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Idempotent read-only query" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_CHECK_PROVIDER_AVAILABILITY",
  },
  {
    name: "selectProvider",
    version: "1.0.0",
    description: "Assign a verified in-network provider to a case.",
    input_schema: CaseScopedInput.extend({ providerId: z.string().min(1) }),
    output_schema: z.object({
      caseId: z.string(),
      matchedProviderId: z.string(),
      providerName: z.string(),
    }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.CASES_WRITE, PERMISSIONS.PROVIDER_READ],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Sets matchedProviderId on Case",
      reversible: true,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "POLICY_DEPENDENT",
    audit_event_type: "TOOL_SELECT_PROVIDER",
  },
  {
    name: "sendMemberMessage",
    version: "1.0.0",
    description: "Send consent-checked, PHI-safe member outreach via communication adapter.",
    input_schema: CaseScopedInput.extend({
      channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]),
      purpose: z.string().min(1),
      body: z.string().min(5).optional(),
      sensitiveCommunication: z.boolean().optional(),
    }),
    output_schema: z.object({ communicationId: z.string(), status: z.string() }),
    risk_level: "HIGH",
    permissions: [PERMISSIONS.MEMBER_COMMUNICATION],
    side_effects: {
      kind: "EXTERNAL_MESSAGE",
      summary: "Dispatches external member communication",
      reversible: false,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "POLICY_DEPENDENT",
    audit_event_type: "TOOL_SEND_MEMBER_MESSAGE",
  },
  {
    name: "sendReminder",
    version: "1.0.0",
    description: "Send consent-checked appointment reminder via communication adapter.",
    input_schema: CaseScopedInput.extend({
      channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]),
    }),
    output_schema: z.object({ communicationId: z.string(), status: z.string() }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.MEMBER_COMMUNICATION],
    side_effects: {
      kind: "EXTERNAL_MESSAGE",
      summary: "Sends appointment reminder",
      reversible: false,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "POLICY_DEPENDENT",
    audit_event_type: "TOOL_SEND_REMINDER",
  },
  {
    name: "requestScheduling",
    version: "1.0.0",
    description: "Initiate scheduling coordination for a matched provider.",
    input_schema: CaseScopedInput.extend({
      providerId: z.string().min(1),
      preferredModality: z.string().optional(),
    }),
    output_schema: z.object({ caseId: z.string(), requested: z.boolean() }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.APPOINTMENTS_WRITE],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Records scheduling request",
      reversible: true,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "POLICY_DEPENDENT",
    audit_event_type: "TOOL_REQUEST_SCHEDULING",
  },
  {
    name: "scheduleAppointment",
    version: "1.0.0",
    description: "Schedule an appointment into a verified open provider slot.",
    input_schema: CaseScopedInput.extend({
      providerId: z.string().min(1),
      scheduledStartAt: z.string().datetime(),
      modality: z.enum(["IN_PERSON", "TELEHEALTH"]),
      availabilityId: z.string().optional(),
    }),
    output_schema: z.object({ appointmentId: z.string(), status: z.string() }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.APPOINTMENTS_WRITE],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Creates Appointment and updates Case state",
      reversible: true,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "POLICY_DEPENDENT",
    audit_event_type: "TOOL_SCHEDULE_APPOINTMENT",
  },
  {
    name: "checkAppointmentStatus",
    version: "1.0.0",
    description: "Check latest appointment status and scheduled start time for a case.",
    input_schema: CaseScopedInput,
    output_schema: z.object({
      caseId: z.string(),
      appointments: z.array(
        z.object({
          id: z.string(),
          status: z.string(),
          scheduledStartAt: z.string(),
        })
      ),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.APPOINTMENTS_READ],
    side_effects: { kind: "NONE", summary: "Read-only appointment status check", reversible: true },
    idempotency: { mode: "SAFE_READ", description: "Idempotent read-only query" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_CHECK_APPOINTMENT_STATUS",
  },
  {
    name: "verifyAppointment",
    version: "1.0.0",
    description: "Confirm or update appointment attendance status.",
    input_schema: CaseScopedInput.extend({
      appointmentId: z.string().min(1),
      status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]),
    }),
    output_schema: z.object({ appointmentId: z.string(), status: z.string() }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.APPOINTMENTS_WRITE],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Updates Appointment status",
      reversible: false,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "POLICY_DEPENDENT",
    audit_event_type: "TOOL_VERIFY_APPOINTMENT",
  },
  {
    name: "verifyCompletion",
    version: "1.0.0",
    description: "Record multi-signal visit completion verification evidence.",
    input_schema: CaseScopedInput.extend({
      signalType: z.string().min(1),
      verified: z.boolean(),
      notes: z.string().optional(),
    }),
    output_schema: z.object({ verificationId: z.string(), verified: z.boolean() }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.COMPLETION_VERIFY],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Creates CompletionVerification record",
      reversible: false,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "POLICY_DEPENDENT",
    audit_event_type: "TOOL_VERIFY_COMPLETION",
  },
  {
    name: "createHumanTask",
    version: "1.0.0",
    description: "Create a structured human review task / coordination note on a case.",
    input_schema: CaseScopedInput.extend({
      title: z.string().min(3),
      instructions: z.string().min(5),
    }),
    output_schema: z.object({
      taskId: z.string(),
      caseId: z.string(),
      created: z.boolean(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.CASES_WRITE],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Creates human task note on Case",
      reversible: true,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_CREATE_HUMAN_TASK",
  },
  {
    name: "requestApproval",
    version: "1.0.0",
    description: "Create a persisted human ApprovalRequest gate before high-risk execution.",
    input_schema: CaseScopedInput.extend({
      action: z.string().min(1),
      reason: z.string().min(5),
      riskLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
    }),
    output_schema: z.object({
      approvalId: z.string(),
      status: z.string(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.CASES_READ, PERMISSIONS.AGENT_RUN, PERMISSIONS.AI_RUN],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Persists ApprovalRequest in PENDING state",
      reversible: true,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_REQUEST_APPROVAL",
  },
  {
    name: "escalateCase",
    version: "1.0.0",
    description: "Escalate case to Care Manager human review queue.",
    input_schema: CaseScopedInput.extend({ reason: z.string().min(5) }),
    output_schema: z.object({ caseId: z.string(), status: z.string() }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.CASES_ESCALATE],
    side_effects: {
      kind: "WORKFLOW_TRANSITION",
      summary: "Transitions Case to ESCALATED",
      reversible: true,
    },
    idempotency: { mode: "IDEMPOTENCY_KEY", description: "Deduplicated by idempotencyKey" },
    approval_requirement: "NONE",
    audit_event_type: "TOOL_ESCALATE_CASE",
  },
];

// Register all 18 initial tools in the default ToolRegistry singleton
for (const toolSpec of INITIAL_CARELOOP_TOOLS) {
  defaultToolRegistry.register(toolSpec);
}

const MAPPED_ORCHESTRATOR_TOOLS: Partial<Record<InitialCareLoopToolName, CaseOrchestratorTool>> = {
  searchProviders: "search_providers",
  checkProviderAvailability: "check_provider_availability",
  sendMemberMessage: "send_member_communication",
  sendReminder: "send_reminder",
  requestScheduling: "request_scheduling",
  scheduleAppointment: "schedule_appointment",
  verifyAppointment: "verify_appointment",
  verifyCompletion: "verify_completion",
  escalateCase: "escalate_to_human",
};

const idempotencyResultCache = new Map<string, ToolResult>();

export async function executeInitialCareLoopTool(params: {
  session: SessionUser;
  tool: InitialCareLoopToolName;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  humanApproved?: boolean;
  approvalId?: string;
  correlationId?: string;
}): Promise<ToolResult> {
  const spec = defaultToolRegistry.get(params.tool);
  const parsedInput = defaultToolRegistry.validate(params.tool, params.input) as Record<
    string,
    unknown
  >;

  const cacheKey = params.idempotencyKey
    ? `${params.session.tenantId}:${params.tool}:${params.idempotencyKey}`
    : null;
  if (cacheKey && idempotencyResultCache.has(cacheKey)) {
    const cached = idempotencyResultCache.get(cacheKey)!;
    return {
      ...cached,
      metadata: { ...cached.metadata, replayed: true },
    };
  }

  // Enforce scoped RBAC permissions
  const { requirePermission } = await import("@/lib/auth/rbac");
  for (const permission of spec.permissions) {
    requirePermission(params.session, permission);
  }

  // Enforce centralized Policy Engine (no tool may bypass policy)
  const grantedPerms =
    params.session.scopedPermissions ?? getPermissionsForRole(params.session.role);
  careLoopPolicyEvaluator.assertAllowed({
    action: params.tool,
    userRole: params.session.role,
    agentIdentity: params.session.isServiceIdentity
      ? {
          isServiceIdentity: true,
          serviceId: params.session.userId,
          scopedPermissions: params.session.scopedPermissions,
        }
      : undefined,
    actionRisk: spec.risk_level,
    humanApproved: params.humanApproved,
    policyCheckRequired: true,
    toolPermissions: {
      required: spec.permissions,
      granted: grantedPerms,
    },
  });

  // Delegate mapped tools directly to executeCareLoopTool (inherits full policy/span/journal/audit)
  const mappedCoreTool = MAPPED_ORCHESTRATOR_TOOLS[params.tool];
  if (mappedCoreTool) {
    try {
      const coreResult = await executeCareLoopTool({
        session: params.session,
        tool: mappedCoreTool,
        input: { tenantId: params.session.tenantId, ...parsedInput },
        idempotencyKey: params.idempotencyKey,
        humanApproved: params.humanApproved,
        approvalId: params.approvalId,
        correlationId: params.correlationId,
      });
      const result: ToolResult = {
        success: true,
        data: coreResult.output,
        evidence: coreResult.evidenceRecorded
          ? [{ tool: params.tool, auditEventType: coreResult.auditEventType }]
          : [],
        error: null,
        metadata: {
          tool: params.tool,
          version: spec.version,
          replayed: coreResult.replayed,
          correlationId: params.correlationId ?? null,
        },
      };
      if (cacheKey) idempotencyResultCache.set(cacheKey, result);
      return result;
    } catch (err) {
      return {
        success: false,
        data: null,
        evidence: [],
        error: {
          code: err instanceof AppError ? err.code : "TOOL_EXECUTION_ERROR",
          message: err instanceof Error ? err.message : "Tool execution failed",
        },
        metadata: { tool: params.tool, version: spec.version },
      };
    }
  }

  const caseId = typeof parsedInput.caseId === "string" ? parsedInput.caseId : "";
  const careCase = await prisma.case.findFirst({
    where: { id: caseId, tenantId: params.session.tenantId, deletedAt: null },
    include: { member: true, referral: true, barriers: true, appointments: true },
  });
  if (!careCase) {
    throw new NotFoundError("Case", caseId);
  }

  let outputData: unknown;

  switch (params.tool) {
    case "getCase":
      outputData = {
        caseId: careCase.id,
        status: careCase.status,
        riskLevel: careCase.riskLevel,
        priorityScore: careCase.priorityScore,
        matchedProviderId: careCase.matchedProviderId,
      };
      break;

    case "getMemberPreferences":
      outputData = {
        caseId: careCase.id,
        preferredLanguage: careCase.member.preferredLanguage,
        preferredContactChannel: careCase.member.preferredContactChannel,
        preferredModality: null,
        preferredTimeWindow: null,
        consentOutreach: careCase.member.consentOutreach,
        consentSms: careCase.member.consentSms,
      };
      break;

    case "getReferral":
      outputData = {
        referralId: careCase.referral.id,
        specialty: careCase.referral.specialty,
        behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
        urgency: careCase.referral.urgency,
        networkRequired: careCase.referral.networkRequired,
        eligibilityVerified: careCase.referral.eligibilityVerified,
        status: careCase.referral.status,
      };
      break;

    case "getCaseHistory": {
      const limit = typeof parsedInput.limit === "number" ? parsedInput.limit : 20;
      const journal = await prisma.executionJournalEvent.findMany({
        where: { tenantId: params.session.tenantId, caseId: careCase.id },
        orderBy: { timestamp: "desc" },
        take: limit,
      });
      outputData = {
        caseId: careCase.id,
        events: journal.map((e) => ({
          eventType: e.eventType,
          actorType: e.actorType,
          timestamp: e.timestamp.toISOString(),
        })),
      };
      break;
    }

    case "classifyBarrier": {
      const ai = getAIProvider();
      const matchingProviders = await prisma.provider.count({
        where: {
          tenantId: params.session.tenantId,
          specialty: careCase.referral.specialty,
          acceptingNewPatients: true,
        },
      });
      const res = await ai.classifyBarrier({
        referralId: careCase.referral.id,
        referralDate: careCase.referral.referralDate,
        behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
        specialty: careCase.referral.specialty,
        urgency: careCase.referral.urgency,
        geography: careCase.referral.geography,
        networkRequired: careCase.referral.networkRequired,
        preferredLanguage: careCase.member.preferredLanguage,
        eligibilityVerified: careCase.referral.eligibilityVerified,
        member: {
          urbanicity: careCase.member.urbanicity,
          coverageType: careCase.member.coverageType,
          eligibilityStatus: careCase.member.eligibilityStatus,
          preferredContactChannel: careCase.member.preferredContactChannel,
          digitalAccessLevel: careCase.member.digitalAccessLevel,
          transportationAccess: careCase.member.transportationAccess,
          priorNoShowCount: careCase.member.priorNoShowCount,
          historicalEngagementRate: careCase.member.historicalEngagementRate,
        },
        matchingProvidersCount: matchingProviders,
        languageConcordantProvidersCount: matchingProviders,
        verifiedAvailableSlotsCount: 0,
        minDirectoryWaitDays: null,
      });
      outputData = {
        caseId: careCase.id,
        category: res.primaryBarrier.category,
        subBarrier: res.primaryBarrier.subBarrier,
        epistemicStatus: res.epistemicStatus,
        confidence: res.confidence,
      };
      break;
    }

    case "selectProvider": {
      const providerId = String(parsedInput.providerId);
      const provider = await prisma.provider.findFirst({
        where: { id: providerId, tenantId: params.session.tenantId, deletedAt: null },
      });
      if (!provider) {
        throw new NotFoundError("Provider", providerId);
      }
      await prisma.case.update({
        where: { id: careCase.id },
        data: { matchedProviderId: provider.id },
      });
      outputData = {
        caseId: careCase.id,
        matchedProviderId: provider.id,
        providerName: provider.name,
      };
      break;
    }

    case "checkAppointmentStatus":
      outputData = {
        caseId: careCase.id,
        appointments: careCase.appointments.map((a) => ({
          id: a.id,
          status: a.status,
          scheduledStartAt: a.scheduledStartAt.toISOString(),
        })),
      };
      break;

    case "createHumanTask": {
      const note = await prisma.caseNote.create({
        data: {
          tenantId: params.session.tenantId,
          caseId: careCase.id,
          authorId: params.session.userId.startsWith("agent:") ? null : params.session.userId,
          category: "HUMAN_TASK",
          content: `${String(parsedInput.title)}: ${String(parsedInput.instructions)}`,
        },
      });
      outputData = {
        taskId: note.id,
        caseId: careCase.id,
        created: true,
      };
      break;
    }

    case "requestApproval": {
      const requestedAction = String(parsedInput.action);
      const mappedAction =
        MAPPED_ORCHESTRATOR_TOOLS[requestedAction as InitialCareLoopToolName] ??
        (requestedAction as CaseOrchestratorTool);
      const approval = await requestHumanApproval({
        session: params.session,
        caseId: careCase.id,
        action: mappedAction,
        reason: String(parsedInput.reason),
        riskLevel: parsedInput.riskLevel as "HIGH" | "MEDIUM" | "LOW",
        requestedBy: params.session.userId,
        idempotencyKey: params.idempotencyKey,
        correlationId: params.correlationId,
      });
      outputData = {
        approvalId: approval.approval_id,
        status: approval.status,
      };
      break;
    }

    default:
      throw new ValidationError(`Unsupported initial tool: ${params.tool}`);
  }

  const validatedOutput = spec.output_schema.parse(outputData);
  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: spec.audit_event_type ?? `TOOL_${params.tool.toUpperCase()}`,
    entityType: "Case",
    entityId: careCase.id,
    source: params.session.isServiceIdentity ? "AGENT_SERVICE" : "API",
    correlationId: params.correlationId ?? params.idempotencyKey ?? null,
    summary: `Executed tool ${params.tool} (v${spec.version}) on case ${careCase.id}`,
  });

  const finalResult: ToolResult = {
    success: true,
    data: validatedOutput,
    evidence: [{ tool: params.tool, caseId: careCase.id, version: spec.version }],
    error: null,
    metadata: {
      tool: params.tool,
      version: spec.version,
      replayed: false,
      correlationId: params.correlationId ?? null,
    },
  };
  if (cacheKey) {
    idempotencyResultCache.set(cacheKey, finalResult);
  }
  return finalResult;
}
