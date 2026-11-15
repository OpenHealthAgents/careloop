import { createHash } from "crypto";
import { z } from "zod";

/**
 * ============================================================================
 * AGENT VERSIONING CONTRACTS & COMPONENT MATRIX
 * ============================================================================
 * Defines canonical versioning across all 9 agentic healthcare components:
 * 1. Agent
 * 2. Prompt
 * 3. Model
 * 4. Tool
 * 5. Policy
 * 6. Workflow
 * 7. Barrier Classifier
 * 8. Risk Model
 * 9. Intervention Strategy
 * ============================================================================
 */

export const AgentComponentVersionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
});

export const PromptComponentVersionSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  templateVersions: z.record(z.string()),
});

export const ModelComponentVersionSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  providerType: z.enum(["DETERMINISTIC", "EXTERNAL_OPENAI", "HYBRID"]),
});

export const ToolComponentVersionSchema = z.object({
  registryVersion: z.string().min(1),
  toolVersions: z.record(z.string()),
});

export const PolicyComponentVersionSchema = z.object({
  version: z.string().min(1),
  rulesCount: z.number().int().min(1),
  rulesHash: z.string().min(1),
  description: z.string().min(1),
});

export const WorkflowComponentVersionSchema = z.object({
  version: z.string().min(1),
  allowedStatesCount: z.number().int().min(1),
  allowedStates: z.array(z.string()),
});

export const BarrierClassifierComponentVersionSchema = z.object({
  version: z.string().min(1),
  taxonomyVersion: z.string().min(1),
  categoriesCount: z.number().int().min(1),
});

export const RiskModelComponentVersionSchema = z.object({
  version: z.string().min(1),
  algorithm: z.string().min(1),
  maxScore: z.number().int(),
});

export const InterventionStrategyComponentVersionSchema = z.object({
  version: z.string().min(1),
  rulesCount: z.number().int().min(1),
  supportsAutoExecution: z.boolean(),
});

export const SystemVersionManifestComponentsSchema = z.object({
  agent: AgentComponentVersionSchema,
  prompt: PromptComponentVersionSchema,
  model: ModelComponentVersionSchema,
  tool: ToolComponentVersionSchema,
  policy: PolicyComponentVersionSchema,
  workflow: WorkflowComponentVersionSchema,
  barrierClassifier: BarrierClassifierComponentVersionSchema,
  riskModel: RiskModelComponentVersionSchema,
  interventionStrategy: InterventionStrategyComponentVersionSchema,
});

export const SystemVersionManifestSchema = z.object({
  manifestId: z.string().min(1),
  versionLabel: z.string().min(1),
  releasedAt: z.string().datetime(),
  isCurrentDefault: z.boolean().default(false),
  components: SystemVersionManifestComponentsSchema,
  signature: z.string().min(1),
});

export type AgentComponentVersion = z.infer<typeof AgentComponentVersionSchema>;
export type PromptComponentVersion = z.infer<typeof PromptComponentVersionSchema>;
export type ModelComponentVersion = z.infer<typeof ModelComponentVersionSchema>;
export type ToolComponentVersion = z.infer<typeof ToolComponentVersionSchema>;
export type PolicyComponentVersion = z.infer<typeof PolicyComponentVersionSchema>;
export type WorkflowComponentVersion = z.infer<typeof WorkflowComponentVersionSchema>;
export type BarrierClassifierComponentVersion = z.infer<typeof BarrierClassifierComponentVersionSchema>;
export type RiskModelComponentVersion = z.infer<typeof RiskModelComponentVersionSchema>;
export type InterventionStrategyComponentVersion = z.infer<typeof InterventionStrategyComponentVersionSchema>;

export type SystemVersionManifestComponents = z.infer<typeof SystemVersionManifestComponentsSchema>;
export type SystemVersionManifest = z.infer<typeof SystemVersionManifestSchema>;

export interface VersionProvenance {
  manifestId: string;
  signature: string;
  agent: string;
  prompt: string;
  model: string;
  tool: string;
  policy: string;
  workflow: string;
  barrierClassifier: string;
  riskModel: string;
  interventionStrategy: string;
  generatedAt: string;
}

export function computeManifestSignature(components: SystemVersionManifestComponents): string {
  const serialized = JSON.stringify({
    agent: `${components.agent.id}@${components.agent.version}`,
    prompt: `${components.prompt.id}@${components.prompt.version}:${JSON.stringify(components.prompt.templateVersions)}`,
    model: `${components.model.name}@${components.model.version}`,
    tool: `${components.tool.registryVersion}:${JSON.stringify(components.tool.toolVersions)}`,
    policy: `${components.policy.version}:${components.policy.rulesHash}`,
    workflow: `${components.workflow.version}:${components.workflow.allowedStates.join(",")}`,
    barrierClassifier: `${components.barrierClassifier.version}:${components.barrierClassifier.taxonomyVersion}`,
    riskModel: `${components.riskModel.version}:${components.riskModel.algorithm}`,
    interventionStrategy: `${components.interventionStrategy.version}:${components.interventionStrategy.rulesCount}`,
  });

  return createHash("sha256").update(serialized).digest("hex");
}

