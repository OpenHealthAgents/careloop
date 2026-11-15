import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { redactSensitiveFields, sanitizeAuditText } from "@/lib/logger";

export type AuditActionCategory =
  | "HUMAN_ACTION"
  | "AGENT_DECISION"
  | "TOOL_CALL"
  | "POLICY_DECISION"
  | "STATE_TRANSITION"
  | "APPROVAL"
  | "COMMUNICATION"
  | "COMPLETION_VERIFICATION";

export interface CompleteAuditRecordInput {
  tenantId: string;
  category: AuditActionCategory;
  who: {
    actorId?: string | null;
    actorEmail?: string | null;
    actorRole?: string | null;
    actorType: "USER" | "AGENT" | "SYSTEM";
  };
  what: {
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
  };
  when?: Date | string;
  why: {
    reason: string;
    rationale?: string | null;
    goal?: string | null;
  };
  underWhichPolicy: {
    policyRuleId?: string | null;
    policyEffect: "ALLOW" | "REQUIRE_HUMAN_APPROVAL" | "REQUIRE_APPROVAL" | "REQUIRE_HUMAN" | "DENY" | "NOT_APPLICABLE";
    policyDetails?: string | null;
    clinicalBoundaryRespected: boolean;
  };
  basedOnWhichEvidence: {
    evidenceSignals: string[];
    evidenceSummary?: string | null;
    provenanceConfidence?: number | null;
    sourceSystems?: string[];
  };
  whatHappened: {
    toolName?: string | null;
    toolInput?: Record<string, unknown> | null;
    toolOutput?: Record<string, unknown> | null;
    status: "SUCCEEDED" | "FAILED" | "PENDING" | "REJECTED" | "ESCALATED";
    errorMessage?: string | null;
  };
  whatChanged: {
    previousState?: Record<string, unknown> | null;
    newState?: Record<string, unknown> | null;
    delta?: Record<string, { from: unknown; to: unknown }> | null;
  };
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TamperEvidentAuditEntry {
  id: string;
  tenantId: string;
  category: AuditActionCategory;
  who: CompleteAuditRecordInput["who"];
  what: CompleteAuditRecordInput["what"];
  when: string;
  why: CompleteAuditRecordInput["why"];
  underWhichPolicy: CompleteAuditRecordInput["underWhichPolicy"];
  basedOnWhichEvidence: CompleteAuditRecordInput["basedOnWhichEvidence"];
  whatHappened: CompleteAuditRecordInput["whatHappened"];
  whatChanged: CompleteAuditRecordInput["whatChanged"];
  correlationId: string | null;
  entryHash: string;
  previousEntryHash: string;
  sequenceNumber: number;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalRecordsChecked: number;
  tamperedRecordId?: string | null;
  expectedHash?: string;
  actualHash?: string;
  reason?: string;
}

function canonicalizeJson(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeJson);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = canonicalizeJson((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Computes deterministic SHA-256 hash of canonized canonical audit record contents.
 */
export function computeAuditEntryHash(params: {
  tenantId: string;
  category: AuditActionCategory;
  who: CompleteAuditRecordInput["who"];
  what: CompleteAuditRecordInput["what"];
  when: string;
  why: CompleteAuditRecordInput["why"];
  underWhichPolicy: CompleteAuditRecordInput["underWhichPolicy"];
  basedOnWhichEvidence: CompleteAuditRecordInput["basedOnWhichEvidence"];
  whatHappened: CompleteAuditRecordInput["whatHappened"];
  whatChanged: CompleteAuditRecordInput["whatChanged"];
  previousEntryHash: string;
  sequenceNumber: number;
}): string {
  const canonicalString = JSON.stringify(
    canonicalizeJson({
      tenantId: params.tenantId,
      category: params.category,
      who: params.who,
      what: params.what,
      when: params.when,
      why: params.why,
      underWhichPolicy: params.underWhichPolicy,
      basedOnWhichEvidence: params.basedOnWhichEvidence,
      whatHappened: params.whatHappened,
      whatChanged: params.whatChanged,
      previousEntryHash: params.previousEntryHash,
      sequenceNumber: params.sequenceNumber,
    })
  );

  return createHash("sha256").update(canonicalString).digest("hex");
}

export function computeStateDelta(
  prev?: Record<string, unknown> | null,
  next?: Record<string, unknown> | null
): Record<string, { from: unknown; to: unknown }> {
  const delta: Record<string, { from: unknown; to: unknown }> = {};
  const prevObj = prev ?? {};
  const nextObj = next ?? {};
  const allKeys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);

  for (const key of allKeys) {
    const fromVal = prevObj[key];
    const toVal = nextObj[key];
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      delta[key] = { from: fromVal, to: toVal };
    }
  }
  return delta;
}

/**
 * Records an immutable, tamper-evident audit log answering all 8 core questions:
 * WHO, WHAT, WHEN, WHY, UNDER WHICH POLICY, BASED ON WHICH EVIDENCE, WHAT HAPPENED, WHAT CHANGED.
 */
export async function recordCompleteAudit(
  input: CompleteAuditRecordInput
): Promise<TamperEvidentAuditEntry> {
  const whenIso = (
    input.when instanceof Date ? input.when : input.when ? new Date(input.when) : new Date()
  ).toISOString();

  // Find latest entry for tenant to build hash chain
  const latestEvent = await prisma.auditEvent.findFirst({
    where: {
      tenantId: input.tenantId,
      source: { in: ["USER", "AGENT", "SYSTEM"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, metadata: true },
  });

  let previousEntryHash = "0000000000000000000000000000000000000000000000000000000000000000";
  let sequenceNumber = 1;

  if (latestEvent?.metadata && typeof latestEvent.metadata === "object") {
    const metaObj = latestEvent.metadata as Record<string, unknown>;
    if (typeof metaObj.entryHash === "string") {
      previousEntryHash = metaObj.entryHash;
    }
    if (typeof metaObj.sequenceNumber === "number") {
      sequenceNumber = metaObj.sequenceNumber + 1;
    }
  }

  const computedDelta =
    input.whatChanged.delta ??
    computeStateDelta(input.whatChanged.previousState, input.whatChanged.newState);

  const whatChangedPayload = {
    previousState: input.whatChanged.previousState ?? null,
    newState: input.whatChanged.newState ?? null,
    delta: computedDelta,
  };

  const entryHash = computeAuditEntryHash({
    tenantId: input.tenantId,
    category: input.category,
    who: input.who,
    what: input.what,
    when: whenIso,
    why: input.why,
    underWhichPolicy: input.underWhichPolicy,
    basedOnWhichEvidence: input.basedOnWhichEvidence,
    whatHappened: input.whatHappened,
    whatChanged: whatChangedPayload,
    previousEntryHash,
    sequenceNumber,
  });

  const fullAuditMetadata: Record<string, unknown> = {
    category: input.category,
    who: input.who,
    why: input.why,
    underWhichPolicy: input.underWhichPolicy,
    basedOnWhichEvidence: input.basedOnWhichEvidence,
    whatHappened: input.whatHappened,
    whatChanged: whatChangedPayload,
    entryHash,
    previousEntryHash,
    sequenceNumber,
    isTamperEvident: true,
    ...(input.metadata ?? {}),
  };

  const sanitizedPrev = input.whatChanged.previousState
    ? (redactSensitiveFields(input.whatChanged.previousState) as Prisma.InputJsonValue)
    : undefined;
  const sanitizedNext = input.whatChanged.newState
    ? (redactSensitiveFields(input.whatChanged.newState) as Prisma.InputJsonValue)
    : undefined;
  const sanitizedMeta = redactSensitiveFields(fullAuditMetadata) as Prisma.InputJsonValue;

  const created = await prisma.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.who.actorId ?? null,
      actorEmail: input.who.actorEmail ?? null,
      actorRole: input.who.actorRole ?? input.who.actorType,
      action: input.what.action,
      entityType: input.what.entityType,
      entityId: input.what.entityId,
      previousState: sanitizedPrev,
      newState: sanitizedNext,
      source: input.who.actorType,
      correlationId: input.correlationId ?? null,
      summary: sanitizeAuditText(input.what.summary),
      metadata: sanitizedMeta,
      createdAt: new Date(whenIso),
    },
  });

