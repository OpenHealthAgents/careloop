/**
 * ============================================================================
 * MULTI-AGENT READINESS CONTRACTS
 * ============================================================================
 * Defines extensible interfaces for future specialized agents:
 * - ReferralAgent
 * - BarrierAgent
 * - ProviderAgent
 * - SchedulingAgent
 * - EngagementAgent
 * - VerificationAgent
 * - EquityAgent
 *
 * All agents strictly operate under:
 * - Shared State
 * - Shared Policy
 * - Shared Audit
 * - Shared Evidence
 * - Shared Case Goal (No agent may independently redefine the case goal)
 * ============================================================================
 */

import { CaseStatus } from "@prisma/client";
import { CaseOrchestratorTool } from "@/ai/schemas";
import { SessionUser } from "@/lib/auth/session";

/**
 * Recognized future specialized agent roles.
 */
export type SpecializedAgentRole =
  | "ReferralAgent"
  | "BarrierAgent"
  | "ProviderAgent"
  | "SchedulingAgent"
  | "EngagementAgent"
  | "VerificationAgent"
  | "EquityAgent";

export type AgentDomain =
  | "REFERRAL"
  | "BARRIER"
  | "PROVIDER"
  | "SCHEDULING"
  | "ENGAGEMENT"
  | "VERIFICATION"
  | "EQUITY"
  | "ORCHESTRATION";

/**
 * Explicit capability declaration for an agent.
 * Governs what an agent is permitted to perform and what tools it may invoke.
 */
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  domain: AgentDomain;
  allowedTools: readonly (CaseOrchestratorTool | string)[];
  requiredPermissions: readonly string[];
  riskTier: "LOW" | "MEDIUM" | "HIGH";
  canProposeStateTransition: boolean;
  requiresHumanApproval: boolean;
}

/**
 * Standardized inter-agent message structure.
 * Facilitates clear coordination while preserving traceability and tenant boundaries.
 */
export type AgentMessageType =
  | "TASK_DISPATCH"
  | "TASK_RESULT"
  | "EVIDENCE_SIGNAL"
  | "BLOCKER_NOTIFICATION"
  | "COORDINATION_QUERY"
  | "HUMAN_ESCALATION_REQUEST";

export interface AgentMessage {
  id: string;
  tenantId: string;
  caseId: string;
  senderAgent: string;
  recipientAgent: string | "BROADCAST";
  correlationId: string;
  timestamp: Date;
  messageType: AgentMessageType;
  payload: Record<string, unknown>;
  /** The immutable canonical case goal this message is serving */
  sharedGoal: string;
  /** Trace parent if part of a distributed agent task chain */
  parentMessageId?: string;
}

/**
 * Bounded work assignment delegated to a specialized agent.
 */
export type AgentTaskPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export interface AgentTask {
  taskId: string;
  tenantId: string;
  caseId: string;
  assignedAgent: SpecializedAgentRole | string;
  capabilityRequired: string;
  /**
   * CANONICAL SHARED CASE GOAL
   * Immutable. Set by the case/referral orchestrator.
   * No agent may independently redefine or alter this goal.
   */
  caseGoal: string;
  /** Current case status from shared state */
  currentState: CaseStatus;
  /** Input data specific to the delegated task */
  inputData: Record<string, unknown>;
  /** IDs of shared evidence signals available to this task */
  evidenceReferences: readonly string[];
  priority: AgentTaskPriority;
  policyContext: {
    policyId: string;
    consentOutreach: boolean;
    consentSms: boolean;
    communicationChannel?: string;
  };
  createdAt: Date;
  deadline?: Date;
}

/**
 * Structured output returned by an agent upon task execution.
 */
export type AgentResultStatus =
  | "SUCCESS"
  | "FAILED"
  | "REQUIRES_HUMAN"
  | "BLOCKED"
  | "GOAL_ALREADY_ACHIEVED";

export interface DiscoveredEvidenceSignal {
  category: string;
  source: string;
  signal: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface AgentIdentifiedBlocker {
  code: string;
  severity: "INFO" | "MEDIUM" | "HIGH";
  description: string;
}

export interface AgentResult {
  taskId: string;
  caseId: string;
  agentName: SpecializedAgentRole | string;
  status: AgentResultStatus;
  /**
   * Acknowledged canonical case goal.
   * Must match the canonical case goal exactly.
   * Any attempt to redefine the goal triggers a validation error.
   */
  caseGoalAcknowledged: string;
  /** Proposed case state transition, if authorized by agent capability */
  proposedStateTransition?: {
    from: CaseStatus;
    to: CaseStatus;
    reason: string;
  };
  /** Evidence signals discovered to append to the shared evidence ledger */
  evidenceDiscovered: readonly DiscoveredEvidenceSignal[];
  /** Blockers detected by the specialized agent */
  blockersIdentified: readonly AgentIdentifiedBlocker[];
  /** Tools executed during task fulfillment */
  toolCallsMade: readonly {
    tool: string;
    latencyMs: number;
    success: boolean;
  }[];
  tokensConsumed: number;
  costUSD: number;
  rationale: string;
  outputPayload?: Record<string, unknown>;
}

/**
 * Specification for registering a specialized agent.
 */
export interface SpecializedAgentSpec {
  name: SpecializedAgentRole | string;
  role: SpecializedAgentRole | string;
  version: string;
  domain: AgentDomain;
  description: string;
  capabilities: readonly AgentCapability[];
  /**
   * Evaluates a task and returns an AgentResult.
   * Future specialized implementations provide concrete execution logic.
   */
  executeTask(task: AgentTask, context: SpecializedAgentContext): Promise<AgentResult>;
}

/**
 * Shared execution context provided to specialized agents.
 */
export interface SpecializedAgentContext {
  session: SessionUser;
  correlationId?: string;
  sharedEvidence: readonly DiscoveredEvidenceSignal[];
  canonicalGoal: string;
}

/**
 * Registry interface for discovering and managing specialized agents.
 */
export interface AgentRegistry {
  register(agent: SpecializedAgentSpec): void;
  unregister(agentName: string): boolean;
  getAgent(name: string): SpecializedAgentSpec | undefined;
  hasAgent(name: string): boolean;
  getAgentsByCapability(capabilityId: string): readonly SpecializedAgentSpec[];
  listAgents(): readonly SpecializedAgentSpec[];
  validateTaskAssignment(task: AgentTask): { valid: boolean; reason?: string };
  verifyGoalIntegrity(canonicalGoal: string, agentProposedGoal?: string): void;
}
