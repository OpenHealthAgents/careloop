import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UserRole, VerificationSignalType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SessionUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { getDashboardAnalytics, getHealthEquityAnalytics } from "@/services/analytics-service";
import {
  confirmOrCorrectBarrier,
  getCaseDetail,
  recordCompletionVerification,
  reviewIntervention,
  scheduleAppointmentForCase,
  transitionCaseStatus,
  updateAppointmentStatus,
} from "@/services/case-service";
import { ingestReferralsFromCsv } from "@/services/ingestion-service";

describe("End-to-End CareLoop Journey & Tenant Isolation (PostgreSQL Integration)", () => {
  let horizonTenantId = "";
  let pacificTenantId = "";
  let careManagerSession: SessionUser;
  let pacificAdminSession: SessionUser;
  const createdReferralId = `REF-E2E-${Date.now()}`;
  const createdMemberId = `MEM-E2E-${Date.now()}`;
  let createdCaseId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;
    pacificTenantId = pacific.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });
    const pacAdmin = await prisma.user.findFirstOrThrow({
      where: { tenantId: pacificTenantId, role: UserRole.ADMIN },
    });

    careManagerSession = {
      userId: cm.id,
      tenantId: horizonTenantId,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    pacificAdminSession = {
      userId: pacAdmin.id,
      tenantId: pacificTenantId,
      tenantSlug: pacific.slug,
      email: pacAdmin.email,
      name: pacAdmin.name,
      role: pacAdmin.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  });

  afterAll(async () => {
    // Clean up test records created during E2E test so demo dataset remains clean
    if (createdCaseId) {
      await prisma.case.deleteMany({ where: { id: createdCaseId } });
    }
    await prisma.referral.deleteMany({ where: { externalReferralId: createdReferralId } });
    await prisma.member.deleteMany({ where: { externalMemberId: createdMemberId } });
    await prisma.ingestionBatch.deleteMany({
      where: { fileName: "e2e-test-batch.csv", tenantId: horizonTenantId },
    });
  });

  it("executes full Referral -> Risk/Barrier -> Human Approval -> Scheduling -> Completion -> Verification -> Dashboard KPI loop", async () => {
    const baseline = await getDashboardAnalytics(horizonTenantId);

    // 1. Referral arrives via CSV ingestion (10 days old, 2 prior no-shows, no transit, limited digital access)
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const csv = `member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,urgency,geography,urbanicity,network_required,coverage_type,eligibility_verified,preferred_language,consent_sms,digital_access_level,transportation_access,prior_no_show_count,operational_notes
${createdMemberId},Mateo,Solis,${createdReferralId},${tenDaysAgo},Outpatient Therapy,Outpatient Behavioral Health,EXPEDITED,Central Metro,URBAN,Horizon Medicaid,MEDICAID,UNVERIFIED,Spanish,true,NONE,NONE,2,Needs Spanish provider and lacks reliable transportation`;

    const ingested = await ingestReferralsFromCsv({
      session: careManagerSession,
      fileName: "e2e-test-batch.csv",
      csvText: csv,
      correlationId: "e2e-corr-1",
    });

    expect(ingested.batch.successRows).toBe(1);
    expect(ingested.createdCases).toHaveLength(1);
    createdCaseId = ingested.createdCases[0].caseId;

    // 2. System identified risk & inferred barrier & recommended intervention
    const detailAfterIngest = await getCaseDetail(horizonTenantId, createdCaseId);
    expect(detailAfterIngest.riskLevel).toBe("HIGH");
    expect(detailAfterIngest.priorityScore).toBeGreaterThanOrEqual(70);
    expect(detailAfterIngest.status).toBe("INTERVENTION_RECOMMENDED");
    expect(detailAfterIngest.aiRecommendations.length).toBeGreaterThanOrEqual(4);
    expect(detailAfterIngest.aiRecommendations[0].promptVersion).toBeTruthy();
    expect(detailAfterIngest.aiRecommendations[0].inputContext).toBeTruthy();
    expect(detailAfterIngest.aiRecommendations[0].outputPayload).toBeTruthy();
    expect(detailAfterIngest.aiRecommendations[0].resultingAction).toBeTruthy();
    expect(detailAfterIngest.riskAssessments.length).toBeGreaterThanOrEqual(1);
    expect(detailAfterIngest.barriers[0].epistemicStatus).toBe("INFERENCE");

    // 3. Enforce tenant isolation: Pacific tenant cannot read Horizon case
    await expect(getCaseDetail(pacificTenantId, createdCaseId)).rejects.toThrow(NotFoundError);
    await expect(
      transitionCaseStatus({
        session: pacificAdminSession,
        caseId: createdCaseId,
        toStatus: "ESCALATED",
        reason: "Cross-tenant attempt should fail",
      })
    ).rejects.toThrow(NotFoundError);

    // 4. Human confirms barrier as FACT and approves recommended intervention
    const confirmedBarrier = await confirmOrCorrectBarrier({
      session: careManagerSession,
      caseId: createdCaseId,
      category: "COMMUNICATION",
      subBarrier: "language",
      evidenceNote: "Member confirmed Spanish preference during intake call",
    });
    expect(confirmedBarrier.epistemicStatus).toBe("FACT");
    expect(confirmedBarrier.confirmedByHuman).toBe(true);

    const recommendedInv = detailAfterIngest.interventions[0];
    const approvedInv = await reviewIntervention({
      session: careManagerSession,
      interventionId: recommendedInv.id,
      decision: "APPROVE",
      notes: "Approved by Care Manager for Spanish telehealth matching",
    });
    expect(approvedInv.status).toBe("APPROVED");

    // 5. Match verified provider and schedule appointment
    const verifiedProvider = await prisma.provider.findFirstOrThrow({
      where: { tenantId: horizonTenantId, availabilitySource: "VERIFIED_AVAILABILITY" },
    });

    const appt = await scheduleAppointmentForCase({
      session: careManagerSession,
      caseId: createdCaseId,
      providerId: verifiedProvider.id,
      scheduledStartAt: new Date(Date.now() + 2 * 86400000),
      modality: "TELEHEALTH",
    });
    expect(appt.status).toBe("SCHEDULED");
    expect(appt.availabilitySourceAtBooking).toBe("VERIFIED_AVAILABILITY");

    // 6. Confirm & complete appointment
    await updateAppointmentStatus({
      session: careManagerSession,
      appointmentId: appt.id,
      action: "CONFIRM",
    });
    const completedAppt = await updateAppointmentStatus({
      session: careManagerSession,
      appointmentId: appt.id,
      action: "COMPLETE",
    });
    expect(completedAppt?.status).toBe("COMPLETED");

    // 7. Record completion verification (claim received) and close case
    const verification = await recordCompletionVerification({
      session: careManagerSession,
      caseId: createdCaseId,
      appointmentId: appt.id,
      signalType: VerificationSignalType.CLAIM_RECEIVED,
      sourceSystem: "X12_837_CLAIMS",
      evidenceNote: "Initial behavioral health visit claim adjudicated",
      closeCaseAfterVerify: true,
    });
    expect(verification.verified).toBe(true);

    const finalCase = await getCaseDetail(horizonTenantId, createdCaseId);
    expect(finalCase.status).toBe("CLOSED");
    expect(finalCase.firstCompletedVisitAt).not.toBeNull();

    // 8. Dashboard & Equity analytics reflect the completed visit
    const afterDashboard = await getDashboardAnalytics(horizonTenantId);
    expect(afterDashboard.kpis.totalReferrals).toBe(baseline.kpis.totalReferrals + 1);
    expect(afterDashboard.kpis.completedCount).toBe(baseline.kpis.completedCount + 1);

    const equity = await getHealthEquityAnalytics(horizonTenantId);
    expect(equity.byLanguage.some((row) => row.cohort === "Spanish")).toBe(true);
  });
});
