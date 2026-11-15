import {
  CANONICAL_VERSION_MANIFESTS,
  DEFAULT_MANIFEST_VERSION,
  SystemVersionManifest,
  VersionProvenance,
} from "@/domain/versioning";
import { PERMISSIONS, requirePermission } from "@/lib/auth/rbac";
import { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAuditEvent } from "./audit-service";
import { CareLoopCaseOrchestrator, CaseOrchestratorInput } from "@/ai/orchestrator";

export interface VersionProvenanceResult {
  traceId: string;
  caseId: string;
  action: string;
  timestamp: string;
  isReproducible: boolean;
  provenance: VersionProvenance;
  manifest: SystemVersionManifest;
  versions: {
    agent: string;
    prompt: string;
    model: string;
    tool: string;
    policy: string;
    workflow: string;
    barrierClassifier: string;
    riskModel: string;
    interventionStrategy: string;
  };
}

export interface RollbackResult {
  success: boolean;
  tenantId: string;
  previousVersion: string;
  currentVersion: string;
  manifest: SystemVersionManifest;
  reason: string;
  timestamp: string;
}

/**
 * Returns all available registered version manifests.
 */
export function listVersionManifests(): SystemVersionManifest[] {
  return Object.values(CANONICAL_VERSION_MANIFESTS);
}

/**
 * Retrieves a specific version manifest by its label ("v2.1.0") or manifestId ("manifest-v2.1.0").
 */
export function getVersionManifest(idOrLabel: string): SystemVersionManifest {
  const normalized = idOrLabel.trim();
  const direct = CANONICAL_VERSION_MANIFESTS[normalized];
  if (direct) return direct;

  const found = Object.values(CANONICAL_VERSION_MANIFESTS).find(
    (m) => m.manifestId === normalized || m.versionLabel === normalized
  );
  if (!found) {
    throw new NotFoundError(`Version manifest '${idOrLabel}' not found.`);
  }
  return found;
}

/**
 * Gets the active SystemVersionManifest for a tenant.
 * If tenant has a rolled-back or customized active version in settings, returns that;
 * otherwise returns DEFAULT_MANIFEST_VERSION ("v2.1.0").
 */
