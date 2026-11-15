import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  approveCommunication,
  markCommunicationDelivered,
  recordCommunicationOutcome,
  sendCommunication,
} from "@/services/communication-orchestration-service";

const TransitionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("APPROVE"),
  }),
  z.object({
    action: z.literal("SEND"),
  }),
  z.object({
    action: z.literal("DELIVER"),
  }),
  z.object({
    action: z.literal("RECORD_OUTCOME"),
    outcome: z.enum(["RESPONDED", "NO_RESPONSE"]),
    memberResponseSummary: z.string().max(1000).optional(),
    outcomeSummary: z.string().max(500).optional(),
    inferredBarrier: z.string().optional(),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ commId: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "cases.manage");
    const { commId } = await context.params;
    const body = TransitionSchema.parse(await request.json());

    switch (body.action) {
      case "APPROVE": {
        const communication = await approveCommunication({
          session,
          communicationId: commId,
          correlationId,
        });
        return NextResponse.json({ communication });
      }
      case "SEND": {
        const communication = await sendCommunication({
          session,
          communicationId: commId,
          correlationId,
        });
        return NextResponse.json({ communication });
      }
      case "DELIVER": {
        const communication = await markCommunicationDelivered({
          session,
          communicationId: commId,
          correlationId,
        });
        return NextResponse.json({ communication });
      }
      case "RECORD_OUTCOME": {
        const result = await recordCommunicationOutcome({
          session,
          communicationId: commId,
          outcome: body.outcome,
          memberResponseSummary: body.memberResponseSummary,
          outcomeSummary: body.outcomeSummary,
          inferredBarrier: body.inferredBarrier,
          correlationId,
        });
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
