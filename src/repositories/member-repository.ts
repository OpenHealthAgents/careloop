import { CommunicationChannel, Prisma, ReferralStatus } from "@prisma/client";
import { assertReferralTransition } from "@/domain/referrals/state-machine";
import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const memberRepository = {
  async listByTenant(tenantId: string) {
    if (!tenantId) throw new ValidationError("tenantId is required");
    return prisma.member.findMany({
      where: { tenantId },
      include: {
        consents: true,
        cases: {
          select: { id: true, status: true, riskLevel: true, priorityScore: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { externalMemberId: "asc" },
    });
  },

  async findById(tenantId: string, memberId: string) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, tenantId },
      include: { consents: true, referrals: true, cases: true },
    });
    if (!member) throw new NotFoundError("Member", memberId);
    return member;
  },

  async upsertConsent(params: {
    tenantId: string;
    memberId: string;
    channel: CommunicationChannel;
    purpose: string;
    granted: boolean;
    source?: string;
  }) {
    const member = await prisma.member.findFirst({
      where: { id: params.memberId, tenantId: params.tenantId },
    });
    if (!member) throw new NotFoundError("Member", params.memberId);

    const consent = await prisma.consent.upsert({
      where: {
        tenantId_memberId_channel_purpose: {
          tenantId: params.tenantId,
          memberId: params.memberId,
          channel: params.channel,
          purpose: params.purpose,
        },
      },
      update: {
        granted: params.granted,
        revokedAt: params.granted ? null : new Date(),
        source: params.source ?? "COORDINATOR_UPDATE",
      },
      create: {
        tenantId: params.tenantId,
        memberId: params.memberId,
        channel: params.channel,
        purpose: params.purpose,
        granted: params.granted,
        source: params.source ?? "INTAKE",
      },
    });

    if (params.channel === "SMS" && params.purpose === "CARE_OUTREACH") {
      await prisma.member.update({
        where: { id: member.id },
        data: { consentSms: params.granted },
      });
    }

    return consent;
  },

  async listReferralsByTenant(tenantId: string) {
    return prisma.referral.findMany({
      where: { tenantId },
      include: {
        member: true,
        careCase: true,
      },
      orderBy: { referralDate: "desc" },
    });
  },

  async findReferralById(tenantId: string, referralId: string) {
    const ref = await prisma.referral.findFirst({
      where: { id: referralId, tenantId },
      include: { member: true, careCase: true },
    });
    if (!ref) throw new NotFoundError("Referral", referralId);
    return ref;
  },

  async transitionReferralStatus(
    tenantId: string,
    referralId: string,
    toStatus: ReferralStatus
  ) {
    const ref = await prisma.referral.findFirst({
      where: { id: referralId, tenantId },
    });
    if (!ref) throw new NotFoundError("Referral", referralId);
    assertReferralTransition(ref.status, toStatus);
    return prisma.referral.update({
      where: { id: ref.id },
      data: { status: toStatus },
    });
  },

  async createReferral(data: Prisma.ReferralUncheckedCreateInput) {
    if (!data.tenantId) throw new ValidationError("tenantId is required for Referral");
    const member = await prisma.member.findFirst({
      where: { id: data.memberId, tenantId: data.tenantId },
    });
    if (!member) throw new NotFoundError("Member", data.memberId);
    return prisma.referral.create({ data });
  },
};
