import { ExecutionActorType, ExecutionJournalEvent, Prisma } from "@prisma/client";
import { CaseOrchestratorTool } from "@/ai";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export const EXECUTION_JOURNAL_EVENT_TYPES = {
  CASE_CREATED: "CASE_CREATED",
  REFERRAL_VALIDATED: "REFERRAL_VALIDATED",
  BARRIER_INFERRED: "BARRIER_INFERRED",
  BARRIER_CONFIRMED: "BARRIER_CONFIRMED",
  INTERVENTION_REVIEWED: "INTERVENTION_REVIEWED",
  PROVIDER_SEARCH_STARTED: "PROVIDER_SEARCH_STARTED",
  PROVIDER_AVAILABILITY_CHECKED: "PROVIDER_AVAILABILITY_CHECKED",
  PROVIDER_SELECTED: "PROVIDER_SELECTED",
  OUTREACH_SENT: "OUTREACH_SENT",
  SCHEDULING_REQUESTED: "SCHEDULING_REQUESTED",
  APPOINTMENT_SCHEDULED: "APPOINTMENT_SCHEDULED",
  HUMAN_APPROVAL_REQUESTED: "HUMAN_APPROVAL_REQUESTED",
  HUMAN_APPROVAL_GRANTED: "HUMAN_APPROVAL_GRANTED",
  HUMAN_APPROVAL_REJECTED: "HUMAN_APPROVAL_REJECTED",
  HUMAN_APPROVAL_CANCELLED: "HUMAN_APPROVAL_CANCELLED",
  AGENT_STARTED: "AGENT_STARTED",
  AGENT_PAUSED: "AGENT_PAUSED",
  AGENT_RESUMED: "AGENT_RESUMED",
  AGENT_RETRIED: "AGENT_RETRIED",
  AGENT_CANCELLED: "AGENT_CANCELLED",
  AGENT_COMPLETED: "AGENT_COMPLETED",
  AGENT_FAILED: "AGENT_FAILED",
  AGENT_ESCALATED: "AGENT_ESCALATED",
  APPOINTMENT_VERIFIED: "APPOINTMENT_VERIFIED",
  COMPLETION_VERIFIED: "COMPLETION_VERIFIED",
  CASE_ESCALATED: "CASE_ESCALATED",
  CASE_CLOSED: "CASE_CLOSED",
  ORCHESTRATOR_DECISION_RECORDED: "ORCHESTRATOR_DECISION_RECORDED",
} as const;

export type ExecutionJournalEventType =
  (typeof EXECUTION_JOURNAL_EVENT_TYPES)[keyof typeof EXECUTION_JOURNAL_EVENT_TYPES];

export interface ExecutionJournalEntry {
  event_id: string;
  case_id: string;
  actor_type: ExecutionActorType;
  actor_id: string;
  event_type: string;
  timestamp: string;
  input_reference: string | null;
  output_reference: string | null;
  policy_decision: string | null;
  evidence: unknown[];
  correlation_id: string | null;
}

export function toExecutionJournalEntry(row: ExecutionJournalEvent): ExecutionJournalEntry {
  const evidence = Array.isArray(row.evidence)
    ? row.evidence
    : row.evidence !== null && row.evidence !== undefined
      ? [row.evidence]
      : [];

  return {
    event_id: row.id,
    case_id: row.caseId,
    actor_type: row.actorType,
    actor_id: row.actorId,
    event_type: row.eventType,
    timestamp: row.timestamp.toISOString(),
    input_reference: row.inputReference ?? null,
    output_reference: row.outputReference ?? null,
    policy_decision: row.policyDecision ?? null,
    evidence,
    correlation_id: row.correlationId ?? null,
  };
}

export async function recordExecutionEvent(params: {
  tenantId: string;
  caseId: string;
  actorType: ExecutionActorType;
  actorId: string;
  eventType: string;
  inputReference?: string | null;
  outputReference?: string | null;
  policyDecision?: string | null;
  evidence?: unknown[];
  correlationId?: string | null;
  timestamp?: Date;
}): Promise<ExecutionJournalEntry> {
  const created = await prisma.executionJournalEvent.create({
    data: {
      tenantId: params.tenantId,
      caseId: params.caseId,
      actorType: params.actorType,
      actorId: params.actorId,
      eventType: params.eventType,
      timestamp: params.timestamp ?? new Date(),
      inputReference: params.inputReference ?? null,
      outputReference: params.outputReference ?? null,
      policyDecision: params.policyDecision ?? null,
      evidence: (params.evidence ?? []) as Prisma.InputJsonValue,
      correlationId: params.correlationId ?? null,
    },
  });

  return toExecutionJournalEntry(created);
}

export async function listCaseExecutionJournal(
  session: SessionUser,
  caseId: string,
  options?: {
    eventType?: string;
    correlationId?: string;
  }
): Promise<ExecutionJournalEntry[]> {
  requirePermission(session, PERMISSIONS.CASES_READ);

  const careCase = await prisma.case.findFirst({
    where: { id: caseId, tenantId: session.tenantId },
    select: { id: true },
  });
  if (!careCase) {
    throw new NotFoundError("Case", caseId);
  }

  const rows = await prisma.executionJournalEvent.findMany({
    where: {
      tenantId: session.tenantId,
      caseId,
      ...(options?.eventType ? { eventType: options.eventType } : {}),
      ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
    },
    orderBy: [{ timestamp: "asc" }, { createdAt: "asc" }],
  });

  return rows.map(toExecutionJournalEntry);
}

const TOOL_TO_JOURNAL_EVENT_MAP: Record<CaseOrchestratorTool, ExecutionJournalEventType> = {
  run_ai_assessment: EXECUTION_JOURNAL_EVENT_TYPES.BARRIER_INFERRED,
  human_barrier_review: EXECUTION_JOURNAL_EVENT_TYPES.BARRIER_CONFIRMED,
  human_intervention_approval: EXECUTION_JOURNAL_EVENT_TYPES.INTERVENTION_REVIEWED,
  search_providers: EXECUTION_JOURNAL_EVENT_TYPES.PROVIDER_SEARCH_STARTED,
  check_provider_availability: EXECUTION_JOURNAL_EVENT_TYPES.PROVIDER_AVAILABILITY_CHECKED,
  request_scheduling: EXECUTION_JOURNAL_EVENT_TYPES.SCHEDULING_REQUESTED,
  schedule_appointment: EXECUTION_JOURNAL_EVENT_TYPES.APPOINTMENT_SCHEDULED,
  send_reminder: EXECUTION_JOURNAL_EVENT_TYPES.OUTREACH_SENT,
  send_member_communication: EXECUTION_JOURNAL_EVENT_TYPES.OUTREACH_SENT,
  verify_appointment: EXECUTION_JOURNAL_EVENT_TYPES.APPOINTMENT_VERIFIED,
  verify_completion: EXECUTION_JOURNAL_EVENT_TYPES.COMPLETION_VERIFIED,
  escalate_to_human: EXECUTION_JOURNAL_EVENT_TYPES.CASE_ESCALATED,
  close_verified_case: EXECUTION_JOURNAL_EVENT_TYPES.CASE_CLOSED,
};

export function mapToolToJournalEventType(tool: CaseOrchestratorTool): ExecutionJournalEventType {
  return TOOL_TO_JOURNAL_EVENT_MAP[tool];
}
