import { NextResponse } from "next/server";
import { z } from "zod";
import { careLoopOrchestratorAgent } from "@/agent";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";

const OrchestrateCaseBodySchema = z
  .object({
    maxSteps: z.number().int().min(1).max(10).optional(),
    autoContinue: z.boolean().optional(),
    sensitiveCommunication: z.boolean().optional(),
    initialToolInput: z.record(z.unknown()).optional(),
    rawExternalDecision: z.string().optional(),
  })
  .default({});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "ai.run");
    const { id } = await context.params;
    const rawBody = await request.json().catch(() => ({}));
    const body = OrchestrateCaseBodySchema.parse(rawBody);

    const result = await careLoopOrchestratorAgent.orchestrateCase({
      session,
      caseId: id,
      maxSteps: body.maxSteps,
      autoContinue: body.autoContinue,
      sensitiveCommunication: body.sensitiveCommunication,
      initialToolInput: body.initialToolInput,
      rawExternalDecision: body.rawExternalDecision,
      correlationId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
