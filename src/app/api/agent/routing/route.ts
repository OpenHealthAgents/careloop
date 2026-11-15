import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { agentRouter, HIGH_RISK_ACTION_SET, routeAgentTask, RoutingTask } from "@/lib/routing";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");

    return NextResponse.json({
      principle: "Minimum AI necessary to achieve the outcome safely.",
      archetypes: [
        {
          scenario: "Simple validation",
          route: "DETERMINISTIC_CODE",
          target: "deterministicValidators",
          tokens: 0,
          cost: "$0.00",
          latency: "<1ms",
        },
        {
          scenario: "Barrier classification",
          route: "LOW_COST_MODEL",
          target: "gpt-4o-mini",
          tokens: "300-600",
          cost: "$0.15/1M prompt",
          latency: "~300-800ms",
        },
        {
          scenario: "Complex ambiguous case",
          route: "STRONGER_MODEL",
          target: "gpt-4o",
          tokens: "1000-2000",
          cost: "$2.50/1M prompt",
          latency: "~1500-3000ms",
        },
        {
          scenario: "High-risk action",
          route: "HUMAN_APPROVAL_GATE",
          target: "approvalService.requestHumanApproval",
          tokens: 0,
          cost: "Human labor only",
          latency: "Asynchronous human workflow",
        },
        {
          scenario: "Provider search",
          route: "DETERMINISTIC_TOOL",
          target: "toolExecutor.search_providers",
          tokens: 0,
          cost: "Infrastructure only",
          latency: "~10-50ms",
        },
        {
          scenario: "State transition",
          route: "DETERMINISTIC_STATE_MACHINE",
          target: "caseWorkflowEngine.validateTransition",
          tokens: 0,
          cost: "$0.00",
          latency: "<1ms",
        },
      ],
      highRiskActions: Array.from(HIGH_RISK_ACTION_SET),
      tenantId: session.tenantId,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");
    const body = (await request.json()) as Partial<RoutingTask> & { execute?: boolean };

    const task: RoutingTask = {
      taskId: body.taskId ?? `route-${Date.now()}`,
      taskType: body.taskType ?? "VALIDATION",
      actionName: body.actionName,
      riskLevel: body.riskLevel,
      isAmbiguous: body.isAmbiguous,
      ambiguitySignals: body.ambiguitySignals,
      requiresHumanApproval: body.requiresHumanApproval,
      tenantId: session.tenantId,
      caseId: body.caseId,
      inputPayload: body.inputPayload ?? {},
    };

    const decision = routeAgentTask(task);

    if (body.execute) {
      const result = await agentRouter.execute(task, { session });
      return NextResponse.json({ decision, result });
    }

    return NextResponse.json({ decision });
  } catch (err) {
    return toErrorResponse(err);
  }
}
