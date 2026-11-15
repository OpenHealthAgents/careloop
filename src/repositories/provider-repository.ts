import { AvailabilitySource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const providerRepository = {
  async listWithAvailabilities(tenantId: string) {
    if (!tenantId) throw new ValidationError("tenantId is required");
    return prisma.provider.findMany({
      where: { tenantId },
      include: {
        availabilities: {
          where: { status: "AVAILABLE" },
          orderBy: { slotStartAt: "asc" },
        },
      },
      orderBy: [{ availabilitySource: "asc" }, { name: "asc" }],
    });
  },

  async findById(tenantId: string, providerId: string) {
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, tenantId },
      include: { availabilities: true },
    });
    if (!provider) throw new NotFoundError("Provider", providerId);
    return provider;
  },

  async addAvailability(params: {
    tenantId: string;
    providerId: string;
    slotStartAt: Date;
    slotEndAt: Date;
    modality: "IN_PERSON" | "TELEHEALTH";
    source: AvailabilitySource;
    waitDaysEstimate?: number;
  }) {
    const provider = await prisma.provider.findFirst({
      where: { id: params.providerId, tenantId: params.tenantId },
    });
    if (!provider) throw new NotFoundError("Provider", params.providerId);

    return prisma.providerAvailability.create({
      data: {
        tenantId: params.tenantId,
        providerId: provider.id,
        slotStartAt: params.slotStartAt,
        slotEndAt: params.slotEndAt,
        modality: params.modality,
        source: params.source,
        status: "AVAILABLE",
        waitDaysEstimate: params.waitDaysEstimate ?? null,
        verifiedAt: params.source === "VERIFIED_AVAILABILITY" ? new Date() : null,
      },
    });
  },

  async reserveAvailability(tenantId: string, providerId: string, availabilityId: string) {
    const slot = await prisma.providerAvailability.findFirst({
      where: { id: availabilityId, providerId, tenantId },
    });
    if (!slot) throw new NotFoundError("ProviderAvailability", availabilityId);
    if (slot.status !== "AVAILABLE") {
      throw new ConflictError("Selected provider availability slot is no longer available");
    }
    return prisma.providerAvailability.update({
      where: { id: slot.id },
      data: { status: "BOOKED" },
    });
  },
};