  return {
    id: created.id,
    tenantId: input.tenantId,
    category: input.category,
    who: input.who,
    what: input.what,
    when: whenIso,
    why: input.why,
    underWhichPolicy: input.underWhichPolicy,
    basedOnWhichEvidence: input.basedOnWhichEvidence,
    whatHappened: input.whatHappened,
    whatChanged: whatChangedPayload,
    correlationId: created.correlationId,
    entryHash,
    previousEntryHash,
    sequenceNumber,
  };
}

/**
 * Validates the cryptographic tamper-evident hash chain for a tenant's audit trail.
 */
export async function verifyAuditLogTamperEvidence(
  tenantId: string,
  limit = 200
): Promise<ChainVerificationResult> {
  const events = (
    await prisma.auditEvent.findMany({
      where: {
        tenantId,
        source: { in: ["USER", "AGENT", "SYSTEM"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  ).reverse();

  if (events.length === 0) {
    return { valid: true, totalRecordsChecked: 0 };
  }

  let expectedPrevHash: string | null = null;
  let count = 0;

  for (const ev of events) {
    const meta = (ev.metadata as Record<string, unknown>) ?? {};
    if (!meta.isTamperEvident) {
      // Legacy or untracked entry, skip chain verification for it
      continue;
    }

    count += 1;
    const actualPrevHash = meta.previousEntryHash as string;
    const actualEntryHash = meta.entryHash as string;
    const sequenceNumber = (meta.sequenceNumber as number) ?? count;

    if (expectedPrevHash !== null && actualPrevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalRecordsChecked: count,
        tamperedRecordId: ev.id,
        expectedHash: expectedPrevHash,
        actualHash: actualPrevHash,
        reason: `Previous hash mismatch at sequence ${sequenceNumber} (id: ${ev.id})`,
      };
    }

    const recomputedHash = computeAuditEntryHash({
      tenantId: ev.tenantId,
      category: meta.category as AuditActionCategory,
      who: meta.who as CompleteAuditRecordInput["who"],
      what: {
        action: ev.action,
        entityType: ev.entityType,
        entityId: ev.entityId,
        summary: ev.summary,
      },
      when: ev.createdAt.toISOString(),
      why: meta.why as CompleteAuditRecordInput["why"],
      underWhichPolicy: meta.underWhichPolicy as CompleteAuditRecordInput["underWhichPolicy"],
      basedOnWhichEvidence: meta.basedOnWhichEvidence as CompleteAuditRecordInput["basedOnWhichEvidence"],
      whatHappened: meta.whatHappened as CompleteAuditRecordInput["whatHappened"],
      whatChanged: meta.whatChanged as CompleteAuditRecordInput["whatChanged"],
      previousEntryHash: actualPrevHash,
      sequenceNumber,
    });

    if (recomputedHash !== actualEntryHash) {
      return {
        valid: false,
        totalRecordsChecked: count,
        tamperedRecordId: ev.id,
        expectedHash: recomputedHash,
        actualHash: actualEntryHash,
        reason: `Hash payload verification failed at sequence ${sequenceNumber} (id: ${ev.id})`,
      };
    }

    expectedPrevHash = actualEntryHash;
  }

  return {
    valid: true,
    totalRecordsChecked: count,
  };
}
