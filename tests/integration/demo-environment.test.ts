import { describe, expect, it } from "vitest";
import {
  AppointmentStatus,
  BarrierCategory,
  CaseStatus,
  InterventionStatus,
  InterventionType,
  ReferralStatus,
  RiskLevel,
} from "@prisma/client";
import { prisma } from "@/lib/db";

describe("Synthetic Demonstration Environment Verification", () => {
  it("meets all volume thresholds (>=50 members, >=75 referrals, >=20 providers) and clinical/operational diversity", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });

    const [
      memberCount,
      referralCount,
      providerCount,
      providers,
      referrals,
      availCount,
      completedCount,
      noShowCount,
      unresolvedCount,
      escalatedCount,
    ] = await Promise.all([
      prisma.member.count({ where: { tenantId: horizon.id } }),
      prisma.referral.count({ where: { tenantId: horizon.id } }),
      prisma.provider.count({ where: { tenantId: horizon.id } }),
      prisma.provider.findMany({ where: { tenantId: horizon.id } }),
      prisma.referral.findMany({ where: { tenantId: horizon.id } }),
      prisma.providerAvailability.count({ where: { tenantId: horizon.id, status: "AVAILABLE" } }),
      prisma.case.count({ where: { tenantId: horizon.id, firstCompletedVisitAt: { not: null } } }),
      prisma.appointment.count({ where: { tenantId: horizon.id, status: AppointmentStatus.NO_SHOW } }),
      prisma.referral.count({ where: { tenantId: horizon.id, status: ReferralStatus.CLOSED_UNRESOLVED } }),
      prisma.case.count({ where: { tenantId: horizon.id, status: CaseStatus.ESCALATED } }),
    ]);

    expect(memberCount).toBeGreaterThanOrEqual(50);
    expect(referralCount).toBeGreaterThanOrEqual(75);
    expect(providerCount).toBeGreaterThanOrEqual(20);
    expect(availCount).toBeGreaterThanOrEqual(10);
    expect(completedCount).toBeGreaterThanOrEqual(20);
    expect(noShowCount).toBeGreaterThanOrEqual(5);
    expect(unresolvedCount).toBeGreaterThanOrEqual(5);
    expect(escalatedCount).toBeGreaterThanOrEqual(4);

    const uniqueSpecialties = new Set(providers.map((p) => p.specialty));
    const uniqueLanguages = new Set(providers.flatMap((p) => p.languages));
    const uniqueNetworks = new Set(referrals.map((r) => r.networkRequired));
    expect(uniqueSpecialties.size).toBeGreaterThanOrEqual(5);
    expect(uniqueLanguages.size).toBeGreaterThanOrEqual(6);
    expect(uniqueNetworks.size).toBeGreaterThanOrEqual(4);
  });

  it("contains all 5 explicit CareLoop demonstration showcase scenarios end-to-end", async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });

    async function loadByRef(externalReferralId: string) {
      return prisma.case.findFirstOrThrow({
        where: { tenantId: horizon.id, referral: { externalReferralId } },
        include: {
          referral: true,
          barriers: true,
          interventions: { include: { outcomes: true } },
          appointments: { orderBy: { scheduledStartAt: "asc" } },
          verifications: true,
          workflowEvents: true,
        },
      });
    }

    // 1. Successful case: high risk -> provider barrier -> match -> appt -> completed -> verified -> closed
    const successCase = await loadByRef("REF-DEMO-SUCCESS-01");
    expect(successCase.riskLevel).toBe(RiskLevel.HIGH);
    expect(successCase.primaryBarrierCategory).toBe(BarrierCategory.ACCESS);
    expect(successCase.matchedProviderId).toBeTruthy();
    expect(successCase.appointments.some((a) => a.status === AppointmentStatus.COMPLETED)).toBe(true);
    expect(successCase.verifications.length).toBeGreaterThanOrEqual(2);
    expect(successCase.firstCompletedVisitAt).toBeTruthy();
    expect(successCase.status).toBe(CaseStatus.CLOSED);

    // 2. Failed case: high risk -> unknown barrier -> human outreach -> unreachable -> escalated -> unresolved
    const failedCase = await loadByRef("REF-DEMO-FAILED-01");
    expect(failedCase.riskLevel).toBe(RiskLevel.HIGH);
    expect(failedCase.primaryBarrierCategory).toBe(BarrierCategory.UNKNOWN);
    expect(failedCase.interventions.some((i) => i.type === InterventionType.HUMAN_OUTREACH && i.status === InterventionStatus.FAILED)).toBe(true);
    expect(failedCase.status).toBe(CaseStatus.ESCALATED);
    expect(failedCase.referral.status).toBe(ReferralStatus.CLOSED_UNRESOLVED);

    // 3. Equity case: language barrier -> language-compatible provider -> completed visit
    const equityCase = await loadByRef("REF-DEMO-EQUITY-01");
    expect(equityCase.primaryBarrierCategory).toBe(BarrierCategory.COMMUNICATION);
    expect(equityCase.interventions.some((i) => i.type === InterventionType.LANGUAGE_COMPATIBLE_PROVIDER_SEARCH)).toBe(true);
    expect(equityCase.appointments.some((a) => a.status === AppointmentStatus.COMPLETED)).toBe(true);
    expect(equityCase.firstCompletedVisitAt).toBeTruthy();

    // 4. Scheduling case: scheduling barrier -> assisted scheduling -> appointment -> completion
    const schedCase = await loadByRef("REF-DEMO-SCHED-01");
    expect(schedCase.primaryBarrierCategory).toBe(BarrierCategory.ACCESS);
    expect(schedCase.interventions.some((i) => i.type === InterventionType.ASSISTED_SCHEDULING && i.status === InterventionStatus.COMPLETED)).toBe(true);
    expect(schedCase.appointments.some((a) => a.status === AppointmentStatus.COMPLETED)).toBe(true);
    expect(schedCase.firstCompletedVisitAt).toBeTruthy();

    // 5. No-show case: appointment -> NO_SHOW -> re-engagement -> rescheduled appointment -> completion
    const noShowCase = await loadByRef("REF-DEMO-NOSHOW-01");
    expect(noShowCase.appointments.some((a) => a.status === AppointmentStatus.NO_SHOW)).toBe(true);
    expect(noShowCase.appointments.some((a) => a.status === AppointmentStatus.COMPLETED)).toBe(true);
    expect(noShowCase.interventions.some((i) => i.type === InterventionType.MISSED_APPOINTMENT_REENGAGEMENT)).toBe(true);
    expect(noShowCase.firstCompletedVisitAt).toBeTruthy();
  });
});
