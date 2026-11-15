import { AvailabilitySource } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRequestContext, toErrorResponse } from "@/lib/auth/request-context";
import { prisma } from "@/lib/db";
import { recordAuditEvent } from "@/services/audit-service";

const CreateProviderSchema = z.object({
  npi: z.string().min(5),
  name: z.string().min(2),
  organizationName: z.string().min(2),
  specialty: z.string().min(2),
  networkNames: z.array(z.string()).min(1),
  languages: z.array(z.string()).min(1),
  geography: z.string().min(2),
  county: z.string().min(2),
  telehealthAvailable: z.boolean().default(true),
  acceptingNewPatients: z.boolean().default(true),
  availabilitySource: z.nativeEnum(AvailabilitySource).default("DIRECTORY_INFORMATION"),
  directoryWaitDays: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const { session } = await requireRequestContext(request, "providers.read");
    const providers = await prisma.provider.findMany({
      where: { tenantId: session.tenantId },
      include: {
        availabilities: {
          where: { status: "AVAILABLE" },
          orderBy: { slotStartAt: "asc" },
        },
      },
      orderBy: [{ availabilitySource: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ providers });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { session, correlationId } = await requireRequestContext(request, "providers.manage");
    const body = CreateProviderSchema.parse(await request.json());

    const provider = await prisma.provider.create({
      data: {
        tenantId: session.tenantId,
        npi: body.npi,
        name: body.name,
        organizationName: body.organizationName,
        specialty: body.specialty,
        networkNames: body.networkNames,
        languages: body.languages,
        geography: body.geography,
        county: body.county,
        telehealthAvailable: body.telehealthAvailable,
        acceptingNewPatients: body.acceptingNewPatients,
        availabilitySource: body.availabilitySource,
        directoryWaitDays: body.directoryWaitDays ?? null,
        availabilityLastVerifiedAt:
          body.availabilitySource === "VERIFIED_AVAILABILITY" ? new Date() : null,
        notes: body.notes ?? null,
      },
    });

    await recordAuditEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "PROVIDER_CREATED",
      entityType: "Provider",
      entityId: provider.id,
      correlationId,
      summary: `Added provider ${provider.name} (${provider.availabilitySource})`,
    });

    return NextResponse.json({ provider }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
