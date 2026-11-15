import { ApprovalRequest, ApprovalStatus, CaseStatus, Prisma } from "@prisma/client";
import {
  CareLoopCaseOrchestrator,
  CaseOrchestratorDecision,
  CaseOrchestratorInput,
  CaseOrchestratorTool,
  evaluateCareLoopPolicy,
  getToolDefinition,
  validateToolInput,
} from "@/ai";
import { validateAgentProposedTransition } from "@/domain/cases/state-machine";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";
import { getCaseDetail } from "./case-service";
import { recordAIDecisionTrace } from "./decision-trace-service";
import { EXECUTION_JOURNAL_EVENT_TYPES, recordExecutionEvent } from "./execution-journal-service";
import { completeAgentRun, failAgentRun, startAgentRun } from "./observability-service";
import { ExecuteToolResult, executeCareLoopTool } from "./tool-executor";

export interface ApprovalRecord {
  approval_id: string;
  case_id: string;
  action: string;
  reason: string;
  risk_level: string;
  requested_by: string;
  requested_at: string;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  decision: "APPROVED" | "REJECTED" | null;
  comments: string | null;
  expires_at: string | null;
  resumed_at: string | null;
}

const DEFAULT_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export function toApprovalRecord(row: ApprovalRequest): ApprovalRecord {
  return {
    approval_id: row.id,
    case_id: row.caseId,
    action: row.action,
    reason: row.reason,
    risk_level: row.riskLevel,
    requested_by: row.requestedBy,
    requested_at: row.requestedAt.toISOString(),
    status: row.status,
    approved_by: row.approvedById ?? null,
    approved_at: row.approvedAt ? row.approvedAt.toISOString() : null,
    decision:
      row.decision === "APPROVED" || row.decision === "REJECTED"
        ? row.decision
        : null,
    comments: row.comments ?? null,
    expires_at: row.expiresAt ? row.expiresAt.toISOString() : null,
    resumed_at: row.resumedAt ? row.resumedAt.toISOString() : null,
  };
}

async function expireIfStale(row: ApprovalRequest): Promise<ApprovalRequest> {
  if (row.status === "PENDING" && row.expiresAt && row.expiresAt <= new Date()) {
    const updated = await prisma.approvalRequest.update({
      where: { id: row.id },
      data: { status: "EXPIRED" },
    });
    await syncCaseHumanReviewFlag(updated.tenantId, updated.caseId);
    return updated;
  }
  return row;
}

async function syncCaseHumanReviewFlag(tenantId: string, caseId: string): Promise<void> {
  const pendingCount = await prisma.approvalRequest.count({
    where: {
      tenantId,
      caseId,
      status: "PENDING",
    },
  });
  await prisma.case.updateMany({
    where: { id: caseId, tenantId },
    data: { humanReviewRequired: pendingCount > 0 },
  });
}

