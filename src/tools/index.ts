import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { executeCareLoopTool } from "@/services/tool-executor";
import type { ToolCall, ToolExecutor, ToolResult } from "./contracts";

export * from "./contracts";
export * from "./registry";
export * from "./initial-tools";
export {
  CARE_LOOP_TOOL_REGISTRY,
  getToolDefinition,
  listToolRegistryMetadata,
  requiresHumanApprovalForTool,
  validateToolInput,
  validateToolOutput,
} from "@/ai/tool-registry";
export { executeCareLoopTool } from "@/services/tool-executor";

export class CareLoopToolExecutor implements ToolExecutor {
  async execute(session: SessionUser, call: ToolCall): Promise<ToolResult> {
    try {
      const result = await executeCareLoopTool({
        session,
        tool: call.tool,
        input: call.input,
        idempotencyKey: call.idempotencyKey,
        proposedNextState: call.proposedNextState ?? undefined,
        humanApproved: call.humanApproved,
        approvalId: call.approvalId,
        agentRunId: call.agentRunId,
        correlationId: call.correlationId,
      });

      return {
        success: true,
        data: result.output,
        evidence: result.evidenceRecorded
          ? [{ auditEventType: result.auditEventType, tool: result.tool, replayed: result.replayed }]
          : [],
        error: null,
        metadata: {
          tool: call.tool,
          replayed: result.replayed,
          auditEventType: result.auditEventType,
          evidenceRecorded: result.evidenceRecorded,
          correlationId: call.correlationId ?? null,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        evidence: [],
        error: {
          code: err instanceof AppError ? err.code : "TOOL_EXECUTION_ERROR",
          message: err instanceof Error ? err.message : "Tool execution failed",
        },
        metadata: {
          tool: call.tool,
          correlationId: call.correlationId ?? null,
        },
      };
    }
  }
}

export const careLoopToolExecutor = new CareLoopToolExecutor();
export const ToolExecutorService = careLoopToolExecutor;
