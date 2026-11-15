import { NextResponse } from "next/server";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import {
  careLoopEventBus,
  CareLoopEvent,
  CareLoopEventType,
  eventIdempotencyStore,
} from "@/lib/events";

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.read");

    return NextResponse.json({
      supportedEvents: [
        "ReferralCreated",
        "ReferralUpdated",
        "ProviderFound",
        "ProviderUnavailable",
        "MemberResponded",
        "AppointmentScheduled",
        "AppointmentCancelled",
        "AppointmentCompleted",
        "ClaimReceived",
        "HumanApprovalGranted",
        "HumanApprovalRejected",
        "BarrierUpdated",
      ],
      guarantees: {
        idempotent: true,
        reactiveAgents: true,
        deterministicStateTransitions: true,
      },
      tenantId: session.tenantId,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "cases.write");
    const body = (await request.json()) as Partial<CareLoopEvent> & {
      eventType: CareLoopEventType;
      caseId: string;
      payload: any;
    };

    const idempotencyKey =
      body.idempotencyKey ??
      eventIdempotencyStore.generateKey(
        session.tenantId,
        body.eventType,
        body.caseId,
        Date.now()
      );

    const event: CareLoopEvent = {
      eventId: body.eventId ?? `evt-${Date.now()}`,
      eventType: body.eventType,
      idempotencyKey,
      tenantId: session.tenantId,
      caseId: body.caseId,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      correlationId: body.correlationId ?? `corr-${Date.now()}`,
      actor: body.actor ?? { type: "HUMAN", id: session.userId, role: session.role },
      payload: body.payload,
    };

    const result = await careLoopEventBus.publish(event);

    return NextResponse.json({ result });
  } catch (err) {
    return toErrorResponse(err);
  }
}