export async function requestHumanApproval(params: {
  session: SessionUser;
  caseId: string;
  action: CaseOrchestratorTool;
  reason: string;
  riskLevel?: string;
  requestedBy?: string;
  toolInput?: Record<string, unknown>;
  proposedNextState?: CaseStatus | null;
  orchestratorSnapshot?: CaseOrchestratorDecision;
  expiresAt?: Date;
  idempotencyKey?: string;
  correlationId?: string;
}): Promise<ApprovalRecord> {
  requirePermission(params.session, PERMISSIONS.AI_RUN);

  const toolDef = getToolDefinition(params.action);
  const careCase = await getCaseDetail(params.session.tenantId, params.caseId);

  const normalizedToolInput = params.toolInput
    ? {
        ...params.toolInput,
        tenantId: params.session.tenantId,
        caseId: careCase.id,
      }
    : undefined;

  if (normalizedToolInput) {
    validateToolInput(params.action, normalizedToolInput);
  }
  if (params.proposedNextState) {
    validateAgentProposedTransition(careCase.status, params.proposedNextState);
  }

  const expiresAt = params.expiresAt ?? new Date(Date.now() + DEFAULT_APPROVAL_TTL_MS);
  const effectiveRiskLevel = params.riskLevel ?? toolDef.risk_level;
  const requestedBy = params.requestedBy ?? "CareLoopCaseOrchestrator";

  const created = await prisma.approvalRequest.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      action: params.action,
      reason: params.reason,
      riskLevel: effectiveRiskLevel,
      requestedBy,
      requestedByUserId:
        params.session.isServiceIdentity || params.session.userId.startsWith("agent:")
          ? null
          : params.session.userId,
      expiresAt,
      status: "PENDING",
      toolInputJson: (normalizedToolInput ?? {
        tenantId: params.session.tenantId,
        caseId: careCase.id,
      }) as Prisma.InputJsonValue,
      proposedNextState: params.proposedNextState ?? null,
      orchestratorSnapshot: params.orchestratorSnapshot
        ? (params.orchestratorSnapshot as unknown as Prisma.InputJsonValue)
        : undefined,
      idempotencyKey: params.idempotencyKey ?? null,
    },
  });

  await prisma.case.update({
    where: { id: careCase.id },
    data: { humanReviewRequired: true },
  });

  await prisma.workflowEvent.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      eventType: "APPROVAL_REQUESTED",
      fromStatus: careCase.status,
      toStatus: careCase.status,
      actorId: params.session.userId,
      actorRole: params.session.role,
      reason: `Human approval requested for '${params.action}' (${effectiveRiskLevel})`,
      metadata: {
        approvalId: created.id,
        action: params.action,
        riskLevel: effectiveRiskLevel,
        expiresAt: expiresAt.toISOString(),
        correlationId: params.correlationId ?? null,
      },
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "APPROVAL_REQUESTED",
    entityType: "ApprovalRequest",
    entityId: created.id,
    correlationId: params.correlationId,
    summary: `Requested human approval (${created.id}) for action '${params.action}' on case ${careCase.id}`,
    metadata: {
      caseId: careCase.id,
      action: params.action,
      riskLevel: effectiveRiskLevel,
      status: created.status,
    },
  });

  await recordExecutionEvent({
    tenantId: params.session.tenantId,
    caseId: careCase.id,
    actorType: "AGENT",
    actorId: requestedBy,
    eventType: EXECUTION_JOURNAL_EVENT_TYPES.HUMAN_APPROVAL_REQUESTED,
    inputReference: `tool:${params.action}`,
    outputReference: `approval:${created.id}`,
    policyDecision: "REQUIRE_HUMAN_APPROVAL",
    evidence: [`risk_level=${effectiveRiskLevel}`, `expires_at=${expiresAt.toISOString()}`],
    correlationId: params.correlationId ?? null,
  });

  return toApprovalRecord(created);
}

