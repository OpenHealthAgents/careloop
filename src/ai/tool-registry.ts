import { z } from "zod";
import { PERMISSIONS, Permission } from "@/lib/auth/rbac";
import { ValidationError } from "@/lib/errors";
import { CaseOrchestratorTool, CaseOrchestratorToolSchema } from "./schemas";

export type ToolRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ToolSideEffectKind =
  | "NONE"
  | "DATABASE_WRITE"
  | "EXTERNAL_MESSAGE"
  | "WORKFLOW_TRANSITION";
export type ToolHumanApprovalRequirement = "NONE" | "POLICY_DEPENDENT" | "ALWAYS_REQUIRED";

export interface CareLoopToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  name: CaseOrchestratorTool;
  version?: string;
  description: string;
  input_schema: TInput;
  output_schema: TOutput;
  risk_level: ToolRiskLevel;
  permissions: readonly Permission[];
  side_effects: {
    kind: ToolSideEffectKind;
    summary: string;
    reversible: boolean;
  };
  idempotency_strategy: {
    mode: "SAFE_READ" | "IDEMPOTENCY_KEY" | "STATE_PRECONDITION" | "UNIQUE_CONSTRAINT";
    description: string;
  };
  timeout: {
    ms: number;
  };
  retry_policy: {
    maxAttempts: number;
    backoffMs: number;
    retryable: boolean;
  };
  audit_event_type: string;
  human_approval_requirement: ToolHumanApprovalRequirement;
}

const CaseScopedInputSchema = z.object({
  tenantId: z.string().min(1),
  caseId: z.string().min(1),
  correlationId: z.string().min(1).optional(),
});

