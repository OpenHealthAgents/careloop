import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AppointmentStatus,
  AvailabilitySource,
  BarrierCategory,
  CaseStatus,
  UserRole,
  VerificationSignalType,
} from "@prisma/client";
import { ExternalOpenAIProvider, parseAndValidateModelJson } from "@/ai/external-provider";
import { AIPolicyViolationError, enforceBarrierPolicy } from "@/ai/policy-guard";
import { ClassifyBarrierResultSchema } from "@/ai/schemas";
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

import { PATCH as patchAppointment } from "@/app/api/appointments/[id]/route";
import { GET as getAuditLogs } from "@/app/api/audit-logs/route";
import { POST as reviewBarrierRoute } from "@/app/api/barriers/[id]/review/route";
import { POST as scheduleCaseApptRoute } from "@/app/api/cases/[id]/appointments/route";
import { GET as getCaseDetailRoute } from "@/app/api/cases/[id]/route";
import { POST as transitionCaseRoute } from "@/app/api/cases/[id]/transition/route";
import { POST as verifyCaseRoute } from "@/app/api/cases/[id]/verifications/route";
import { GET as getDashboardRoute } from "@/app/api/dashboard/route";
import { POST as reviewInterventionRoute } from "@/app/api/interventions/[id]/review/route";
import { POST as searchProvidersRoute } from "@/app/api/providers/search/route";
import { POST as previewCsvRoute } from "@/app/api/referrals/ingest/preview/route";
import { POST as ingestCsvRoute } from "@/app/api/referrals/ingest/route";

