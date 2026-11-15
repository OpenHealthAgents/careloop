import { CaseStatus } from "@prisma/client";

export type WorkflowState<TState extends string = CaseStatus> = TState;

export interface StateTransition<TState extends string = CaseStatus> {
  from: WorkflowState<TState>;
  to: WorkflowState<TState>;
  allowed: boolean;
  reason?: string;
  actorType?: "AGENT" | "HUMAN" | "SYSTEM";
  actorId?: string | null;
  timestamp?: string;
}

export interface WorkflowEngine<TState extends string = CaseStatus> {
  canTransition(from: WorkflowState<TState>, to: WorkflowState<TState>): boolean;
  getAllowedNextStates(from: WorkflowState<TState>): readonly WorkflowState<TState>[];
  validateTransition(
    from: WorkflowState<TState>,
    to: WorkflowState<TState>,
    context?: Record<string, unknown>
  ): StateTransition<TState>;
}
