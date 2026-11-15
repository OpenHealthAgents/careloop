import type { CaseOrchestratorInput } from "@/ai/orchestrator";
import type { CaseOrchestratorDecision } from "@/ai/schemas";

export type AgentDecision = CaseOrchestratorDecision;

export interface Agent<TInput = CaseOrchestratorInput, TDecision = AgentDecision> {
  readonly name: string;
  readonly modelVersion: string;
  readonly promptVersion: string;
  decide(input: TInput): Promise<TDecision> | TDecision;
}