describe("Senior QA End-to-End & Negative System Verification", () => {
  let horizonTenantId = "";
  let careManagerToken = "";
  let adminToken = "";
  let execToken = "";
  let pacificToken = "";

  const e2eRefId = `REF-QA-E2E-${Date.now()}`;
  const e2eMemberId = `MEM-QA-E2E-${Date.now()}`;
  const negUnknownRefId = `REF-QA-UNK-${Date.now()}`;
  const negUnknownMemberId = `MEM-QA-UNK-${Date.now()}`;
  const createdCaseIds: string[] = [];

  async function issueToken(userId: string, tenantId: string, tenantSlug: string, email: string, name: string, role: UserRole) {
    const dbSess = await prisma.userSession.create({
      data: { tenantId, userId, expiresAt: new Date(Date.now() + 3600 * 1000) },
    });
    return createSessionToken(
      { sid: dbSess.id, userId, tenantId, tenantSlug, email, name, role, customRoleCode: null },
      3600
    );
  }

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    const pacific = await prisma.tenant.findUniqueOrThrow({ where: { slug: "pacific-medicare" } });
    horizonTenantId = horizon.id;

    const users = await prisma.user.findMany({ where: { tenantId: horizon.id } });
    const cm = users.find((u) => u.role === UserRole.CARE_MANAGER)!;
    const admin = users.find((u) => u.role === UserRole.ADMIN)!;
    const exec = users.find((u) => u.role === UserRole.EXECUTIVE_READ_ONLY)!;
    const pacAdmin = await prisma.user.findFirstOrThrow({ where: { tenantId: pacific.id, role: UserRole.ADMIN } });

    careManagerToken = await issueToken(cm.id, horizon.id, horizon.slug, cm.email, cm.name, cm.role);
    adminToken = await issueToken(admin.id, horizon.id, horizon.slug, admin.email, admin.name, admin.role);
    execToken = await issueToken(exec.id, horizon.id, horizon.slug, exec.email, exec.name, exec.role);
    pacificToken = await issueToken(pacAdmin.id, pacific.id, pacific.slug, pacAdmin.email, pacAdmin.name, pacAdmin.role);
  });

  afterAll(async () => {
    for (const caseId of createdCaseIds) {
      await prisma.case.deleteMany({ where: { id: caseId } });
    }
    await prisma.referral.deleteMany({
      where: { externalReferralId: { in: [e2eRefId, negUnknownRefId] } },
    });
    await prisma.member.deleteMany({
      where: { externalMemberId: { in: [e2eMemberId, negUnknownMemberId] } },
    });
    await prisma.ingestionBatch.deleteMany({
      where: { tenantId: horizonTenantId, fileName: { startsWith: "qa-e2e-" } },
    });
  });

  it("executes all 15 end-to-end CareLoop API steps including dashboard reconciliation and full audit history", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);

    // Baseline executive dashboard KPIs
    const dashBeforeRes = await getDashboardRoute(new Request("http://localhost/api/dashboard"));
    expect(dashBeforeRes.status).toBe(200);
    const dashBefore = await dashBeforeRes.json();

    // Step 1: Upload referral CSV (elevated risk: 11 days aged, EXPEDITED, no transit, limited digital, 2 prior no-shows)
    const agedDate = new Date(Date.now() - 11 * 86_400_000).toISOString().slice(0, 10);
    const csv = `member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,urgency,geography,urbanicity,network_required,coverage_type,eligibility_verified,preferred_language,consent_sms,digital_access_level,transportation_access,prior_no_show_count,operational_notes
${e2eMemberId},Lucia,Herrera,${e2eRefId},${agedDate},Trauma & Depression Recovery,Outpatient Behavioral Health,EXPEDITED,Central Metro,URBAN,Horizon Medicaid,MEDICAID,UNVERIFIED,Spanish,true,NONE,NONE,2,Needs Spanish speaking therapist and no reliable transportation`;

    const ingestRes = await ingestCsvRoute(
      new Request("http://localhost/api/referrals/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-correlation-id": "qa-e2e-corr-1" },
        body: JSON.stringify({ fileName: "qa-e2e-happy.csv", csvText: csv }),
      })
    );
    expect(ingestRes.status).toBe(201);
    const ingestJson = await ingestRes.json();
    expect(ingestJson.createdCases).toHaveLength(1);
    const caseId = ingestJson.createdCases[0].caseId as string;
    createdCaseIds.push(caseId);

    // Steps 2-6: Referral created -> Elevated Risk -> Barrier identified -> Evidence shown -> Intervention recommended
    const caseRes = await getCaseDetailRoute(new Request("http://localhost/api/cases/x"), {
      params: Promise.resolve({ id: caseId }),
    });
    expect(caseRes.status).toBe(200);
    const { careCase } = await caseRes.json();

    expect(careCase.referral.externalReferralId).toBe(e2eRefId);
    expect(careCase.riskLevel).toBe("HIGH");
    expect(careCase.priorityScore).toBeGreaterThanOrEqual(70);
    expect(careCase.riskAssessments[0].evidenceSignals.length).toBeGreaterThan(0);
    expect(careCase.barriers.length).toBeGreaterThanOrEqual(1);
    expect(careCase.barriers[0].evidenceSignals.length).toBeGreaterThan(0);
    expect(careCase.interventions.length).toBeGreaterThanOrEqual(1);
    expect(careCase.interventions[0].status).toBe("RECOMMENDED");

    // Step 7: Care Manager reviews barrier & approves recommended intervention
    const barrierReviewRes = await reviewBarrierRoute(
      new Request("http://localhost/api/barriers/x/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ACCEPT",
          notes: "Care Manager verified barrier evidence directly with member.",
        }),
      }),
      { params: Promise.resolve({ id: careCase.barriers[0].id }) }
    );
    expect(barrierReviewRes.status).toBe(200);
    expect((await barrierReviewRes.json()).barrier.epistemicStatus).toBe("FACT");

    const approveInvRes = await reviewInterventionRoute(
      new Request("http://localhost/api/interventions/x/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "APPROVE",
          notes: "Care Manager approved intervention plan.",
        }),
      }),
      { params: Promise.resolve({ id: careCase.interventions[0].id }) }
    );
    expect(approveInvRes.status).toBe(200);
    expect((await approveInvRes.json()).intervention.status).toBe("APPROVED");

    // Step 8: Provider matched via search API with verified availability signal
    const matchRes = await searchProvidersRoute(
      new Request("http://localhost/api/providers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialty: "Outpatient Behavioral Health",
          network: "Horizon Medicaid",
          geography: "Central Metro",
          language: "Spanish",
          verifiedOnly: true,
        }),
      })
    );
    expect(matchRes.status).toBe(200);
    const { matches } = await matchRes.json();
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].availabilityLabel).toBe("VERIFIED AVAILABILITY");
    const chosenProvider = matches[0].provider;

    // Step 9: Appointment scheduled
    const schedRes = await scheduleCaseApptRoute(
      new Request("http://localhost/api/cases/x/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: chosenProvider.id,
          scheduledStartAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          modality: "TELEHEALTH",
        }),
      }),
      { params: Promise.resolve({ id: caseId }) }
    );
    expect(schedRes.status).toBe(201);
    const apptId = (await schedRes.json()).appointment.id as string;

    // Step 10: Appointment confirmed
    const confirmRes = await patchAppointment(
      new Request("http://localhost/api/appointments/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM", note: "Member confirmed telehealth visit." }),
      }),
      { params: Promise.resolve({ id: apptId }) }
    );
    expect(confirmRes.status).toBe(200);
    expect((await confirmRes.json()).appointment.status).toBe(AppointmentStatus.CONFIRMED);

    // Step 11: Appointment completed
    const completeRes = await patchAppointment(
      new Request("http://localhost/api/appointments/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE", note: "Session completed per clinic check-out." }),
      }),
      { params: Promise.resolve({ id: apptId }) }
    );
    expect(completeRes.status).toBe(200);
    expect((await completeRes.json()).appointment.status).toBe(AppointmentStatus.COMPLETED);

    // Step 12-13: Completion verified -> Case closes
    const verifyRes = await verifyCaseRoute(
      new Request("http://localhost/api/cases/x/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: apptId,
          signalType: VerificationSignalType.CLAIM_RECEIVED,
          sourceSystem: "X12_837_CLAIMS",
          evidenceNote: "Claim adjudicated for completed initial behavioral-health visit",
          closeCaseAfterVerify: true,
        }),
      }),
      { params: Promise.resolve({ id: caseId }) }
    );
    expect(verifyRes.status).toBe(201);

    const closedDetailRes = await getCaseDetailRoute(new Request("http://localhost/api/cases/x"), {
      params: Promise.resolve({ id: caseId }),
    });
    const closedDetail = (await closedDetailRes.json()).careCase;
    expect(closedDetail.status).toBe(CaseStatus.CLOSED);
    expect(closedDetail.firstCompletedVisitAt).toBeTruthy();

    // Step 14: Dashboard metrics update
    const dashAfterRes = await getDashboardRoute(new Request("http://localhost/api/dashboard"));
    expect(dashAfterRes.status).toBe(200);
    const dashAfter = await dashAfterRes.json();
    expect(dashAfter.volume.referralsReceived).toBe(dashBefore.volume.referralsReceived + 1);
    expect(dashAfter.kpis.completedCount).toBe(dashBefore.kpis.completedCount + 1);

    // Step 15: Complete audit trail verification (CSV ingest -> case -> barrier -> intervention -> appt lifecycle -> verify -> close)
    mockCookieMap.set(SESSION_COOKIE_NAME, adminToken);
    const auditLogsRes = await getAuditLogs(new Request("http://localhost/api/audit-logs"));
    expect(auditLogsRes.status).toBe(200);
    const allLogs = (await auditLogsRes.json()).logs as Array<{ action: string; entityId: string; summary: string }>;
    const actionsInCase = new Set<string>(closedDetail.auditEvents.map((e: { action: string }) => e.action));
    expect(actionsInCase.has("BARRIER_ACCEPT")).toBe(true);
    expect(actionsInCase.has("INTERVENTION_APPROVE")).toBe(true);
    expect(actionsInCase.has("APPOINTMENT_CONFIRM")).toBe(true);
    expect(actionsInCase.has("APPOINTMENT_COMPLETE")).toBe(true);
    expect(allLogs.some((l) => l.action === "REFERRAL_BATCH_INGESTED")).toBe(true);
    expect(closedDetail.workflowEvents.map((e: { toStatus: string }) => e.toStatus)).toEqual(
      expect.arrayContaining([
        "NEW",
        "INTERVENTION_RECOMMENDED",
        "INTERVENTION_IN_PROGRESS",
        "APPOINTMENT_SCHEDULED",
        "APPOINTMENT_CONFIRMED",
        "APPOINTMENT_COMPLETED",
        "VERIFIED",
        "CLOSED",
      ])
    );
  });

  it("handles all negative cases: missing fields, duplicates, unknown barrier, unavailable provider, cancelled/no-show appts, auth, cross-tenant, malformed AI, missing evidence, invalid transitions", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);

    // 1. Missing referral fields -> CSV preview flags row errors without crashing
    const badCsv = `member_id,first_name,last_name,referral_id,referral_date,specialty,geography
,Jane,Doe,,not-a-date,,Central Metro`;
    const previewRes = await previewCsvRoute(
      new Request("http://localhost/api/referrals/ingest/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "qa-e2e-missing.csv", csvText: badCsv }),
      })
    );
    expect(previewRes.status).toBe(200);
    const { preview } = await previewRes.json();
    expect(preview.errorCount).toBeGreaterThanOrEqual(1);

    // 2. Duplicate referral -> ingest skips duplicate cleanly without creating a second case
    const dupCsv = `member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,urgency,geography,network_required,eligibility_verified,preferred_language,consent_sms
MEM-9001,Elena,Navarro,REF-2026-1001,${new Date().toISOString().slice(0, 10)},Therapy,Outpatient Behavioral Health,ROUTINE,Central Metro,Horizon Medicaid,VERIFIED,Spanish,true`;
    const dupRes = await ingestCsvRoute(
      new Request("http://localhost/api/referrals/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "qa-e2e-dup.csv", csvText: dupCsv }),
      })
    );
    expect(dupRes.status).toBe(201);
    const dupBody = await dupRes.json();
    expect(dupBody.createdCases).toHaveLength(0);
    expect(dupBody.batch.errorRows).toBeGreaterThanOrEqual(1);

    // 3. Unknown barrier -> clean referral without barrier notes remains UNKNOWN & HUMAN_OUTREACH
    const unknownCsv = `member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,urgency,geography,urbanicity,network_required,coverage_type,eligibility_verified,preferred_language,consent_sms,digital_access_level,transportation_access,prior_no_show_count,operational_notes
${negUnknownMemberId},Alex,Morgan,${negUnknownRefId},${new Date().toISOString().slice(0, 10)},Routine Check-in,Outpatient Behavioral Health,ROUTINE,Central Metro,URBAN,Horizon Medicaid,MEDICAID,VERIFIED,English,true,HIGH,RELIABLE,0,No barrier notes provided`;
    const unkIngest = await ingestCsvRoute(
      new Request("http://localhost/api/referrals/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "qa-e2e-unknown.csv", csvText: unknownCsv }),
      })
    );
    expect(unkIngest.status).toBe(201);
    const negCaseId = (await unkIngest.json()).createdCases[0].caseId as string;
    createdCaseIds.push(negCaseId);

    const negCaseDetail = (
      await (
        await getCaseDetailRoute(new Request("http://localhost/api/cases/x"), {
          params: Promise.resolve({ id: negCaseId }),
        })
      ).json()
    ).careCase;
    expect(negCaseDetail.primaryBarrierCategory).toBe(BarrierCategory.UNKNOWN);

    // 4. Unavailable provider -> scheduling with NOT_AVAILABLE provider rejected (400)
    const unavailableProv = await prisma.provider.findFirstOrThrow({
      where: { tenantId: horizonTenantId, availabilitySource: AvailabilitySource.NOT_AVAILABLE },
    });
    const unavailApptRes = await scheduleCaseApptRoute(
      new Request("http://localhost/api/cases/x/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: unavailableProv.id,
          scheduledStartAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          modality: "IN_PERSON",
        }),
      }),
      { params: Promise.resolve({ id: negCaseId }) }
    );
    expect(unavailApptRes.status).toBe(400);

    // 5 & 6. Schedule verified provider -> test CANCEL (cannot complete cancelled = 409) & NO_SHOW
    const verifiedProv = await prisma.provider.findFirstOrThrow({
      where: { tenantId: horizonTenantId, availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY },
    });
    const appt1Res = await scheduleCaseApptRoute(
      new Request("http://localhost/api/cases/x/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: verifiedProv.id,
          scheduledStartAt: new Date(Date.now() + 4 * 86_400_000).toISOString(),
          modality: "TELEHEALTH",
        }),
      }),
      { params: Promise.resolve({ id: negCaseId }) }
    );
    const appt1Id = (await appt1Res.json()).appointment.id as string;
    const cancelRes = await patchAppointment(
      new Request("http://localhost/api/appointments/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", note: "Member requested cancellation" }),
      }),
      { params: Promise.resolve({ id: appt1Id }) }
    );
    expect(cancelRes.status).toBe(200);
    // Completing cancelled appointment -> 409 InvalidStateTransitionError
    const completeCancelledRes = await patchAppointment(
      new Request("http://localhost/api/appointments/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "COMPLETE" }),
      }),
      { params: Promise.resolve({ id: appt1Id }) }
    );
    expect(completeCancelledRes.status).toBe(409);

    // Schedule 2nd appointment and mark NO_SHOW -> sets humanReviewRequired=true without completing visit
    const appt2Res = await scheduleCaseApptRoute(
      new Request("http://localhost/api/cases/x/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: verifiedProv.id,
          scheduledStartAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          modality: "TELEHEALTH",
        }),
      }),
      { params: Promise.resolve({ id: negCaseId }) }
    );
    const appt2Id = (await appt2Res.json()).appointment.id as string;
    const noShowRes = await patchAppointment(
      new Request("http://localhost/api/appointments/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "NO_SHOW" }),
      }),
      { params: Promise.resolve({ id: appt2Id }) }
    );
    expect(noShowRes.status).toBe(200);
    const afterNoShowCase = await prisma.case.findUniqueOrThrow({ where: { id: negCaseId } });
    expect(afterNoShowCase.humanReviewRequired).toBe(true);
    expect(afterNoShowCase.status).toBe(CaseStatus.REQUIRES_HUMAN_REVIEW);
    expect(afterNoShowCase.firstCompletedVisitAt).toBeNull();

    // 7 & 8. Unauthorized user (403) + Unauthenticated (401) + Cross-tenant access (404)
    mockCookieMap.clear();
    expect(
      (
        await scheduleCaseApptRoute(
          new Request("http://localhost/api/cases/x/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              providerId: verifiedProv.id,
              scheduledStartAt: new Date().toISOString(),
            }),
          }),
          { params: Promise.resolve({ id: negCaseId }) }
        )
      ).status
    ).toBe(401);

    mockCookieMap.set(SESSION_COOKIE_NAME, execToken);
    expect(
      (
        await verifyCaseRoute(
          new Request("http://localhost/api/cases/x/verifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
              evidenceNote: "Exec cannot verify",
            }),
          }),
          { params: Promise.resolve({ id: negCaseId }) }
        )
      ).status
    ).toBe(403);

    mockCookieMap.set(SESSION_COOKIE_NAME, pacificToken);
    expect(
      (
        await getCaseDetailRoute(new Request("http://localhost/api/cases/x"), {
          params: Promise.resolve({ id: negCaseId }),
        })
      ).status
    ).toBe(404);

    // 9 & 10. Malformed AI response + Missing AI evidence
    expect(() =>
      parseAndValidateModelJson("{broken json", ClassifyBarrierResultSchema, "CLASSIFY_BARRIER")
    ).toThrow(/Malformed JSON/);
    expect(() =>
      ClassifyBarrierResultSchema.parse({ providerName: "broken" })
    ).toThrow();
    expect(() =>
      enforceBarrierPolicy({
        providerName: "bad",
        modelVersion: "v1",
        timestamp: new Date().toISOString(),
        confidence: 0.9,
        uncertainty: "none",
        evidenceSignals: [],
        facts: [],
        inferences: [],
        recommendations: [],
        epistemicStatus: "INFERENCE",
        source: "EXTERNAL_LLM",
        primaryBarrier: {
          category: BarrierCategory.SOCIAL_LOGISTICAL,
          subBarrier: "transportation",
          rationale: "No evidence",
        },
        secondaryBarriers: [],
      })
    ).toThrow(AIPolicyViolationError);

    const extProvider = new ExternalOpenAIProvider();
    const fallbackBarrier = await extProvider.classifyBarrier({
      referralId: "r-neg",
      referralDate: new Date(),
      behavioralHealthNeed: "Support",
      specialty: "Outpatient Behavioral Health",
      urgency: "ROUTINE",
      geography: "Central Metro",
      networkRequired: "Horizon Medicaid",
      preferredLanguage: "English",
      eligibilityVerified: "VERIFIED",
      operationalNotes: "",
      member: {
        urbanicity: "URBAN",
        coverageType: "MEDICAID",
        eligibilityStatus: "ACTIVE",
        preferredContactChannel: "SMS",
        digitalAccessLevel: "HIGH",
        transportationAccess: "RELIABLE",
        priorNoShowCount: 0,
        historicalEngagementRate: 0.9,
      },
      matchingProvidersCount: 2,
      languageConcordantProvidersCount: 2,
      verifiedAvailableSlotsCount: 2,
      minDirectoryWaitDays: null,
    });
    expect(fallbackBarrier.primaryBarrier.category).toBe(BarrierCategory.UNKNOWN);

    // 11. Invalid case state transitions (REQUIRES_HUMAN_REVIEW -> APPOINTMENT_COMPLETED or NEW -> 409)
    mockCookieMap.set(SESSION_COOKIE_NAME, careManagerToken);
    const invalidTransRes = await transitionCaseRoute(
      new Request("http://localhost/api/cases/x/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: CaseStatus.APPOINTMENT_COMPLETED,
          reason: "Cannot mark appointment completed without completed visit workflow",
        }),
      }),
      { params: Promise.resolve({ id: negCaseId }) }
    );
    expect(invalidTransRes.status).toBe(409);

    const invalidRewindRes = await transitionCaseRoute(
      new Request("http://localhost/api/cases/x/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: CaseStatus.NEW, reason: "Cannot rewind to NEW" }),
      }),
      { params: Promise.resolve({ id: negCaseId }) }
    );
    expect(invalidRewindRes.status).toBe(409);
  });
});
