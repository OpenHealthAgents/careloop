import { createHash } from "crypto";
import { AIDecisionTrace, Prisma } from "@prisma/client";
import {
  formatVersionProvenance,
  getVersionManifest,
  VersionProvenance,
} from "@/domain/versioning";
import { getActiveVersionManifest } from "./version-service";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export interface AIDecisionTraceRecord {
  decision_id: string;
  case_id: string;
  agent: string;
  model: string;
  prompt_version: string;
  input_context_hash: string;
  decision: string;
  confidence: number;
  evidence: string[];
  policy_result: string;
  tool_selected: string;
  human_approval_required: boolean;
  created_at: string;
  version_provenance?: VersionProvenance;
}

const MAX_DECISION_SUMMARY_LENGTH = 500;
const MAX_EVIDENCE_ITEMS = 25;
const MAX_EVIDENCE_ITEM_LENGTH = 240;

const CHAIN_OF_THOUGHT_PATTERNS = [
  /<think>[\s\S]*?<\/think>/gi,
  /<thinking>[\s\S]*?<\/thinking>/gi,
  /<reasoning>[\s\S]*?<\/reasoning>/gi,
  /<scratchpad>[\s\S]*?<\/scratchpad>/gi,
  /<analysis>[\s\S]*?<\/analysis>/gi,
];

function canonicalizeForHash(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalizeForHash);
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, canonicalizeForHash(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Deterministic SHA-256 digest of canonicalized agent input context.
 * Enables auditability & reproducibility checks without storing raw PHI context.
 */
export function computeInputContextHash(inputContext: unknown): string {
  const serialized = JSON.stringify(canonicalizeForHash(inputContext));
  return createHash("sha256").update(serialized).digest("hex");
}

/**
 * Strips hidden chain-of-thought / scratchpad blocks and bounds length
 * so only concise, auditable decision explanations are persisted.
 */
export function sanitizeConciseDecisionExplanation(raw: string): string {
  let cleaned = raw;
  for (const pattern of CHAIN_OF_THOUGHT_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length > MAX_DECISION_SUMMARY_LENGTH) {
    return `${cleaned.slice(0, MAX_DECISION_SUMMARY_LENGTH - 3)}...`;
  }
  return cleaned;
}

function sanitizeEvidenceList(evidence: string[]): string[] {
  return evidence
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((item) => sanitizeConciseDecisionExplanation(String(item)).slice(0, MAX_EVIDENCE_ITEM_LENGTH))
    .filter((item) => item.length > 0);
}

export function toAIDecisionTraceRecord(row: AIDecisionTrace): AIDecisionTraceRecord {
  const evidence = Array.isArray(row.evidence)
    ? row.evidence.map((e) => String(e))
    : [];

  const manifestTag = evidence.find((e) => e.startsWith("version:"));
  let provenance: VersionProvenance | undefined;
  if (manifestTag) {
    try {
      const manifest = getVersionManifest(manifestTag.replace("version:", ""));
      provenance = formatVersionProvenance(manifest);
    } catch {
      // ignore
    }
  }

  return {
    decision_id: row.id,
    case_id: row.caseId,
    agent: row.agent,
    model: row.model,
    prompt_version: row.promptVersion,
    input_context_hash: row.inputContextHash,
    decision: row.decision,
    confidence: row.confidence,
    evidence,
    policy_result: row.policyResult,
    tool_selected: row.toolSelected,
    human_approval_required: row.humanApprovalRequired,
    created_at: row.createdAt.toISOString(),
    version_provenance: provenance,
  };
}

export async function recordAIDecisionTrace(params: {
  tenantId: string;
  caseId: string;
  agent?: string;
  model?: string;
  promptVersion?: string;
  inputContext?: unknown;
  inputContextHash?: string;
  decision: string;
  confidence: number;
  evidence: string[];
  policyResult: string;
  toolSelected: string;
  humanApprovalRequired: boolean;
  correlationId?: string | null;
}): Promise<AIDecisionTraceRecord> {
  const inputContextHash =
    params.inputContextHash ?? computeInputContextHash(params.inputContext ?? { caseId: params.caseId });

  const activeManifest = await getActiveVersionManifest(params.tenantId);
  const versionTag = `version:${activeManifest.versionLabel}`;

  const evidenceWithVersion = params.evidence.some((e) => e.startsWith("version:"))
    ? params.evidence
    : [...params.evidence, versionTag];

  const conciseDecision = sanitizeConciseDecisionExplanation(params.decision);
  const sanitizedEvidence = sanitizeEvidenceList(evidenceWithVersion);
  const clampedConfidence = Math.max(0, Math.min(1, params.confidence));

  const created = await prisma.aIDecisionTrace.create({
    data: {
      tenantId: params.tenantId,
      caseId: params.caseId,
      agent: params.agent ?? activeManifest.components.agent.id,
      model: params.model ?? activeManifest.components.model.name,
      promptVersion: params.promptVersion ?? activeManifest.components.prompt.version,
      inputContextHash,
      decision: conciseDecision,
      confidence: clampedConfidence,
      evidence: sanitizedEvidence as Prisma.InputJsonValue,
      policyResult: params.policyResult,
      toolSelected: params.toolSelected,
      humanApprovalRequired: params.humanApprovalRequired,
      correlationId: params.correlationId ?? null,
    },
  });

  return toAIDecisionTraceRecord(created);
}

export async function listCaseDecisionTraces(
  session: SessionUser,
  caseId: string,
  options?: {
    agent?: string;
    correlationId?: string;
  }
): Promise<AIDecisionTraceRecord[]> {
  requirePermission(session, PERMISSIONS.CASES_READ);

  const careCase = await prisma.case.findFirst({
    where: { id: caseId, tenantId: session.tenantId },
    select: { id: true },
  });
  if (!careCase) {
    throw new NotFoundError("Case", caseId);
  }

  const rows = await prisma.aIDecisionTrace.findMany({
    where: {
      tenantId: session.tenantId,
      caseId,
      ...(options?.agent ? { agent: options.agent } : {}),
      ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return rows.map(toAIDecisionTraceRecord);
}