export const CANONICAL_TOOL_VERSIONS: Record<string, string> = {
  run_ai_assessment: "1.0.0",
  human_barrier_review: "1.0.0",
  human_intervention_approval: "1.0.0",
  search_providers: "1.2.0",
  check_provider_availability: "1.1.0",
  send_member_communication: "1.3.0",
  request_scheduling: "1.0.0",
  schedule_appointment: "1.4.0",
  send_reminder: "1.2.0",
  verify_appointment: "1.1.0",
  verify_completion: "2.0.0",
  escalate_to_human: "1.0.0",
  close_verified_case: "1.0.0",
};

/**
 * Manifest V1.0.0 — Initial baseline release of CareLoop Agent
 */
const v1Components: SystemVersionManifestComponents = {
  agent: {
    id: "CareLoopCaseOrchestrator",
    name: "CareLoop Case Orchestrator",
    version: "1.0.0",
    description: "Initial deterministic referral-to-care orchestrator.",
  },
  prompt: {
    id: "careloop-prompts",
    version: "1.0.0",
    templateVersions: {
      CALCULATE_RISK: "1.0.0",
      CLASSIFY_BARRIER: "1.0.0",
      RECOMMEND_INTERVENTION: "1.0.0",
      SUMMARIZE_CASE: "1.0.0",
      GENERATE_COMMUNICATION: "1.0.0",
      MATCH_PROVIDER: "1.0.0",
    },
  },
  model: {
    name: "deterministic-orchestrator-v1",
    version: "1.0.0",
    providerType: "DETERMINISTIC",
  },
  tool: {
    registryVersion: "1.0.0",
    toolVersions: Object.fromEntries(
      Object.keys(CANONICAL_TOOL_VERSIONS).map((k) => [k, "1.0.0"])
    ),
  },
  policy: {
    version: "1.0.0",
    rulesCount: 6,
    rulesHash: "sha256-policy-v1-baseline",
    description: "Basic clinical scope and consent enforcement.",
  },
  workflow: {
    version: "1.0.0",
    allowedStatesCount: 11,
    allowedStates: [
      "NEW",
      "TRIAGED",
      "BARRIER_IDENTIFIED",
      "INTERVENTION_RECOMMENDED",
      "INTERVENTION_IN_PROGRESS",
      "APPOINTMENT_SCHEDULED",
      "APPOINTMENT_CONFIRMED",
      "VERIFIED",
      "ESCALATED",
      "BLOCKED",
      "CLOSED",
    ],
  },
  barrierClassifier: {
    version: "1.0.0",
    taxonomyVersion: "1.0.0",
    categoriesCount: 7,
  },
  riskModel: {
    version: "1.0.0",
    algorithm: "weighted-sum-v1",
    maxScore: 100,
  },
  interventionStrategy: {
    version: "1.0.0",
    rulesCount: 8,
    supportsAutoExecution: false,
  },
};

/**
 * Manifest V2.0.0 — Second generation release with AI guardrails and human approval gates
 */
const v2Components: SystemVersionManifestComponents = {
  agent: {
    id: "CareLoopCaseOrchestrator",
    name: "CareLoop Case Orchestrator",
    version: "2.0.0",
    description: "Second generation orchestrator with approval gate resume and evaluation harness.",
  },
  prompt: {
    id: "careloop-prompts",
    version: "2.0.0",
    templateVersions: {
      CALCULATE_RISK: "2.0.0",
      CLASSIFY_BARRIER: "2.0.0",
      RECOMMEND_INTERVENTION: "2.0.0",
      SUMMARIZE_CASE: "1.1.0",
      GENERATE_COMMUNICATION: "1.2.0",
      MATCH_PROVIDER: "1.0.0",
    },
  },
  model: {
    name: "careloop-orchestrator-v2",
    version: "2.0.0",
    providerType: "HYBRID",
  },
  tool: {
    registryVersion: "2.0.0",
    toolVersions: CANONICAL_TOOL_VERSIONS,
  },
  policy: {
    version: "2.0.0",
    rulesCount: 10,
    rulesHash: "sha256-policy-v2-guardrails",
    description: "Expanded guardrails with human approval gates and verified slot integrity.",
  },
  workflow: {
    version: "1.5.0",
    allowedStatesCount: 13,
    allowedStates: [
      "NEW",
      "TRIAGED",
      "BARRIER_IDENTIFIED",
      "INTERVENTION_RECOMMENDED",
      "INTERVENTION_IN_PROGRESS",
      "APPOINTMENT_REQUESTED",
      "APPOINTMENT_SCHEDULED",
      "APPOINTMENT_CONFIRMED",
      "APPOINTMENT_COMPLETED",
      "VERIFIED",
      "REQUIRES_HUMAN_REVIEW",
      "ESCALATED",
      "CLOSED",
    ],
  },
  barrierClassifier: {
    version: "2.0.0",
    taxonomyVersion: "2.0.0",
    categoriesCount: 7,
  },
  riskModel: {
    version: "2.0.0",
    algorithm: "operational-risk-engine-v2",
    maxScore: 100,
  },
  interventionStrategy: {
    version: "1.5.0",
    rulesCount: 14,
    supportsAutoExecution: true,
  },
};

