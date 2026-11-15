import {
  CaseStatus,
  CommunicationChannel,
  Prisma,
  ReferralStatus,
  WorkflowEventType,
} from "@prisma/client";
import {
  EXECUTION_JOURNAL_EVENT_TYPES,
  recordExecutionEvent,
} from "./execution-journal-service";
import {
  CsvReferralIngestionAdapter,
  ParsedCsvReferralRow,
  sanitizeCsvCellForExport,
} from "@/adapters/csv-referral-parser";
import {
  IngestionRowError,
  NormalizedIngestionRow,
  ReferralIngestionAdapter,
} from "@/adapters/ingestion-adapter";
import { careLoopAgentRuntime } from "@/agent_runtime";
import { SessionUser } from "@/lib/auth/session";
import { buildCaseGoal } from "@/domain/cases/state-machine";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";
import { runCaseAIAssessment } from "./case-service";

export interface IngestionPreviewResult {
  sourceType: string;
  fileName: string;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  readyRows: NormalizedIngestionRow[];
  duplicateRows: Array<NormalizedIngestionRow & { reason: string }>;
  errors: IngestionRowError[];
}

async function ingestSingleRow(params: {
  tenantId: string;
  actor: SessionUser;
  batchId?: string;
  sourceSystem: string;
  row: ParsedCsvReferralRow;
  correlationId?: string;
}) {
  const { tenantId, row } = params;

  const existingReferral = await prisma.referral.findFirst({
    where: { tenantId, externalReferralId: row.externalReferralId },
  });
  if (existingReferral) {
    throw new ConflictError(`Referral ${row.externalReferralId} already exists in tenant`);
  }

  const member = await prisma.member.upsert({
    where: {
      tenantId_externalMemberId: {
        tenantId,
        externalMemberId: row.externalMemberId,
      },
    },
    update: {
      preferredLanguage: row.preferredLanguage,
      geography: row.geography,
      urbanicity: row.urbanicity,
      coverageType: row.coverageType,
      networkName: row.networkRequired,
      preferredContactChannel: row.preferredContactChannel,
      consentSms: row.consentSms,
      digitalAccessLevel: row.digitalAccessLevel,
      transportationAccess: row.transportationAccess,
      priorNoShowCount: row.priorNoShowCount,
    },
    create: {
      tenantId,
      externalMemberId: row.externalMemberId,
      firstName: row.firstName,
      lastName: row.lastName,
      dobYear: row.dobYear ?? null,
      preferredLanguage: row.preferredLanguage,
      geography: row.geography,
      urbanicity: row.urbanicity,
      coverageType: row.coverageType,
      eligibilityStatus: row.eligibilityVerified === "VERIFIED" ? "ACTIVE" : "PENDING",
      networkName: row.networkRequired,
      preferredContactChannel: row.preferredContactChannel,
      consentOutreach: true,
      consentSms: row.consentSms,
      digitalAccessLevel: row.digitalAccessLevel,
      transportationAccess: row.transportationAccess,
      priorNoShowCount: row.priorNoShowCount,
    },
  });

  await prisma.consent.upsert({
    where: {
      tenantId_memberId_channel_purpose: {
        tenantId,
        memberId: member.id,
        channel: CommunicationChannel.SMS,
        purpose: "CARE_OUTREACH",
      },
    },
    update: { granted: row.consentSms },
    create: {
      tenantId,
      memberId: member.id,
      channel: CommunicationChannel.SMS,
      purpose: "CARE_OUTREACH",
      granted: row.consentSms,
      source: params.sourceSystem,
    },
  });

  const referral = await prisma.referral.create({
    data: {
      tenantId,
      memberId: member.id,
      ingestionBatchId: params.batchId ?? null,
      externalReferralId: row.externalReferralId,
      referralDate: new Date(row.referralDate),
      sourceSystem: params.sourceSystem,
      behavioralHealthNeed: row.behavioralHealthNeed,
      specialty: row.specialty,
      urgency: row.urgency,
      geography: row.geography,
      networkRequired: row.networkRequired,
      preferredLanguage: row.preferredLanguage,
      eligibilityVerified: row.eligibilityVerified,
      referringProviderName: row.referringProviderName ?? null,
      operationalNotes: row.operationalNotes ?? null,
      status: ReferralStatus.TRIAGED,
    },
  });

  const careCase = await prisma.case.create({
    data: {
      tenantId,
      referralId: referral.id,
      memberId: member.id,
      status: CaseStatus.NEW,
      goal: buildCaseGoal({ specialty: row.specialty }),
      slaDueAt: new Date(Date.now() + (row.urgency === "EXPEDITED" ? 2 : 5) * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.workflowEvent.create({
    data: {
      tenantId,
      caseId: careCase.id,
      eventType: WorkflowEventType.CASE_CREATED,
      fromStatus: null,
      toStatus: CaseStatus.NEW,
      actorId: params.actor.userId,
      actorRole: params.actor.role,
      reason: `Referral ${row.externalReferralId} ingested via ${params.sourceSystem}`,
    },
  });

  await recordExecutionEvent({
    tenantId,
    caseId: careCase.id,
    actorType: "SYSTEM",
    actorId: params.actor.userId,
    eventType: EXECUTION_JOURNAL_EVENT_TYPES.CASE_CREATED,
    inputReference: `referral:${referral.id}`,
    outputReference: `case:${careCase.id}`,
    policyDecision: "ALLOW",
    evidence: [`source_system=${params.sourceSystem}`, `urgency=${row.urgency}`],
    correlationId: params.correlationId ?? null,
  });

  const assessment = await runCaseAIAssessment({
    tenantId,
    caseId: careCase.id,
    actor: params.actor,
    correlationId: params.correlationId,
  });

  return { referral, careCase: assessment.careCase, member };
}

export async function previewWithAdapter<TInput>(
  adapter: ReferralIngestionAdapter<TInput>,
  input: TInput,
  tenantId: string
): Promise<IngestionPreviewResult> {
  const parsed = await adapter.parseAndValidate(input);
  const candidateIds = parsed.validRows.map((r) => r.externalReferralId);

  const existingRefs = candidateIds.length
    ? await prisma.referral.findMany({
        where: {
          tenantId,
          externalReferralId: { in: candidateIds },
        },
        select: { externalReferralId: true },
      })
    : [];
  const existingSet = new Set(existingRefs.map((r) => r.externalReferralId));

  const readyRows: NormalizedIngestionRow[] = [];
  const duplicateRows: Array<NormalizedIngestionRow & { reason: string }> = [];
  const errors: IngestionRowError[] = [...parsed.errors];

  for (const row of parsed.validRows) {
    if (existingSet.has(row.externalReferralId)) {
      const reason = `Referral '${row.externalReferralId}' already exists in this tenant.`;
      duplicateRows.push({ ...row, reason });
      errors.push({
        rowNumber: row.rowNumber,
        externalReferralId: row.externalReferralId,
        errorType: "DUPLICATE_IN_DATABASE",
        message: reason,
      });
    } else {
      readyRows.push(row);
    }
  }

  return {
    sourceType: parsed.sourceType,
    fileName: parsed.fileName,
    totalRows: parsed.totalRows,
    validCount: readyRows.length,
    duplicateCount:
      duplicateRows.length + errors.filter((e) => e.errorType === "DUPLICATE_IN_FILE").length,
    errorCount: errors.length,
    readyRows,
    duplicateRows,
    errors: errors.sort((a, b) => a.rowNumber - b.rowNumber),
  };
}

export async function confirmIngestionWithAdapter<TInput>(params: {
  adapter: ReferralIngestionAdapter<TInput>;
  input: TInput;
  session: SessionUser;
  correlationId?: string;
}) {
  const preview = await previewWithAdapter(
    params.adapter,
    params.input,
    params.session.tenantId
  );

  const errors: IngestionRowError[] = [...preview.errors];
  const createdCases: Array<{
    referralId: string;
    externalReferralId: string;
    caseId: string;
    riskTier: string;
  }> = [];

  const batch = await prisma.ingestionBatch.create({
    data: {
      tenantId: params.session.tenantId,
      uploadedById: params.session.userId,
      sourceType: preview.sourceType,
      fileName: preview.fileName,
      totalRows: preview.totalRows,
      successRows: 0,
      errorRows: errors.length,
    },
  });

  for (const rowItem of preview.readyRows) {
    try {
      const res = await ingestSingleRow({
        tenantId: params.session.tenantId,
        actor: params.session,
        batchId: batch.id,
        sourceSystem: `${preview.sourceType}_IMPORT`,
        row: rowItem.data,
        correlationId: params.correlationId,
      });
      createdCases.push({
        referralId: res.referral.id,
        externalReferralId: res.referral.externalReferralId,
        caseId: res.careCase.id,
        riskTier: res.careCase.riskLevel,
      });
    } catch (err) {
      errors.push({
        rowNumber: rowItem.rowNumber,
        externalReferralId: rowItem.externalReferralId,
        errorType: "PERSISTENCE_ERROR",
        message: err instanceof Error ? err.message : "Failed to ingest row",
      });
    }
  }

  const updatedBatch = await prisma.ingestionBatch.update({
    where: { id: batch.id },
    data: {
      successRows: createdCases.length,
      errorRows: errors.length,
      errorsJson: errors as unknown as Prisma.InputJsonValue,
    },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "REFERRAL_BATCH_INGESTED",
    entityType: "IngestionBatch",
    entityId: batch.id,
    correlationId: params.correlationId,
    summary: `Ingested ${preview.sourceType} '${preview.fileName}': ${createdCases.length} succeeded, ${errors.length} failed/skipped`,
  });

  return { batch: updatedBatch, createdCases, errors };
}

export async function ingestReferralsFromCsv(params: {
  session: SessionUser;
  fileName: string;
  csvText: string;
  fileSizeBytes?: number;
  correlationId?: string;
}) {
  return confirmIngestionWithAdapter({
    adapter: new CsvReferralIngestionAdapter(),
    input: {
      fileName: params.fileName,
      csvText: params.csvText,
      fileSizeBytes: params.fileSizeBytes,
    },
    session: params.session,
    correlationId: params.correlationId,
  });
}

export async function createSingleReferral(params: {
  session: SessionUser;
  row: ParsedCsvReferralRow;
  correlationId?: string;
}) {
  const res = await ingestSingleRow({
    tenantId: params.session.tenantId,
    actor: params.session,
    sourceSystem: "MANUAL_ENTRY",
    row: params.row,
    correlationId: params.correlationId,
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "REFERRAL_CREATED",
    entityType: "Referral",
    entityId: res.referral.id,
    correlationId: params.correlationId,
    summary: `Created referral ${res.referral.externalReferralId} and auto-triaged case ${res.careCase.id}`,
  });

  return res;
}

export async function exportFailedRowsCsv(tenantId: string, batchId: string) {
  const batch = await prisma.ingestionBatch.findFirst({
    where: { id: batchId, tenantId },
  });
  if (!batch) throw new NotFoundError("IngestionBatch", batchId);

  const errors = (Array.isArray(batch.errorsJson) ? batch.errorsJson : []) as unknown as IngestionRowError[];
  const header = "row_number,referral_id,error_type,error_message,raw_row_json";
  const lines = errors.map((e) =>
    [
      sanitizeCsvCellForExport(e.rowNumber),
      sanitizeCsvCellForExport(e.externalReferralId ?? ""),
      sanitizeCsvCellForExport(e.errorType ?? "VALIDATION_ERROR"),
      sanitizeCsvCellForExport(e.message),
      sanitizeCsvCellForExport(e.rawRow ? JSON.stringify(e.rawRow) : ""),
    ].join(",")
  );

  return {
    fileName: `failed-rows-${batch.fileName}`,
    csvContent: [header, ...lines].join("\n"),
  };
}

export type IngestionPipelineStage =
  | "UPLOAD"
  | "VALIDATE"
  | "NORMALIZE"
  | "DEDUPLICATE"
  | "CREATE_REFERRALS"
  | "CREATE_CASES"
  | "PRIORITIZE"
  | "START_AGENT";

export interface IngestionPipelineCaseResult {
  referralId: string;
  externalReferralId: string;
  caseId: string;
  riskTier: string;
  agentRunId?: string;
  agentRunStatus?: string;
  outreachInitiated: false;
}

export interface IngestionPipelineResult {
  stagesExecuted: IngestionPipelineStage[];
  batch: Awaited<ReturnType<typeof confirmIngestionWithAdapter>>["batch"];
  createdCases: IngestionPipelineCaseResult[];
  errors: IngestionRowError[];
}

/**
 * End-to-end Referral Ingestion Pipeline:
 * UPLOAD -> VALIDATE -> NORMALIZE -> DEDUPLICATE -> CREATE_REFERRALS -> CREATE_CASES -> PRIORITIZE -> START_AGENT.
 * Never automatically initiates member outreach until policy and consent requirements are satisfied.
 */
export async function runReferralIngestionPipeline(params: {
  session: SessionUser;
  fileName: string;
  csvText: string;
  fileSizeBytes?: number;
  startAgent?: boolean;
  correlationId?: string;
}): Promise<IngestionPipelineResult> {
  const confirmed = await ingestReferralsFromCsv({
    session: params.session,
    fileName: params.fileName,
    csvText: params.csvText,
    fileSizeBytes: params.fileSizeBytes,
    correlationId: params.correlationId,
  });

  const stagesExecuted: IngestionPipelineStage[] = [
    "UPLOAD",
    "VALIDATE",
    "NORMALIZE",
    "DEDUPLICATE",
    "CREATE_REFERRALS",
    "CREATE_CASES",
    "PRIORITIZE",
  ];

  const shouldStartAgent = params.startAgent ?? true;
  const createdCases: IngestionPipelineCaseResult[] = [];

  if (shouldStartAgent) {
    stagesExecuted.push("START_AGENT");
    for (const c of confirmed.createdCases) {
      // Start agent in planning/assessment mode only (no toolInput) so member outreach
      // is never automatically initiated prior to policy & consent verification.
      const agentResult = await careLoopAgentRuntime.start({
        session: params.session,
        caseId: c.caseId,
        correlationId: params.correlationId,
      });

      createdCases.push({
        ...c,
        agentRunId: agentResult.run.id,
        agentRunStatus: agentResult.run.status,
        outreachInitiated: false,
      });
    }
  } else {
    for (const c of confirmed.createdCases) {
      createdCases.push({
        ...c,
        outreachInitiated: false,
      });
    }
  }

  return {
    stagesExecuted,
    batch: confirmed.batch,
    createdCases,
    errors: confirmed.errors,
  };
}
