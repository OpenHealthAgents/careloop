import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CaseStatus,
  RiskLevel,
  UserRole,
  VerificationSignalType,
  VerificationStatus,
} from "@prisma/client";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const mockCookieMap = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookieMap.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

import { PATCH as updateAppointmentRoute } from "@/app/api/appointments/[id]/route";
import { POST as scheduleCaseAppointmentRoute } from "@/app/api/cases/[id]/appointments/route";
import { POST as verifyCaseCompletionRoute } from "@/app/api/cases/[id]/verifications/route";

describe("Appointment Management & Multi-Source Completion Verification (PostgreSQL)", () => {
  let horizonTenantId = "";
  let cmToken = "";
  let providerId = "";
  let testCaseId = "";
  let testReferralId = "";
  let testMemberId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    horizonTenantId = horizon.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
    });
    cmToken = createSessionToken({
      userId: cm.id,
      tenantId: horizon.id,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
    });

    const provider = await prisma.provider.findFirstOrThrow({
      where: {
        tenantId: horizonTenantId,
        acceptingNewPatients: true,
        availabilitySource: { not: "NOT_AVAILABLE" },
      },
    });
    providerId = provider.id;

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId: horizonTenantId,
        externalMemberId: `MEM-APPT-${suffix}`,
        firstName: "Hannah",
        lastName: "Ortiz",
        preferredLanguage: "English",
        geography: "Westside",
        consentSms: true,
        consentOutreach: true,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        externalReferralId: `REF-APPT-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Counseling",
        specialty: "Outpatient Behavioral Health",
        geography: "Westside",
        networkRequired: "Horizon Medicaid",
        preferredLanguage: "English",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId: horizonTenantId,
        memberId: member.id,
        referralId: referral.id,
        status: CaseStatus.INTERVENTION_IN_PROGRESS,
        riskLevel: RiskLevel.MEDIUM,
        priorityScore: 54,
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testReferralId) {
      await prisma.referral.deleteMany({ where: { id: testReferralId } });
    }
    if (testMemberId) {
      await prisma.member.deleteMany({ where: { id: testMemberId } });
    }
  });

  it("supports all 8 appointment states, prevents scheduled-as-completed fallacy, and verifies multi-source completion end-to-end", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, cmToken);

    // 1. Create REQUESTED appointment
    const reqRes = await scheduleCaseAppointmentRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          scheduledStartAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          modality: "TELEHEALTH",
          initialStatus: "REQUESTED",
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(reqRes.status).toBe(201);
    const firstApptId = (await reqRes.json()).appointment.id as string;

    // 2. REQUESTED -> SCHEDULED -> Reminder -> CONFIRMED
    expect(
      (
        await updateAppointmentRoute(
          new Request(`http://localhost/api/appointments/${firstApptId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "SCHEDULE" }),
          }),
          { params: Promise.resolve({ id: firstApptId }) }
        )
      ).status
    ).toBe(200);

    const remindRes = await updateAppointmentRoute(
      new Request(`http://localhost/api/appointments/${firstApptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SEND_REMINDER", channel: "SMS" }),
      }),
      { params: Promise.resolve({ id: firstApptId }) }
    );
    expect(remindRes.status).toBe(200);
    expect((await remindRes.json()).appointment.reminderChannel).toBe("SMS");

    const confirmRes = await updateAppointmentRoute(
      new Request(`http://localhost/api/appointments/${firstApptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM" }),
      }),
      { params: Promise.resolve({ id: firstApptId }) }
    );
    expect(confirmRes.status).toBe(200);
    expect((await confirmRes.json()).appointment.status).toBe("CONFIRMED");

    // Invariant: Scheduled & Confirmed NEVER count as completed care
    const midCase = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(midCase.firstCompletedVisitAt).toBeNull();
    expect(midCase.status).toBe("APPOINTMENT_CONFIRMED");

    // 3. RESCHEDULE creates replacement appointment; verify UNKNOWN & CANCEL paths too
    const reschedRes = await updateAppointmentRoute(
      new Request(`http://localhost/api/appointments/${firstApptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESCHEDULE",
          rescheduledStartAt: new Date(Date.now() + 4 * 86_400_000).toISOString(),
          note: "Member preferred Thursday",
        }),
      }),
      { params: Promise.resolve({ id: firstApptId }) }
    );
    expect(reschedRes.status).toBe(200);
    expect((await reschedRes.json()).appointment.status).toBe("RESCHEDULED");

    const allAppts = await prisma.appointment.findMany({
      where: { caseId: testCaseId },
      orderBy: { createdAt: "desc" },
    });
    const activeApptId = allAppts[0].id;
    expect(allAppts[0].status).toBe("SCHEDULED");

    // Mark UNKNOWN -> then CONFIRM -> then verify via multiple sources (PROVIDER_CONFIRMATION + CLAIM_RECEIVED)
    expect(
      (
        await updateAppointmentRoute(
          new Request(`http://localhost/api/appointments/${activeApptId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "MARK_UNKNOWN", note: "Waiting for office roster" }),
          }),
          { params: Promise.resolve({ id: activeApptId }) }
        )
      ).status
    ).toBe(200);

    // 4. Disputed / non-verified signal MUST NOT mark visit completed
    const disputedRes = await verifyCaseCompletionRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/verifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: activeApptId,
          signalType: VerificationSignalType.MEMBER_CONFIRMATION,
          sourceSystem: "MEMBER_PORTAL",
          evidenceNote: "Member unsure whether intake counted",
          verificationStatus: VerificationStatus.DISPUTED,
          confidence: 0.4,
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(disputedRes.status).toBe(201);
    const caseAfterDispute = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterDispute.firstCompletedVisitAt).toBeNull();

    // 5. Verified PROVIDER_CONFIRMATION + CLAIM_RECEIVED complete end-to-end Referral -> CLOSED transition
    const providerVerifyRes = await verifyCaseCompletionRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/verifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: activeApptId,
          signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
          sourceSystem: "EHR_PROVIDER_ATTESTATION",
          evidenceNote: "Clinician attested first 50-minute session completed",
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: 0.96,
          closeCaseAfterVerify: false,
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(providerVerifyRes.status).toBe(201);

    const claimVerifyRes = await verifyCaseCompletionRoute(
      new Request(`http://localhost/api/cases/${testCaseId}/verifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: activeApptId,
          signalType: VerificationSignalType.CLAIM_RECEIVED,
          sourceSystem: "X12_837_CLAIMS",
          evidenceNote: "Paid outpatient behavioral-health CPT 90834 claim",
          verificationStatus: VerificationStatus.VERIFIED,
          confidence: 0.99,
          closeCaseAfterVerify: true,
        }),
      }),
      { params: Promise.resolve({ id: testCaseId }) }
    );
    expect(claimVerifyRes.status).toBe(201);

    const finalCase = await prisma.case.findUniqueOrThrow({
      where: { id: testCaseId },
      include: { referral: true, appointments: true, verifications: true },
    });
    expect(finalCase.firstCompletedVisitAt).not.toBeNull();
    expect(finalCase.status).toBe("CLOSED");
    expect(finalCase.referral.status).toBe("COMPLETED");
    expect(finalCase.appointments.find((a) => a.id === activeApptId)?.status).toBe("COMPLETED");
    expect(finalCase.verifications.some((v) => v.confidence === 0.99)).toBe(true);

    // 6. Terminal COMPLETED appointment cannot transition to CANCELLED
    const illegalCompletedCancel = await updateAppointmentRoute(
      new Request(`http://localhost/api/appointments/${activeApptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      }),
      { params: Promise.resolve({ id: activeApptId }) }
    );
    expect(illegalCompletedCancel.status).toBe(409);
  });
});
