import { beforeAll, describe, expect, it } from "vitest";
import {
  AppointmentStatus,
  BarrierCategory,
  CommunicationChannel,
  InterventionStatus,
  Prisma,
  RecommendationStatus,
  ReferralStatus,
} from "@prisma/client";
import {
  assertAppointmentTransition,
  assertRecommendationTransition,
} from "@/domain/appointments/state-machine";
import { assertCaseTransition } from "@/domain/cases/state-machine";
import { assertInterventionTransition } from "@/domain/interventions/state-machine";
import { assertReferralTransition } from "@/domain/referrals/state-machine";
import { prisma } from "@/lib/db";
import { InvalidStateTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import { caseRepository } from "@/repositories/case-repository";
import { governanceRepository } from "@/repositories/governance-repository";
import { memberRepository } from "@/repositories/member-repository";
import { providerRepository } from "@/repositories/provider-repository";

describe("Normalized Domain Model & Repositories", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;
    pacificTenantId = pacific.id;
  });

  it("verifies relational integrity across all 20 normalized entities", async () => {
    const [
      roles,
      users,
      members,
      consents,
      referrals,
      providers,
      availabilities,
      cases,
      barriers,
      riskAssessments,
      aiRecs,
      interventions,
      outcomes,
      communications,
      appointments,
      verifications,
      workflowEvents,
      auditEvents,
      equityMetrics,
      notifications,
    ] = await Promise.all([
      governanceRepository.listRolesForTenant(horizonTenantId),
      prisma.user.findMany({ where: { tenantId: horizonTenantId }, include: { roleEntity: true } }),
      memberRepository.listByTenant(horizonTenantId),
      prisma.consent.findMany({ where: { tenantId: horizonTenantId } }),
      memberRepository.listReferralsByTenant(horizonTenantId),
      providerRepository.listWithAvailabilities(horizonTenantId),
      prisma.providerAvailability.findMany({ where: { tenantId: horizonTenantId } }),
      caseRepository.listByTenant(horizonTenantId),
      prisma.barrier.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.riskAssessment.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.aIRecommendation.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.intervention.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.interventionOutcome.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.communication.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.appointment.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.completionVerification.findMany({ where: { tenantId: horizonTenantId } }),
      prisma.workflowEvent.findMany({ where: { tenantId: horizonTenantId } }),
      governanceRepository.listAuditEvents(horizonTenantId),
      governanceRepository.listEquityMetrics(horizonTenantId),
      prisma.notification.findMany({ where: { tenantId: horizonTenantId } }),
    ]);

    expect(roles.length).toBeGreaterThanOrEqual(5);
    expect(users.every((u) => u.roleEntity !== null)).toBe(true);
    expect(members.length).toBeGreaterThanOrEqual(10);
    expect(consents.length).toBeGreaterThanOrEqual(10);
    expect(referrals.length).toBeGreaterThanOrEqual(10);
    expect(providers.length).toBeGreaterThanOrEqual(5);
    expect(availabilities.length).toBeGreaterThanOrEqual(3);
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(barriers.length).toBeGreaterThanOrEqual(10);
    expect(riskAssessments.length).toBeGreaterThanOrEqual(10);
    expect(aiRecs.length).toBeGreaterThanOrEqual(10);
    expect(interventions.length).toBeGreaterThanOrEqual(10);
    expect(outcomes.length).toBeGreaterThanOrEqual(4);
    expect(communications.length).toBeGreaterThanOrEqual(5);
    expect(appointments.length).toBeGreaterThanOrEqual(5);
    expect(verifications.length).toBeGreaterThanOrEqual(4);
    expect(workflowEvents.length).toBeGreaterThanOrEqual(10);
    expect(auditEvents.length).toBeGreaterThanOrEqual(1);
    expect(equityMetrics.length).toBeGreaterThanOrEqual(2);
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    // Traverse nested relationships from Case -> Member/Consent/Referral/RiskAssessment/AIRecommendation/Intervention/Outcome
    const completedCase = cases.find((c) => c.status === "CLOSED" && c.firstCompletedVisitAt !== null)!;
    const detail = await caseRepository.findDetailById(horizonTenantId, completedCase.id);
    expect(detail.member.consents.length).toBeGreaterThanOrEqual(1);
    expect(detail.referral.id).toBe(completedCase.referralId);
    expect(detail.riskAssessments.length).toBeGreaterThanOrEqual(1);
    expect(detail.aiRecommendations.length).toBeGreaterThanOrEqual(1);
    expect(detail.interventions[0].outcomes.length).toBeGreaterThanOrEqual(1);
    expect(detail.verifications.length).toBeGreaterThanOrEqual(1);
  });

  it("strictly enforces tenant isolation across Member, Referral, Case, Provider, and Notification", async () => {
    const horizonMembers = await memberRepository.listByTenant(horizonTenantId);
    const horizonCase = (await caseRepository.listByTenant(horizonTenantId))[0];
    const horizonProvider = (await providerRepository.listWithAvailabilities(horizonTenantId))[0];
    const horizonReferral = (await memberRepository.listReferralsByTenant(horizonTenantId))[0];
    const horizonNotif = await prisma.notification.findFirstOrThrow({
      where: { tenantId: horizonTenantId },
    });

    // Pacific tenant MUST NOT access Horizon records
    await expect(memberRepository.findById(pacificTenantId, horizonMembers[0].id)).rejects.toThrow(
      NotFoundError
    );
    await expect(
      memberRepository.upsertConsent({
        tenantId: pacificTenantId,
        memberId: horizonMembers[0].id,
        channel: CommunicationChannel.SMS,
        purpose: "CARE_OUTREACH",
        granted: false,
      })
    ).rejects.toThrow(NotFoundError);
    await expect(
      memberRepository.findReferralById(pacificTenantId, horizonReferral.id)
    ).rejects.toThrow(NotFoundError);
    await expect(caseRepository.findDetailById(pacificTenantId, horizonCase.id)).rejects.toThrow(
      NotFoundError
    );
    await expect(
      providerRepository.findById(pacificTenantId, horizonProvider.id)
    ).rejects.toThrow(NotFoundError);
    await expect(
      governanceRepository.markNotificationRead(pacificTenantId, horizonNotif.id)
    ).rejects.toThrow(NotFoundError);
  });

  it("enforces required fields and relational uniqueness constraints", async () => {
    await expect(memberRepository.listByTenant("")).rejects.toThrow(ValidationError);
    await expect(providerRepository.listWithAvailabilities("")).rejects.toThrow(ValidationError);
    await expect(caseRepository.listByTenant("")).rejects.toThrow(ValidationError);

    // Duplicate externalMemberId within the same tenant violates unique(tenantId, externalMemberId)
    await expect(
      prisma.member.create({
        data: {
          tenantId: horizonTenantId,
          externalMemberId: "MEM-9001",
          firstName: "Duplicate",
          lastName: "Member",
          geography: "Central Metro",
        },
      })
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);

    // Cross-tenant linking attempt via repository fails because member belongs to Horizon, not Pacific
    const horizonMember = await prisma.member.findFirstOrThrow({
      where: { tenantId: horizonTenantId },
    });
    await expect(
      memberRepository.createReferral({
        tenantId: pacificTenantId,
        memberId: horizonMember.id,
        externalReferralId: `CROSS-TENANT-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Counseling",
        specialty: "Outpatient Behavioral Health",
        geography: "West Coast",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects invalid state transitions across Case, Referral, Intervention, Appointment, and AIRecommendation", () => {
    expect(() => assertCaseTransition("NEW", "VERIFIED")).toThrow(InvalidStateTransitionError);
    expect(() => assertCaseTransition("CLOSED", "TRIAGED")).toThrow(InvalidStateTransitionError);

    expect(() =>
      assertReferralTransition(ReferralStatus.RECEIVED, ReferralStatus.COMPLETED)
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertReferralTransition(ReferralStatus.COMPLETED, ReferralStatus.RECEIVED)
    ).toThrow(InvalidStateTransitionError);

    expect(() =>
      assertInterventionTransition(InterventionStatus.RECOMMENDED, InterventionStatus.COMPLETED)
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertInterventionTransition(InterventionStatus.REJECTED, InterventionStatus.APPROVED)
    ).toThrow(InvalidStateTransitionError);

    expect(() =>
      assertAppointmentTransition(AppointmentStatus.PROPOSED, AppointmentStatus.COMPLETED)
    ).toThrow(InvalidStateTransitionError);
    expect(() =>
      assertAppointmentTransition(AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED)
    ).toThrow(InvalidStateTransitionError);

    expect(() =>
      assertRecommendationTransition(RecommendationStatus.REJECTED, RecommendationStatus.APPROVED)
    ).toThrow(InvalidStateTransitionError);

    // Valid enum values smoke assertion
    expect(Object.values(BarrierCategory)).toContain("SOCIAL_LOGISTICAL");
  });
});