/**
 * Manifest V2.1.0 — Current active release with full adversarial safety, untrusted output boundaries & observability
 */
const v21Components: SystemVersionManifestComponents = {
  agent: {
    id: "CareLoopCaseOrchestrator",
    name: "CareLoop Case Orchestrator",
    version: "2.1.0",
    description: "Enterprise orchestrator with untrusted model output defense, adversarial failure testing, and auditability.",
  },
  prompt: {
    id: "careloop-prompts",
    version: "2.1.0",
    templateVersions: {
      CALCULATE_RISK: "2.0.0",
      CLASSIFY_BARRIER: "2.0.0",
      RECOMMEND_INTERVENTION: "2.0.0",
      SUMMARIZE_CASE: "1.1.0",
      GENERATE_COMMUNICATION: "1.2.0",
      MATCH_PROVIDER: "1.0.0",
    },
  },
  model: {
    name: "careloop-orchestrator-v2.1",
    version: "2.1.0",
    providerType: "HYBRID",
  },
  tool: {
    registryVersion: "2.1.0",
    toolVersions: {
      ...CANONICAL_TOOL_VERSIONS,
      schedule_appointment: "1.4.1",
      verify_completion: "2.1.0",
    },
  },
  policy: {
    version: "2.1.0",
    rulesCount: 12,
    rulesHash: "sha256-policy-v2.1-untrusted-model-defenses",
    description: "Strict untrusted model output defense: LLM output != trusted instruction.",
  },
  workflow: {
    version: "2.0.0",
    allowedStatesCount: 14,
    allowedStates: [
      "NEW",
      "TRIAGED",
      "BARRIER_IDENTIFIED",
      "INTERVENTION_RECOMMENDED",
      "INTERVENTION_IN_PROGRESS",
      "APPOINTMENT_REQUESTED",
      "APPOINTMENT_SCHEDULED",
      "APPOINTMENT_CONFIRMED",
      "APPOINTMENT_COMPLETED",
      "VERIFIED",
      "REQUIRES_HUMAN_REVIEW",
      "ESCALATED",
      "BLOCKED",
      "CLOSED",
    ],
  },
  barrierClassifier: {
    version: "2.1.0",
    taxonomyVersion: "2.0.0",
    categoriesCount: 7,
  },
  riskModel: {
    version: "2.1.0",
    algorithm: "operational-risk-engine-v2.1",
    maxScore: 100,
  },
  interventionStrategy: {
    version: "2.0.0",
    rulesCount: 18,
    supportsAutoExecution: true,
  },
};

export const CANONICAL_VERSION_MANIFESTS: Record<string, SystemVersionManifest> = {
  "v1.0.0": {
    manifestId: "manifest-v1.0.0",
    versionLabel: "v1.0.0",
    releasedAt: "2026-08-01T00:00:00.000Z",
    isCurrentDefault: false,
    components: v1Components,
    signature: computeManifestSignature(v1Components),
  },
  "v2.0.0": {
    manifestId: "manifest-v2.0.0",
    versionLabel: "v2.0.0",
    releasedAt: "2026-10-15T00:00:00.000Z",
    isCurrentDefault: false,
    components: v2Components,
    signature: computeManifestSignature(v2Components),
  },
  "v2.1.0": {
    manifestId: "manifest-v2.1.0",
    versionLabel: "v2.1.0",
    releasedAt: "2026-11-13T00:00:00.000Z",
    isCurrentDefault: true,
    components: v21Components,
    signature: computeManifestSignature(v21Components),
  },
};

export const DEFAULT_MANIFEST_VERSION = "v2.1.0";

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
    throw new Error(`Version manifest '${idOrLabel}' not found.`);
  }
  return found;
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