export const CARE_LOOP_TOOL_REGISTRY: Record<CaseOrchestratorTool, CareLoopToolDefinition> = {
  search_providers: {
    name: "search_providers",
    description:
      "Search and rank in-network behavioral-health providers matching specialty, geography, modality, and member language while separating VERIFIED AVAILABILITY from DIRECTORY DATA.",
    input_schema: z.object({
      tenantId: z.string().min(1),
      caseId: z.string().min(1).optional(),
      specialty: z.string().min(1),
      geography: z.string().min(1).optional(),
      networkRequired: z.string().min(1).optional(),
      preferredLanguage: z.string().min(1).optional(),
    }),
    output_schema: z.object({
      providers: z.array(
        z.object({
          providerId: z.string().min(1),
          providerName: z.string().min(1),
          matchScore: z.number(),
          availabilitySource: z.enum(["VERIFIED_AVAILABILITY", "DIRECTORY_INFORMATION", "NOT_AVAILABLE"]),
        })
      ),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.PROVIDERS_READ],
    side_effects: {
      kind: "NONE",
      summary: "Read-only directory and slot rank query; mutates no database state.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "SAFE_READ",
      description: "Pure read operation safe for unbounded repeatable calls.",
    },
    timeout: { ms: 5000 },
    retry_policy: { maxAttempts: 3, backoffMs: 250, retryable: true },
    audit_event_type: "PROVIDER_SEARCH_EXECUTED",
    human_approval_requirement: "NONE",
  },

  check_provider_availability: {
    name: "check_provider_availability",
    description:
      "Inspect live verified availability slots and staleness timestamp for a candidate provider without falsely marking directory listings as open slots.",
    input_schema: z.object({
      tenantId: z.string().min(1),
      providerId: z.string().min(1),
    }),
    output_schema: z.object({
      providerId: z.string().min(1),
      availabilitySource: z.enum(["VERIFIED_AVAILABILITY", "DIRECTORY_INFORMATION", "NOT_AVAILABLE"]),
      verifiedSlotsCount: z.number().int().min(0),
      lastVerifiedAt: z.string().nullable(),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.PROVIDERS_READ],
    side_effects: {
      kind: "NONE",
      summary: "Read-only provider availability inspection.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "SAFE_READ",
      description: "Pure read query safe to retry.",
    },
    timeout: { ms: 5000 },
    retry_policy: { maxAttempts: 3, backoffMs: 250, retryable: true },
    audit_event_type: "PROVIDER_AVAILABILITY_CHECKED",
    human_approval_requirement: "NONE",
  },

  run_ai_assessment: {
    name: "run_ai_assessment",
    description:
      "Run schema-validated AI risk scoring, barrier inference (with UNKNOWN fallback), provider ranking, and intervention staging without auto-confirming FACT status.",
    input_schema: CaseScopedInputSchema,
    output_schema: z.object({
      riskTier: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
      priorityScore: z.number().int().min(0).max(100),
      stagedBarrierCategory: z.string().min(1),
      stagedInterventionsCount: z.number().int().min(0),
    }),
    risk_level: "LOW",
    permissions: [PERMISSIONS.AI_RUN],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Writes non-binding AIRecommendation, RiskAssessment, INFERENCE Barrier, and RECOMMENDED Interventions.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "IDEMPOTENCY_KEY",
      description: "Correlated via correlationId; never overwrites confirmed human FACT barriers.",
    },
    timeout: { ms: 15000 },
    retry_policy: { maxAttempts: 2, backoffMs: 500, retryable: true },
    audit_event_type: "AI_CASE_ASSESSMENT",
    human_approval_requirement: "POLICY_DEPENDENT",
  },

  human_barrier_review: {
    name: "human_barrier_review",
    description:
      "Present inferred or UNKNOWN barrier evidence to a Care Manager to confirm FACT status, modify category/sub-barrier, reject, or document UNKNOWN.",
    input_schema: CaseScopedInputSchema.extend({
      barrierId: z.string().min(1),
      decision: z.enum(["CONFIRMED", "MODIFIED", "REJECTED", "UNKNOWN"]),
      notes: z.string().optional(),
    }),
    output_schema: z.object({
      barrierId: z.string().min(1),
      epistemicStatus: z.enum(["FACT", "INFERENCE", "UNKNOWN"]),
      confirmedByHuman: z.boolean(),
    }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.CASES_MANAGE],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Updates Barrier epistemicStatus and writes BARRIER_REVIEWED audit record.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Scoped by barrierId + tenantId with full previousState/newState audit diff.",
    },
    timeout: { ms: 5000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "BARRIER_REVIEWED",
    human_approval_requirement: "ALWAYS_REQUIRED",
  },

  human_intervention_approval: {
    name: "human_intervention_approval",
    description:
      "Require explicit Care Manager approval, modification, or rejection before executing recommended high-risk or human-assisted navigation interventions.",
    input_schema: CaseScopedInputSchema.extend({
      interventionId: z.string().min(1),
      decision: z.enum(["APPROVED", "MODIFIED", "REJECTED"]),
      notes: z.string().optional(),
    }),
    output_schema: z.object({
      interventionId: z.string().min(1),
      status: z.string().min(1),
      approvedById: z.string().min(1).nullable(),
    }),
    risk_level: "HIGH",
    permissions: [PERMISSIONS.INTERVENTIONS_APPROVE],
    side_effects: {
      kind: "WORKFLOW_TRANSITION",
      summary: "Authorizes or rejects intervention execution and advances CaseStatus if approved.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Transition checked against valid InterventionStatus rules.",
    },
    timeout: { ms: 5000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "INTERVENTION_REVIEWED",
    human_approval_requirement: "ALWAYS_REQUIRED",
  },

  request_scheduling: {
    name: "request_scheduling",
    description:
      "Initiate navigator-assisted or member portal scheduling workflow to align open clinic slots with member timing, modality, and transit constraints.",
    input_schema: CaseScopedInputSchema.extend({
      providerId: z.string().min(1),
      modality: z.enum(["IN_PERSON", "TELEHEALTH"]),
    }),
    output_schema: z.object({
      requestCreated: z.boolean(),
      providerId: z.string().min(1),
    }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.APPOINTMENTS_MANAGE],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Records scheduling request and notifies coordination navigator.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Checks member consent and open case eligibility before staging request.",
    },
    timeout: { ms: 8000 },
    retry_policy: { maxAttempts: 2, backoffMs: 500, retryable: true },
    audit_event_type: "SCHEDULING_REQUESTED",
    human_approval_requirement: "POLICY_DEPENDENT",
  },

  schedule_appointment: {
    name: "schedule_appointment",
    description:
      "Book a behavioral-health appointment against an available in-network provider with verified slot provenance or confirmed clinic booking.",
    input_schema: CaseScopedInputSchema.extend({
      providerId: z.string().min(1),
      availabilitySlotId: z.string().min(1).optional(),
      scheduledStartAt: z.string().datetime(),
      modality: z.enum(["IN_PERSON", "TELEHEALTH"]),
    }),
    output_schema: z.object({
      appointmentId: z.string().min(1),
      status: z.string().min(1),
      availabilitySourceAtBooking: z.string().min(1),
    }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.APPOINTMENTS_MANAGE],
    side_effects: {
      kind: "DATABASE_WRITE",
      summary: "Creates Appointment row, reserves verified slot, and advances CaseStatus to APPOINTMENT_SCHEDULED.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Marks ProviderAvailability slot BOOKED transactionally; rejects double-booking or NOT_AVAILABLE providers.",
    },
    timeout: { ms: 8000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "APPOINTMENT_SCHEDULED",
    human_approval_requirement: "POLICY_DEPENDENT",
  },

  send_reminder: {
    name: "send_reminder",
    description:
      "Send consent-checked, plain-language pre-visit appointment reminder via member-preferred channel with zero internal AI/risk leakage.",
    input_schema: CaseScopedInputSchema.extend({
      appointmentId: z.string().min(1),
      channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL"]),
      body: z.string().min(5),
    }),
    output_schema: z.object({
      communicationId: z.string().min(1),
      deliveryStatus: z.string().min(1),
    }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.OUTREACH_SEND],
    side_effects: {
      kind: "EXTERNAL_MESSAGE",
      summary: "Persists validated Communication record and invokes outbound adapter when consented.",
      reversible: false,
    },
    idempotency_strategy: {
      mode: "IDEMPOTENCY_KEY",
      description: "Validates consent, reading level, and clinical/internal-reasoning guard before delivery.",
    },
    timeout: { ms: 8000 },
    retry_policy: { maxAttempts: 2, backoffMs: 1000, retryable: true },
    audit_event_type: "APPOINTMENT_REMINDER_SENT",
    human_approval_requirement: "POLICY_DEPENDENT",
  },

  send_member_communication: {
    name: "send_member_communication",
    description:
      "Send sensitive or personalized member coordination communication (e.g., cost-share explanation, re-engagement after no-show, barrier clarification).",
    input_schema: CaseScopedInputSchema.extend({
      channel: z.enum(["SMS", "PHONE", "EMAIL", "PORTAL", "IN_PERSON_NAVIGATOR"]),
      messageType: z.string().min(1),
      body: z.string().min(5),
      sensitive: z.boolean().default(true),
    }),
    output_schema: z.object({
      communicationId: z.string().min(1),
      deliveryStatus: z.string().min(1),
    }),
    risk_level: "HIGH",
    permissions: [PERMISSIONS.OUTREACH_SEND],
    side_effects: {
      kind: "EXTERNAL_MESSAGE",
      summary: "Dispatches external member communication; irreversible once delivered.",
      reversible: false,
    },
    idempotency_strategy: {
      mode: "IDEMPOTENCY_KEY",
      description: "Requires verified member consent, validateOutboundCommunication pass, and human/policy clearance.",
    },
    timeout: { ms: 8000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "MEMBER_COMMUNICATION_SENT",
    human_approval_requirement: "POLICY_DEPENDENT",
  },

  verify_appointment: {
    name: "verify_appointment",
    description:
      "Transition a scheduled appointment to CONFIRMED or record CANCELLED / NO_SHOW state transitions through the appointment state machine.",
    input_schema: CaseScopedInputSchema.extend({
      appointmentId: z.string().min(1),
      toStatus: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"]),
      reason: z.string().optional(),
    }),
    output_schema: z.object({
      appointmentId: z.string().min(1),
      status: z.string().min(1),
    }),
    risk_level: "MEDIUM",
    permissions: [PERMISSIONS.APPOINTMENTS_MANAGE],
    side_effects: {
      kind: "WORKFLOW_TRANSITION",
      summary: "Transitions AppointmentStatus and synchronizes CaseStatus.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Enforced by assertAppointmentTransition; illegal jumps return 409 InvalidStateTransitionError.",
    },
    timeout: { ms: 5000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "APPOINTMENT_STATUS_UPDATED",
    human_approval_requirement: "POLICY_DEPENDENT",
  },

  verify_completion: {
    name: "verify_completion",
    description:
      "Record explicit multi-signal visit completion evidence (provider confirmation, claim signal, member confirmation, or subsequent engagement) before marking care completed.",
    input_schema: CaseScopedInputSchema.extend({
      signalType: z.enum([
        "APPOINTMENT_COMPLETED",
        "CLAIM_RECEIVED",
        "PROVIDER_CONFIRMATION",
        "MEMBER_CONFIRMATION",
        "SUBSEQUENT_TREATMENT_ENGAGEMENT",
      ]),
      sourceSystem: z.string().min(1),
      evidenceNote: z.string().optional(),
    }),
    output_schema: z.object({
      verificationId: z.string().min(1),
      provesCareCompleted: z.boolean(),
      caseStatus: z.string().min(1),
    }),
    risk_level: "HIGH",
    permissions: [PERMISSIONS.COMPLETION_VERIFY],
    side_effects: {
      kind: "WORKFLOW_TRANSITION",
      summary: "Writes CompletionVerification, sets firstCompletedVisitAt, and advances CaseStatus to VERIFIED.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Requires attended visit signal in VISIT_COMPLETION_SIGNALS and Care Manager/verified accountability.",
    },
    timeout: { ms: 8000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "COMPLETION_VERIFIED",
    human_approval_requirement: "ALWAYS_REQUIRED",
  },

  escalate_to_human: {
    name: "escalate_to_human",
    description:
      "Escalate high-risk, unreachable, blocked, or conflicting cases directly to senior Care Manager ownership with notification and audit trail.",
    input_schema: CaseScopedInputSchema.extend({
      escalationReason: z.string().min(3),
    }),
    output_schema: z.object({
      caseId: z.string().min(1),
      status: z.literal("ESCALATED"),
      notificationSent: z.boolean(),
    }),
    risk_level: "HIGH",
    permissions: [PERMISSIONS.CASES_MANAGE, PERMISSIONS.CASES_ESCALATE],
    side_effects: {
      kind: "WORKFLOW_TRANSITION",
      summary: "Transitions CaseStatus to ESCALATED, sets humanReviewRequired=true, and dispatches staff notification.",
      reversible: true,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Validated by CaseStatus state machine with explicit escalationReason.",
    },
    timeout: { ms: 5000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "CASE_ESCALATED",
    human_approval_requirement: "ALWAYS_REQUIRED",
  },

  close_verified_case: {
    name: "close_verified_case",
    description:
      "Close a verified behavioral-health care coordination case after visit verification or documented unresolved exception review.",
    input_schema: CaseScopedInputSchema.extend({
      closureReason: z.string().min(3),
    }),
    output_schema: z.object({
      caseId: z.string().min(1),
      status: z.literal("CLOSED"),
      closedAt: z.string().datetime(),
    }),
    risk_level: "HIGH",
    permissions: [PERMISSIONS.CASES_MANAGE],
    side_effects: {
      kind: "WORKFLOW_TRANSITION",
      summary: "Transitions Case to terminal CLOSED state and stamps closedAt + closureReason.",
      reversible: false,
    },
    idempotency_strategy: {
      mode: "STATE_PRECONDITION",
      description: "Only allowed from VERIFIED or reviewed exception states per ALLOWED_CASE_TRANSITIONS.",
    },
    timeout: { ms: 5000 },
    retry_policy: { maxAttempts: 1, backoffMs: 0, retryable: false },
    audit_event_type: "CASE_CLOSED",
    human_approval_requirement: "ALWAYS_REQUIRED",
  },
};

export function getToolDefinition(toolName: CaseOrchestratorTool): CareLoopToolDefinition {
  const checked = CaseOrchestratorToolSchema.safeParse(toolName);
  if (!checked.success) {
    throw new ValidationError(`Unknown CareLoop tool requested: '${String(toolName)}'.`);
  }
  return CARE_LOOP_TOOL_REGISTRY[checked.data];
}

export function validateToolInput(toolName: CaseOrchestratorTool, rawInput: unknown): unknown {
  const def = getToolDefinition(toolName);
  const parsed = def.input_schema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ValidationError(`Tool '${toolName}' received invalid input parameters.`, {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

export function validateToolOutput(toolName: CaseOrchestratorTool, rawOutput: unknown): unknown {
  const def = getToolDefinition(toolName);
  const parsed = def.output_schema.safeParse(rawOutput);
  if (!parsed.success) {
    throw new ValidationError(`Tool '${toolName}' returned invalid output structure.`, {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}

/**
 * Resolves whether a tool invocation requires explicit human approval under CareLoop's policy rules.
 */
export function requiresHumanApprovalForTool(
  toolName: CaseOrchestratorTool,
  context?: { riskTier?: string; sensitiveCommunication?: boolean }
): boolean {
  const def = getToolDefinition(toolName);
  if (def.human_approval_requirement === "ALWAYS_REQUIRED") {
    return true;
  }
  if (def.human_approval_requirement === "NONE") {
    return false;
  }
  // POLICY_DEPENDENT: require human approval on HIGH risk cases, HIGH risk tools (e.g. sensitive comms), or explicit sensitive flag
  if (context?.riskTier === "HIGH" || def.risk_level === "HIGH" || context?.sensitiveCommunication) {
    return true;
  }
  return false;
}

export function listToolRegistryMetadata() {
  return Object.values(CARE_LOOP_TOOL_REGISTRY).map((tool) => ({
    name: tool.name,
    version: tool.version ?? "1.0.0",
    description: tool.description,
    risk_level: tool.risk_level,
    permissions: tool.permissions,
    side_effects: tool.side_effects,
    idempotency_strategy: tool.idempotency_strategy,
    idempotency: tool.idempotency_strategy,
    timeout: tool.timeout,
    retry_policy: tool.retry_policy,
    audit_event_type: tool.audit_event_type,
    human_approval_requirement: tool.human_approval_requirement,
    approval_requirement: tool.human_approval_requirement,
  }));
}
