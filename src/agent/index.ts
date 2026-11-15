import {
  CareLoopCaseOrchestrator,
  CaseOrchestratorInput,
  ORCHESTRATOR_MODEL_DEFAULT,
  ORCHESTRATOR_PROMPT_VERSION,
} from "@/ai";
import type { Agent, AgentDecision } from "./contracts";

export * from "./contracts";
export { CareLoopCaseOrchestrator, parseExternalOrchestratorDecision } from "@/ai/orchestrator";
export type { CaseOrchestratorCaseContext, CaseOrchestratorInput } from "@/ai/orchestrator";
export {
  CareLoopOrchestratorAgent,
  careLoopOrchestratorAgent,
  inspectCaseContext,
  type OrchestrateCaseParams,
  type OrchestrateCaseResult,
  type OrchestrationLoopOutcome,
  type OrchestrationStepSummary,
  type OrchestratorBlocker,
  type OrchestratorBlockerCode,
  type OrchestratorInspection,
} from "./orchestrator-agent";
export {
  BarrierIntelligenceAgent,
  barrierIntelligenceAgent,
  BarrierInferenceRecordSchema,
  type BarrierInferenceRecord,
  type BarrierIntelligenceDecision,
  type BarrierIntelligenceInput,
} from "./barrier-agent";
export {
  ProviderMatchingAgent,
  providerMatchingAgent,
  evaluateProviderEligibility,
  type AccessibilityRequirements,
  type AppointmentTimingPreferences,
  type MemberProviderPreferences,
  type ProviderEligibilityResult,
  type ProviderMatchingDecision,
  type ProviderMatchingInput,
  type ProviderRecommendationItem,
} from "./provider-matching-agent";
export * from "@/lib/routing";
export * from "./multi_agent";

export class CareLoopAgent implements Agent<CaseOrchestratorInput, AgentDecision> {
  public readonly name = "CareLoopCaseOrchestrator";
  public readonly modelVersion = ORCHESTRATOR_MODEL_DEFAULT;
  public readonly promptVersion = ORCHESTRATOR_PROMPT_VERSION;

  decide(input: CaseOrchestratorInput): AgentDecision {
    return CareLoopCaseOrchestrator.decideNextStep(input);
  }
}

export const careLoopAgent = new CareLoopAgent();
