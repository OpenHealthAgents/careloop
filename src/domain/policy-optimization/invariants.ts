import { UserRole } from "@prisma/client";
import { ValidationError, AuthorizationError } from "@/lib/errors";
import { PolicyOptimizationStage, PolicyProposal } from "./contracts";

/**
 * ============================================================================
 * STRICT GOVERNANCE & ANTI-SELF-MUTATION INVARIANTS
 * ============================================================================
 * Invariants:
 * 1. "Never allow the agent to rewrite its own production policy autonomously."
 *    - An agent role (AGENT_SERVICE or background task) CANNOT approve, publish,
 *      deploy, or mutate production policy.
 * 2. Stage Progression Invariant:
 *    - Proposal must follow strict sequence:
 *      PROPOSAL
 *      -> OFFLINE_EVALUATION
 *      -> SIMULATION
 *      -> SAFETY_EVALUATION
 *      -> HUMAN_REVIEW
 *      -> VERSIONING
 *      -> CONTROLLED_DEPLOYMENT
 *      -> MONITORING
 *    - No stage may be skipped.
 * ============================================================================
 */

export class AutonomousPolicyRewriteProhibitedError extends AuthorizationError {
  constructor(action: string, role: string) {
    super(
      `Autonomous Policy Rewrite Prohibited: Actor role '${role}' is strictly forbidden from executing '${action}'. AI agents cannot rewrite production policies autonomously. Formal human supervisor governance is required.`
    );
  }
}

export class PipelineStageOrderViolationError extends ValidationError {
  constructor(fromStage: PolicyOptimizationStage, toStage: PolicyOptimizationStage, reason: string) {
    super(
      `Policy Optimization Pipeline Violation: Cannot transition from '${fromStage}' to '${toStage}'. ${reason}`
    );
  }
}

export class StagePrerequisiteMissingError extends ValidationError {
  constructor(targetStage: PolicyOptimizationStage, missingRequirement: string) {
    super(
      `Cannot advance to stage '${targetStage}': Missing required artifact '${missingRequirement}'.`
    );
  }
}

const AUTHORIZED_HUMAN_GOVERNANCE_ROLES = new Set<string>([
  UserRole.ADMIN,
  "CLINICAL_SUPERVISOR",
  UserRole.OPERATIONS,
]);

/**
 * Ensures that any privileged stage (Human Review, Version Publication, Deployment, Rollback)
 * is executed exclusively by an authorized human role, never an automated agent service.
 */
export function assertHumanGovernanceAuthority(
  actorRole: UserRole | string,
  action: "REVIEW" | "VERSION" | "DEPLOY" | "ROLLBACK"
): void {
  if (actorRole === UserRole.AGENT_SERVICE || actorRole === "AI_AGENT" || actorRole === "SYSTEM") {
    throw new AutonomousPolicyRewriteProhibitedError(action, String(actorRole));
  }

  if (action === "REVIEW" && actorRole !== UserRole.ADMIN && actorRole !== "CLINICAL_SUPERVISOR") {
    throw new AuthorizationError(
      `Human Review requires role 'ADMIN' or 'CLINICAL_SUPERVISOR'. Role '${actorRole}' is unauthorized.`
    );
  }

  if ((action === "VERSION" || action === "DEPLOY" || action === "ROLLBACK") && !AUTHORIZED_HUMAN_GOVERNANCE_ROLES.has(actorRole)) {
    throw new AuthorizationError(
      `Action '${action}' requires human administrative or supervisor authorization. Role '${actorRole}' is unauthorized.`
    );
  }
}

/**
 * Validates that candidate policy stages advance strictly in order.
 */
export function assertValidStageTransition(
  currentStage: PolicyOptimizationStage,
  nextStage: PolicyOptimizationStage
): void {
  // Allow recurring monitoring polling while in MONITORING stage
  if (currentStage === "MONITORING" && nextStage === "MONITORING") {
    return;
  }

  // Allow terminal rollback or rejection from any active stage
  if (nextStage === "ROLLED_BACK" || nextStage === "REJECTED") {
    return;
  }

  const STAGE_ORDER: Record<PolicyOptimizationStage, number> = {
    PROPOSAL: 1,
    OFFLINE_EVALUATION: 2,
    SIMULATION: 3,
    SAFETY_EVALUATION: 4,
    HUMAN_REVIEW: 5,
    VERSIONING: 6,
    CONTROLLED_DEPLOYMENT: 7,
    MONITORING: 8,
    REJECTED: 99,
    ROLLED_BACK: 100,
  };

  const currentRank = STAGE_ORDER[currentStage];
  const nextRank = STAGE_ORDER[nextStage];

  if (nextRank !== currentRank + 1) {
    throw new PipelineStageOrderViolationError(
      currentStage,
      nextStage,
      `Stages must be executed in exact sequential order: proposal -> offline evaluation -> simulation -> safety evaluation -> human review -> versioning -> controlled deployment -> monitoring.`
    );
  }
}

/**
 * Checks that prerequisites are satisfied before advancing.
 */
export function assertStagePrerequisitesMet(
  proposal: PolicyProposal,
  targetStage: PolicyOptimizationStage
): void {
  switch (targetStage) {
    case "OFFLINE_EVALUATION":
      if (!proposal.proposedRules || proposal.proposedRules.length === 0) {
        throw new StagePrerequisiteMissingError(targetStage, "proposedRules");
      }
      break;

    case "SIMULATION":
      if (!proposal.offlineEvaluation) {
        throw new StagePrerequisiteMissingError(targetStage, "offlineEvaluation");
      }
      if (!proposal.offlineEvaluation.passed) {
        throw new ValidationError("Cannot simulate policy: Offline evaluation did not pass.");
      }
      break;

    case "SAFETY_EVALUATION":
      if (!proposal.simulation) {
        throw new StagePrerequisiteMissingError(targetStage, "simulation");
      }
      if (!proposal.simulation.passed) {
        throw new ValidationError("Cannot run safety evaluation: Simulation failed or showed instability.");
      }
      break;

    case "HUMAN_REVIEW":
      if (!proposal.safetyEvaluation) {
        throw new StagePrerequisiteMissingError(targetStage, "safetyEvaluation");
      }
      if (!proposal.safetyEvaluation.passed) {
        throw new ValidationError(
          `Cannot submit for human review: Safety evaluation failed with ${proposal.safetyEvaluation.safetyBreachesCount} safety breaches.`
        );
      }
      break;

    case "VERSIONING":
      if (!proposal.humanReview) {
        throw new StagePrerequisiteMissingError(targetStage, "humanReview");
      }
      if (proposal.humanReview.decision !== "APPROVE") {
        throw new ValidationError("Cannot version policy: Human supervisor review did not approve the proposal.");
      }
      break;

    case "CONTROLLED_DEPLOYMENT":
      if (!proposal.versionRecord) {
        throw new StagePrerequisiteMissingError(targetStage, "versionRecord");
      }
      break;

    case "MONITORING":
      if (!proposal.deployment || !proposal.deployment.isActive) {
        throw new StagePrerequisiteMissingError(targetStage, "active deployment");
      }
      break;

    default:
      break;
  }
}