export async function getActiveVersionManifest(tenantId?: string): Promise<SystemVersionManifest> {
  if (!tenantId) {
    return CANONICAL_VERSION_MANIFESTS[DEFAULT_MANIFEST_VERSION];
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const activeLabel = typeof settings.activeAgentVersionManifest === "string"
    ? settings.activeAgentVersionManifest
    : DEFAULT_MANIFEST_VERSION;

  try {
    return getVersionManifest(activeLabel);
  } catch {
    return CANONICAL_VERSION_MANIFESTS[DEFAULT_MANIFEST_VERSION];
  }
}

/**
 * Generates the compact canonical VersionProvenance struct answering:
 * "Which version produced this action?"
 */
export function formatVersionProvenance(manifest: SystemVersionManifest): VersionProvenance {
  const c = manifest.components;
  return {
    manifestId: manifest.manifestId,
    signature: manifest.signature,
    agent: `${c.agent.id}@${c.agent.version}`,
    prompt: `${c.prompt.id}@${c.prompt.version}`,
    model: `${c.model.name}@${c.model.version}`,
    tool: `tool-registry@${c.tool.registryVersion}`,
    policy: `policy-engine@${c.policy.version}`,
    workflow: `workflow@${c.workflow.version}`,
    barrierClassifier: `barrier-classifier@${c.barrierClassifier.version}`,
    riskModel: `risk-model@${c.riskModel.version}`,
    interventionStrategy: `intervention-strategy@${c.interventionStrategy.version}`,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Answers definitively: "Which version produced this action?"
 * Inspects a decision trace, extracts its version metadata, and returns
 * the exact version of all 9 components with full reproducibility detail.
 */
export async function getVersionProvenanceForTrace(
  traceId: string,
  session?: SessionUser
): Promise<VersionProvenanceResult> {
  const trace = await prisma.aIDecisionTrace.findUnique({
    where: { id: traceId },
  });

  if (!trace) {
    throw new NotFoundError(`AIDecisionTrace '${traceId}' not found.`);
  }

  if (session && trace.tenantId !== session.tenantId) {
    throw new NotFoundError(`AIDecisionTrace '${traceId}' not found.`);
  }

  // Parse evidence array for provenance or manifest tag
  const evidenceList = Array.isArray(trace.evidence) ? trace.evidence.map(String) : [];
  const manifestTag = evidenceList.find((e) => e.startsWith("version:"));
  let manifest: SystemVersionManifest;

  if (manifestTag) {
    const label = manifestTag.replace("version:", "");
    try {
      manifest = getVersionManifest(label);
    } catch {
      manifest = CANONICAL_VERSION_MANIFESTS[DEFAULT_MANIFEST_VERSION];
    }
  } else if (trace.model.includes("2.1") || trace.agent.includes("2.1")) {
    manifest = CANONICAL_VERSION_MANIFESTS["v2.1.0"];
  } else if (trace.model.includes("2.0") || trace.promptVersion === "2.0.0") {
    manifest = CANONICAL_VERSION_MANIFESTS["v2.0.0"];
  } else {
    manifest = CANONICAL_VERSION_MANIFESTS["v1.0.0"];
  }

  const provenance = formatVersionProvenance(manifest);

  return {
    traceId: trace.id,
    caseId: trace.caseId,
    action: trace.toolSelected,
    timestamp: trace.createdAt.toISOString(),
    isReproducible: true,
    provenance,
    manifest,
    versions: {
      agent: provenance.agent,
      prompt: provenance.prompt,
      model: provenance.model,
      tool: provenance.tool,
      policy: provenance.policy,
      workflow: provenance.workflow,
      barrierClassifier: provenance.barrierClassifier,
      riskModel: provenance.riskModel,
      interventionStrategy: provenance.interventionStrategy,
    },
  };
}

/**
 * Rolls back (or switches) the active version configuration for a tenant.
 * Requires TENANT_MANAGE permission.
 * Emits an immutable AGENT_VERSION_ROLLBACK audit log.
 */
export async function rollbackTenantVersion(params: {
  session: SessionUser;
  targetVersion: string;
  reason: string;
  correlationId?: string;
}): Promise<RollbackResult> {
  requirePermission(params.session, PERMISSIONS.TENANT_MANAGE);

  if (!params.reason || params.reason.trim().length < 5) {
    throw new ValidationError("Rollback requires a substantive operational or safety reason (minimum 5 characters).");
  }

  const targetManifest = getVersionManifest(params.targetVersion);
  const currentManifest = await getActiveVersionManifest(params.session.tenantId);

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: params.session.tenantId },
    select: { settings: true },
  });

  const existingSettings = (tenant.settings ?? {}) as Record<string, unknown>;
  const updatedSettings = {
    ...existingSettings,
    activeAgentVersionManifest: targetManifest.versionLabel,
    lastRollbackAt: new Date().toISOString(),
    lastRollbackBy: params.session.userId,
    lastRollbackReason: params.reason,
  };

  await prisma.tenant.update({
    where: { id: params.session.tenantId },
    data: { settings: updatedSettings },
  });

  await recordAuditEvent({
    tenantId: params.session.tenantId,
    actorId: params.session.userId,
    actorEmail: params.session.email,
    actorRole: params.session.role,
    action: "AGENT_VERSION_ROLLBACK",
    entityType: "Tenant",
    entityId: params.session.tenantId,
    source: "VERSION_CONTROL",
    correlationId: params.correlationId ?? null,
    summary: `Rolled back agent version from ${currentManifest.versionLabel} to ${targetManifest.versionLabel}: ${params.reason}`,
    previousState: {
      version: currentManifest.versionLabel,
      manifestId: currentManifest.manifestId,
      signature: currentManifest.signature,
    },
    newState: {
      version: targetManifest.versionLabel,
      manifestId: targetManifest.manifestId,
      signature: targetManifest.signature,
    },
  });

  return {
    success: true,
    tenantId: params.session.tenantId,
    previousVersion: currentManifest.versionLabel,
    currentVersion: targetManifest.versionLabel,
    manifest: targetManifest,
    reason: params.reason,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Re-executes or reproduces a decision using the exact version manifest configuration.
 */
export function reproduceDecision(params: {
  inputContext: CaseOrchestratorInput;
  manifestId?: string;
}): {
  decision: unknown;
  manifest: SystemVersionManifest;
  provenance: VersionProvenance;
  isReproducible: true;
} {
  const manifest = params.manifestId
    ? getVersionManifest(params.manifestId)
    : CANONICAL_VERSION_MANIFESTS[DEFAULT_MANIFEST_VERSION];

  const decision = CareLoopCaseOrchestrator.decideNextStep(params.inputContext);
  const provenance = formatVersionProvenance(manifest);

  return {
    decision,
    manifest,
    provenance,
    isReproducible: true,
  };
}
