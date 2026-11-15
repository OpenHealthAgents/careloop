import { AvailabilitySource } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { providerRepository } from "@/repositories/provider-repository";
import { recordAuditEvent } from "@/services/audit-service";

const AddAvailabilitySchema = z.object({
  slotStartAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "slotStartAt must be a valid ISO date",
  }),
  durationMinutes: z.number().int().min(15).max(180).default(50),
  modality: z.enum(["TELEHEALTH", "IN_PERSON"]).default("TELEHEALTH"),
  source: z.nativeEnum(AvailabilitySource).default("VERIFIED_AVAILABILITY"),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, correlationId } = await requireRequestContext(
      request,
      PERMISSIONS.PROVIDERS_MANAGE
    );
    const { id } = await context.params;
    const body = AddAvailabilitySchema.parse(await request.json());

    const start = new Date(body.slotStartAt);
    const end = new Date(start.getTime() + body.durationMinutes * 60 * 1000);

    const slot = await providerRepository.addAvailability({
      tenantId: session.tenantId,
      providerId: id,
      slotStartAt: start,
      slotEndAt: end,
      modality: body.modality,
      source: body.source,
    });

    if (body.source === "VERIFIED_AVAILABILITY") {
      await prisma.provider.update({
        where: { id },
        data: {
          availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY,
          availabilityLastVerifiedAt: new Date(),
          nextVerifiedSlotAt: start,
          acceptingNewPatients: true,
        },
      });
    }

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "PROVIDER_AVAILABILITY_ADDED",
      entityType: "ProviderAvailability",
      entityId: slot.id,
      correlationId,
      summary: `Added ${body.source} ${body.modality} slot for provider ${id}`,
    });

    return NextResponse.json({ availability: slot }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
