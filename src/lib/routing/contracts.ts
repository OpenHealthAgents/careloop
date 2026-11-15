/**
 * ============================================================================
 * AGENT ROUTING CONTRACTS
 * ============================================================================
 * CORE GOAL:
 * "Minimum AI necessary to achieve the outcome safely."
 *
 * ROUTING ARCHETYPES:
 * 1. Simple validation           -> Deterministic code (0 tokens, <1ms)
 * 2. Barrier classification      -> Low-cost model (gpt-4o-mini, structured JSON)
 * 3. Complex ambiguous case      -> Stronger model (gpt-4o, deep reasoning)
 * 4. High-risk action            -> Human approval gate (no auto-execution)
 * 5. Provider search             -> Deterministic provider tool (SQL/verified registry)
 * 6. State transition            -> Deterministic state machine (strict transition tables)
 * ============================================================================
 */

import { SessionUser } from "@/lib/auth/session";

export type RouteCategory =
  | "DETERMINISTIC_CODE"
  | "DETERMINISTIC_TOOL"
  | "DETERMINISTIC_STATE_MACHINE"
  | "HUMAN_APPROVAL_GATE"
  | "LOW_COST_MODEL"
  | "STRONGER_MODEL";

export type RoutingTaskType =
  | "VALIDATION"
  | "BARRIER_CLASSIFICATION"
  | "COMPLEX_REASONING"
  | "ACTION_EXECUTION"
  | "PROVIDER_SEARCH"
  | "STATE_TRANSITION";

export type ActionRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AmbiguitySignals {
  /** Count of conflicting notes or contradictory evidence items */
  conflictingEvidenceCount?: number;
  /** Direct flag indicating contradictory signals between clinical and social factors */
  hasContradictoryNotes?: boolean;
  /** Preliminary confidence score (e.g. < 0.70 triggers stronger model) */
  confidenceScore?: number;
  /** Unstructured notes length (e.g. large dense chart review) */
  unstructuredNotesLength?: number;
  /** Whether the clinical specialty or service category is ambiguous */
  hasAmbiguousSpecialty?: boolean;
  /** Multiple competing SDOH barriers with equal urgency */
  multipleCompetingBarriers?: boolean;
}

export interface RoutingTask {
  taskId?: string;
  taskType: RoutingTaskType;
  actionName?: string;
  riskLevel?: ActionRiskLevel;
  isAmbiguous?: boolean;
  ambiguitySignals?: AmbiguitySignals;
  requiresHumanApproval?: boolean;
  tenantId: string;
  caseId?: string;
  inputPayload: Record<string, unknown>;
}

export interface RoutingDecision {
  route: RouteCategory;
  target: string;
  rationale: string;
  minimumAiJustification: string;
  estimatedAiTokens: number;
  estimatedCostUSD: number;
  isHumanGated: boolean;
  metadata?: Record<string, unknown>;
}

export interface RoutingExecutionContext {
  session: SessionUser;
  correlationId?: string;
  agentRunId?: string;
}

export interface RoutingExecutionResult {
  taskId?: string;
  decision: RoutingDecision;
  success: boolean;
  output: unknown;
  tokensConsumed: number;
  costUSD: number;
  executionLatencyMs: number;
  humanApprovalRequired: boolean;
  approvalRequestId?: string;
  replayed?: boolean;
}
