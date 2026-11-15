import { CaseStatus } from "@prisma/client";
import type { StructuredCaseMemory } from "./cases/case-memory";

/**
 * Canonical CaseMemory contract for structured, relational-only case state
 * (excludes raw LLM transcripts and hidden chain-of-thought).
 */
export type CaseMemory = StructuredCaseMemory;

export interface CaseMemoryRepository {
  loadCaseMemory(caseId: string, tenantId: string): Promise<CaseMemory | null>;
}

export interface DomainStateMachine<TState extends string = CaseStatus> {
  isValidTransition(from: TState, to: TState): boolean;
  getAllowedNextStates(from: TState): readonly TState[];
}
