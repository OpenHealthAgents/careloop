import type { CaseOrchestratorTool } from "@/ai/schemas";
import type { CareLoopToolDefinition } from "@/ai/tool-registry";
import type { SessionUser } from "@/lib/auth/session";
import type { CaseStatus } from "@prisma/client";

export type Tool = CareLoopToolDefinition;

export interface ToolCall {
  tool: CaseOrchestratorTool;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  proposedNextState?: CaseStatus | null;
  humanApproved?: boolean;
  approvalId?: string;
  agentRunId?: string;
  correlationId?: string;
}

export interface ToolResult<TData = unknown> {
  success: boolean;
  data: TData;
  evidence: unknown[];
  error: { code: string; message: string } | null;
  metadata: Record<string, unknown>;
}

export interface ToolExecutor {
  execute(session: SessionUser, call: ToolCall): Promise<ToolResult>;
}