export async function listCaseApprovals(
  session: SessionUser,
  caseId: string
): Promise<ApprovalRecord[]> {
  requirePermission(session, PERMISSIONS.CASES_READ);
  await getCaseDetail(session.tenantId, caseId);

  await prisma.approvalRequest.updateMany({
    where: {
      tenantId: session.tenantId,
      caseId,
      status: "PENDING",
      expiresAt: { lte: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  await syncCaseHumanReviewFlag(session.tenantId, caseId);

  const rows = await prisma.approvalRequest.findMany({
    where: {
      tenantId: session.tenantId,
      caseId,
    },
    orderBy: { requestedAt: "desc" },
  });

  return rows.map(toApprovalRecord);
}

export interface TenantApprovalListItem extends ApprovalRecord {
  caseStatus: string;
  caseRiskLevel: string | null;
  specialty: string;
  memberLabel: string;
}

export async function listTenantApprovals(
  session: SessionUser,
  statusFilter?: ApprovalStatus
): Promise<TenantApprovalListItem[]> {
  requirePermission(session, PERMISSIONS.CASES_READ);

  await prisma.approvalRequest.updateMany({
    where: {
      tenantId: session.tenantId,
      status: "PENDING",
      expiresAt: { lte: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  const rows = await prisma.approvalRequest.findMany({
    where: {
      tenantId: session.tenantId,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      careCase: {
        select: {
          status: true,
          riskLevel: true,
          referral: { select: { specialty: true } },
          member: { select: { externalMemberId: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 100,
  });

  return rows.map((row) => ({
    ...toApprovalRecord(row),
    caseStatus: row.careCase.status,
    caseRiskLevel: row.careCase.riskLevel,
    specialty: row.careCase.referral.specialty,
    memberLabel: row.careCase.member.externalMemberId,
  }));
}

export async function getApprovalRecord(
  session: SessionUser,
  approvalId: string
): Promise<ApprovalRecord> {
  requirePermission(session, PERMISSIONS.CASES_READ);
  const existing = await prisma.approvalRequest.findFirst({
    where: {
      id: approvalId,
      tenantId: session.tenantId,
    },
  });
  if (!existing) {
    throw new NotFoundError("ApprovalRequest", approvalId);
  }
  const checked = await expireIfStale(existing);
  return toApprovalRecord(checked);
}

export async function decideHumanApproval(params: {
  session: SessionUser;
  approvalId: string;
  decision: "APPROVED" | "REJECTED";
  comments?: string;
  correlationId?: string;
}): Promise<ApprovalRecord> {
  requirePermission(params.session, PERMISSIONS.AI_REVIEW);

  if (params.decision !== "APPROVED" && params.decision !== "REJECTED") {
    throw new ValidationError("Approval decision must be 'APPROVED' or 'REJECTED'.");
  }

  const existing = await prisma.approvalRequest.findFirst({
    where: {
      id: params.approvalId,
      tenantId: params.session.tenantId,
    },
  });
  if (!existing) {
    throw new NotFoundError("ApprovalRequest", params.approvalId);
  }

  const current = await expireIfStale(existing);
  if (current.status === "EXPIRED") {
    throw new ValidationError(`ApprovalRequest '${current.id}' has expired and cannot be decided.`);
  }
  if (current.status !== "PENDING") {
    throw new ValidationError(
      `ApprovalRequest '${current.id}' has status '${current.status}' and cannot be decided.`
    );
  }

  const now = new Date();
  const updated = await prisma.approvalRequest.update({
    where: { id: current.id },
    data: {
      status: params.decision,
      approvedById: params.session.userId,
      approvedAt: now,
      decision: params.decision,
      comments: params.comments ?? null,
    },
  });

  if (params.decision === "REJECTED") {
    await syncCaseHumanReviewFlag(params.session.tenantId, updated.caseId);
  }

  const careCaseRow = await prisma.case.findUniqueOrThrow({ where: { id: updated.caseId } });
  await prisma.workflowEvent.create({
    data: {
      tenantId: params.session.tenantId,
      caseId: updated.caseId,
      eventType: "APPROVAL_DECIDED",
      fromStatus: careCaseRow.status,
      toStatus: careCaseRow.status,
      actorId: params.session.userId,
      actorRole: params.session.role,
      reason: `Approval '${updated.action}' ${params.decision.toLowerCase()} by ${params.session.name}`,
      metadata: {
        approvalId: updated.id,
        decision: params.decision,
        correlationId: params.correlationId ?? null,
      },
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "APPROVAL_DECIDED",
    entityType: "ApprovalRequest",
    entityId: updated.id,
    correlationId: params.correlationId,
    summary: `Human reviewer ${params.decision.toLowerCase()} approval ${updated.id} for '${updated.action}'`,
    metadata: {
      caseId: updated.caseId,
      action: updated.action,
      decision: params.decision,
      status: updated.status,
    },
  });

  await recordExecutionEvent({
    tenantId: params.session.tenantId,
    caseId: updated.caseId,
    actorType: "HUMAN",
    actorId: params.session.userId,
    eventType:
      params.decision === "APPROVED"
        ? EXECUTION_JOURNAL_EVENT_TYPES.HUMAN_APPROVAL_GRANTED
        : EXECUTION_JOURNAL_EVENT_TYPES.HUMAN_APPROVAL_REJECTED,
    inputReference: `approval:${updated.id}`,
    outputReference: `decision:${params.decision}`,
    policyDecision: params.decision,
    evidence: [`action=${updated.action}`],
    correlationId: params.correlationId ?? null,
  });

  return toApprovalRecord(updated);
}

export async function cancelHumanApproval(params: {
  session: SessionUser;
  approvalId: string;
  comments?: string;
  correlationId?: string;
}): Promise<ApprovalRecord> {
  requirePermission(params.session, PERMISSIONS.CASES_MANAGE);

  const existing = await prisma.approvalRequest.findFirst({
    where: {
      id: params.approvalId,
      tenantId: params.session.tenantId,
    },
  });
  if (!existing) {
    throw new NotFoundError("ApprovalRequest", params.approvalId);
  }

  const current = await expireIfStale(existing);
  if (current.status !== "PENDING") {
    throw new ValidationError(
      `ApprovalRequest '${current.id}' has status '${current.status}' and cannot be cancelled.`
    );
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: current.id },
    data: {
      status: "CANCELLED",
      comments: params.comments ?? current.comments,
    },
  });

  await syncCaseHumanReviewFlag(params.session.tenantId, updated.caseId);

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "APPROVAL_CANCELLED",
    entityType: "ApprovalRequest",
    entityId: updated.id,
    correlationId: params.correlationId,
    summary: `Approval ${updated.id} for '${updated.action}' cancelled`,
    metadata: {
      caseId: updated.caseId,
      action: updated.action,
      status: updated.status,
    },
  });

  return toApprovalRecord(updated);
}

export async function resumeAgentFromApproval(params: {
  session: SessionUser;
  approvalId: string;
  correlationId?: string;
}): Promise<{
  approval: ApprovalRecord;
  replayed: boolean;
  toolResult: ExecuteToolResult;
  nextDecision: CaseOrchestratorDecision;
}> {
  requirePermission(params.session, PERMISSIONS.AI_RUN);

  const existing = await prisma.approvalRequest.findFirst({
    where: {
      id: params.approvalId,
      tenantId: params.session.tenantId,
    },
  });
  if (!existing) {
    throw new NotFoundError("ApprovalRequest", params.approvalId);
  }

  const current = await expireIfStale(existing);
  if (current.status !== "APPROVED") {
    throw new ValidationError(
      `Agent cannot resume from approval '${current.id}' because its status is '${current.status}' (must be APPROVED).`
    );
  }

  // Idempotent replay if already resumed
  if (current.resumedAt && current.executionResultJson) {
    const persistedCase = await getCaseDetail(params.session.tenantId, current.caseId);
    const nextDecision = computeOrchestratorDecisionFromCase(persistedCase);
    return {
      approval: toApprovalRecord(current),
      replayed: true,
      toolResult: current.executionResultJson as unknown as ExecuteToolResult,
      nextDecision,
    };
  }

  const agentRun = await startAgentRun({
    tenantId: params.session.tenantId,
    caseId: current.caseId,
    correlationId: params.correlationId ?? null,
  });

  try {
    const tool = current.action as CaseOrchestratorTool;
    const toolInput =
      current.toolInputJson && typeof current.toolInputJson === "object"
        ? (current.toolInputJson as Record<string, unknown>)
        : { caseId: current.caseId };

    const proposedNextState = current.proposedNextState
      ? (current.proposedNextState as CaseStatus)
      : undefined;

    const toolResult = await executeCareLoopTool({
      session: params.session,
      tool,
      input: toolInput,
      proposedNextState,
      approvalId: current.id,
      agentRunId: agentRun.id,
      humanApproved: true,
      idempotencyKey: current.idempotencyKey ?? `approval-resume-${current.id}`,
      correlationId: params.correlationId,
    });

    const resumedAt = new Date();
    const updated = await prisma.approvalRequest.update({
      where: { id: current.id },
      data: {
        resumedAt,
        executionResultJson: toolResult as unknown as Prisma.InputJsonValue,
      },
    });

    await syncCaseHumanReviewFlag(params.session.tenantId, updated.caseId);

    const refreshedCase = await getCaseDetail(params.session.tenantId, updated.caseId);

    await prisma.workflowEvent.create({
      data: {
        tenantId: params.session.tenantId,
        caseId: updated.caseId,
        eventType: "AGENT_RESUMED",
        fromStatus: refreshedCase.status,
        toStatus: refreshedCase.status,
        actorId: params.session.userId,
        actorRole: params.session.role,
        reason: `Agent resumed from approved request '${updated.action}'`,
        metadata: {
          approvalId: updated.id,
          action: updated.action,
          resumedAt: resumedAt.toISOString(),
          correlationId: params.correlationId ?? null,
        },
      },
    });

    await recordAuditEvent({
      tenantId: params.session.tenantId,
      actorId: params.session.userId,
      actorEmail: params.session.email,
      actorRole: params.session.role,
      action: "AGENT_RESUMED",
      entityType: "ApprovalRequest",
      entityId: updated.id,
      correlationId: params.correlationId,
      summary: `Agent resumed persisted execution for '${updated.action}' from approval ${updated.id}`,
      metadata: {
        caseId: updated.caseId,
        action: updated.action,
        replayed: toolResult.replayed,
      },
    });

    await recordExecutionEvent({
      tenantId: params.session.tenantId,
      caseId: updated.caseId,
      actorType: "AGENT",
      actorId: "CareLoopCaseOrchestrator",
      eventType: EXECUTION_JOURNAL_EVENT_TYPES.AGENT_RESUMED,
      inputReference: `approval:${updated.id}`,
      outputReference: `tool:${updated.action}`,
      policyDecision: "ALLOW",
      evidence: [`replayed=${String(toolResult.replayed)}`],
      correlationId: params.correlationId ?? null,
    });

    const { input: nextInput, decision: nextDecision } =
      computeOrchestratorInputAndDecision(refreshedCase);
    const nextPolicyVerdict = evaluateCareLoopPolicy({
      action: nextDecision.tool,
      caseState: nextDecision.current_state,
      riskTier: refreshedCase.riskLevel,
      consentOutreach: refreshedCase.member.consentOutreach,
      consentSms: refreshedCase.member.consentSms,
      matchedProviderId: refreshedCase.matchedProviderId,
      hasVerifiedCompletion: Boolean(refreshedCase.firstCompletedVisitAt),
      humanApproved: false,
      policyCheckRequired: nextDecision.policy_check_required,
    });

    const trace = await recordAIDecisionTrace({
      tenantId: params.session.tenantId,
      caseId: updated.caseId,
      inputContext: nextInput,
      decision: `${nextDecision.recommended_action}: ${nextDecision.reason}`,
      confidence: nextDecision.confidence,
      evidence: nextDecision.evidence,
      policyResult: nextPolicyVerdict.decision,
      toolSelected: nextDecision.tool,
      humanApprovalRequired:
        nextPolicyVerdict.requires_human_approval || nextDecision.requires_human,
      correlationId: params.correlationId ?? null,
    });

    await completeAgentRun({
      agentRunId: agentRun.id,
      status: "COMPLETED",
      startedAt: agentRun.startedAt,
      decisionTraceId: trace.decision_id,
      approvalRequestId: updated.id,
      policyResult: nextPolicyVerdict.decision,
    });

    return {
      approval: toApprovalRecord(updated),
      replayed: false,
      toolResult,
      nextDecision,
    };
  } catch (err) {
    await failAgentRun({
      agentRunId: agentRun.id,
      startedAt: agentRun.startedAt,
      errorMessage: err instanceof Error ? err.message : "Agent resume failed",
    }).catch(() => undefined);
    throw err;
  }
}

function buildOrchestratorInputFromCase(
  careCase: Awaited<ReturnType<typeof getCaseDetail>>
): CaseOrchestratorInput {
  return CareLoopCaseOrchestrator.buildInput({
    id: careCase.id,
    goal: careCase.goal,
    status: careCase.status,
    riskLevel: careCase.riskLevel,
    priorityScore: careCase.priorityScore,
    humanReviewRequired: careCase.humanReviewRequired,
    matchedProviderId: careCase.matchedProviderId,
    firstCompletedVisitAt: careCase.firstCompletedVisitAt,
    member: {
      preferredLanguage: careCase.member.preferredLanguage,
      urbanicity: careCase.member.urbanicity,
      digitalAccessLevel: careCase.member.digitalAccessLevel,
      transportationAccess: careCase.member.transportationAccess,
      consentOutreach: careCase.member.consentOutreach,
      consentSms: careCase.member.consentSms,
      priorNoShowCount: careCase.member.priorNoShowCount,
    },
    referral: {
      behavioralHealthNeed: careCase.referral.behavioralHealthNeed,
      specialty: careCase.referral.specialty,
      urgency: careCase.referral.urgency,
      geography: careCase.referral.geography,
      networkRequired: careCase.referral.networkRequired,
      eligibilityVerified: careCase.referral.eligibilityVerified,
    },
    barriers: careCase.barriers.map((b) => ({
      category: b.category,
      subBarrier: b.subBarrier,
      epistemicStatus: b.epistemicStatus,
      confirmedByHuman: b.confirmedByHuman,
      resolved: b.resolved,
    })),
    riskAssessments: careCase.riskAssessments.map((r) => ({
      riskLevel: r.riskLevel,
      score: r.score,
    })),
    interventions: careCase.interventions.map((i) => ({
      type: i.type,
      status: i.status,
      outcomes: i.outcomes.map((o) => ({ outcomeStatus: o.outcomeStatus })),
    })),
    appointments: careCase.appointments.map((a) => ({
      status: a.status,
    })),
    verifications: careCase.verifications.map((v) => ({
      verified: v.verified,
      verificationStatus: v.verificationStatus,
    })),
  });
}

function computeOrchestratorInputAndDecision(
  careCase: Awaited<ReturnType<typeof getCaseDetail>>
): { input: CaseOrchestratorInput; decision: CaseOrchestratorDecision } {
  const input = buildOrchestratorInputFromCase(careCase);
  const decision = CareLoopCaseOrchestrator.decideNextStep(input);
  return { input, decision };
}

function computeOrchestratorDecisionFromCase(
  careCase: Awaited<ReturnType<typeof getCaseDetail>>
): CaseOrchestratorDecision {
  return computeOrchestratorInputAndDecision(careCase).decision;
}

export async function runOrchestratorWithApprovalGate(params: {
  session: SessionUser;
  caseId: string;
  toolInput?: Record<string, unknown>;
  sensitiveCommunication?: boolean;
  correlationId?: string;
}): Promise<
  | {
      gated: true;
      decision: CaseOrchestratorDecision;
      approval: ApprovalRecord;
    }
  | {
      gated: false;
      decision: CaseOrchestratorDecision;
      toolResult?: ExecuteToolResult;
    }
> {
  requirePermission(params.session, PERMISSIONS.AI_RUN);
  const careCase = await getCaseDetail(params.session.tenantId, params.caseId);
  const agentRun = await startAgentRun({
    tenantId: params.session.tenantId,
    caseId: careCase.id,
    correlationId: params.correlationId ?? null,
  });

  try {
    const { input: orchestratorInput, decision } = computeOrchestratorInputAndDecision(careCase);

    const policyVerdict = evaluateCareLoopPolicy({
      action: decision.tool,
      caseState: decision.current_state,
      riskTier: careCase.riskLevel,
      consentOutreach: careCase.member.consentOutreach,
      consentSms: careCase.member.consentSms,
      sensitiveCommunication: params.sensitiveCommunication,
      matchedProviderId: careCase.matchedProviderId,
      hasVerifiedCompletion: Boolean(careCase.firstCompletedVisitAt),
      humanApproved: false,
      policyCheckRequired: decision.policy_check_required,
    });

    const trace = await recordAIDecisionTrace({
      tenantId: params.session.tenantId,
      caseId: careCase.id,
      inputContext: orchestratorInput,
      decision: `${decision.recommended_action}: ${decision.reason}`,
      confidence: decision.confidence,
      evidence: decision.evidence,
      policyResult: policyVerdict.decision,
      toolSelected: decision.tool,
      humanApprovalRequired:
        policyVerdict.requires_human_approval || decision.requires_human,
      correlationId: params.correlationId ?? null,
    });

    if (policyVerdict.decision === "REQUIRE_HUMAN_APPROVAL" || decision.requires_human) {
      const approval = await requestHumanApproval({
        session: params.session,
        caseId: careCase.id,
        action: decision.tool,
        reason: decision.reason,
        riskLevel: getToolDefinition(decision.tool).risk_level,
        requestedBy: "CareLoopCaseOrchestrator",
        toolInput: params.toolInput,
        proposedNextState: decision.proposed_next_state ?? null,
        orchestratorSnapshot: decision,
        correlationId: params.correlationId,
      });
      await completeAgentRun({
        agentRunId: agentRun.id,
        status: "AWAITING_APPROVAL",
        startedAt: agentRun.startedAt,
        decisionTraceId: trace.decision_id,
        approvalRequestId: approval.approval_id,
        policyResult: policyVerdict.decision,
      });
      return { gated: true, decision, approval };
    }

    if (params.toolInput) {
      const toolResult = await executeCareLoopTool({
        session: params.session,
        tool: decision.tool,
        input: params.toolInput,
        proposedNextState: decision.proposed_next_state ?? undefined,
        agentRunId: agentRun.id,
        correlationId: params.correlationId,
      });
      await completeAgentRun({
        agentRunId: agentRun.id,
        status: "COMPLETED",
        startedAt: agentRun.startedAt,
        decisionTraceId: trace.decision_id,
        policyResult: policyVerdict.decision,
      });
      return { gated: false, decision, toolResult };
    }

    await completeAgentRun({
      agentRunId: agentRun.id,
      status: "COMPLETED",
      startedAt: agentRun.startedAt,
      decisionTraceId: trace.decision_id,
      policyResult: policyVerdict.decision,
    });
    return { gated: false, decision };
  } catch (err) {
    await failAgentRun({
      agentRunId: agentRun.id,
      startedAt: agentRun.startedAt,
      errorMessage: err instanceof Error ? err.message : "Orchestrator run failed",
    }).catch(() => undefined);
    throw err;
  }
}
