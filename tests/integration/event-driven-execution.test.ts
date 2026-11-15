import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  careLoopEventBus,
  CareLoopEvent,
  eventIdempotencyStore,
} from "@/lib/events";
import { prisma } from "@/lib/db";

describe("Event-Driven Execution Integration Tests (PostgreSQL + Live State Transitions)", () => {
  let tenantId = "";
  let testCaseId = "";
  let testMemberId = "";
  let testReferralId = "";

  beforeAll(async () => {
    eventIdempotencyStore.clear();

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = tenant.id;

    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-EVT-${Date.now()}`,
        firstName: "Event",
        lastName: "Driven",
        dobYear: 1992,
        geography: "West Metro",
        urbanicity: "URBAN",
        preferredLanguage: "English",
        coverageType: "COMMERCIAL",
        consentOutreach: true,
        consentSms: true,
      },
    });
    testMemberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId: member.id,
        externalReferralId: `REF-EVT-${Date.now()}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient psychiatric consultation",
        specialty: "Psychiatry",
        urgency: "HIGH",
        geography: "West Metro",
        networkRequired: "HorizonCare",
        preferredLanguage: "English",
        eligibilityVerified: "VERIFIED",
        status: "IN_CASE",
      },
    });
    testReferralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        referralId: referral.id,
        memberId: member.id,
        status: "NEW",
        riskLevel: "HIGH",
        priorityScore: 75,
      },
    });
    testCaseId = careCase.id;
  });

  afterAll(async () => {
    if (testCaseId) {
      await prisma.workflowEvent.deleteMany({ where: { caseId: testCaseId } }).catch(() => undefined);
      await prisma.case.delete({ where: { id: testCaseId } }).catch(() => undefined);
    }
    if (testReferralId) {
      await prisma.referral.delete({ where: { id: testReferralId } }).catch(() => undefined);
    }
    if (testMemberId) {
      await prisma.member.delete({ where: { id: testMemberId } }).catch(() => undefined);
    }
  });

  it("drives end-to-end case lifecycle via events, enforces idempotency, and persists state in PostgreSQL", async () => {
    // ------------------------------------------------------------------------
    // Step 1: ReferralCreated -> advances NEW to TRIAGED in DB
    // ------------------------------------------------------------------------
    const refEventKey = `idem-ref-${Date.now()}`;
    const refEvent: CareLoopEvent<"ReferralCreated"> = {
      eventId: `evt-ref-${Date.now()}`,
      eventType: "ReferralCreated",
      idempotencyKey: refEventKey,
      tenantId,
      caseId: testCaseId,
      timestamp: new Date(),
      correlationId: `corr-evt-1`,
      actor: { type: "SYSTEM" },
      payload: {
        referralId: testReferralId,
        memberId: testMemberId,
        specialty: "Psychiatry",
        urgency: "HIGH",
        priorityScore: 75,
      },
    };

    const refResult = await careLoopEventBus.publish(refEvent);
    expect(refResult.status).toBe("PROCESSED");
    expect(refResult.deterministicStateTransition?.applied).toBe(true);

    // Verify DB case status updated to TRIAGED
    const caseAfterRef = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterRef.status).toBe("TRIAGED");

    // Verify WorkflowEvent created in PostgreSQL
    const workflowEvents = await prisma.workflowEvent.findMany({
      where: { caseId: testCaseId },
      orderBy: { createdAt: "desc" },
    });
    expect(workflowEvents.length).toBeGreaterThanOrEqual(1);
    expect(workflowEvents[0].toStatus).toBe("TRIAGED");

    // ------------------------------------------------------------------------
    // Step 2: Idempotency Check — Re-publishing same event produces DUPLICATE_IGNORED
    // ------------------------------------------------------------------------
    const duplicateRefResult = await careLoopEventBus.publish(refEvent);
    expect(duplicateRefResult.status).toBe("DUPLICATE_IGNORED");
    expect(duplicateRefResult.replayed).toBe(true);

    // Case status remains unchanged
    const caseAfterDup = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterDup.status).toBe("TRIAGED");

    // ------------------------------------------------------------------------
    // Step 3: BarrierUpdated -> advances TRIAGED to BARRIER_IDENTIFIED
    // ------------------------------------------------------------------------
    const barEvent: CareLoopEvent<"BarrierUpdated"> = {
      eventId: `evt-bar-${Date.now()}`,
      eventType: "BarrierUpdated",
      idempotencyKey: `idem-bar-${Date.now()}`,
      tenantId,
      caseId: testCaseId,
      timestamp: new Date(),
      correlationId: `corr-evt-2`,
      actor: { type: "AGENT", id: "BarrierAgent" },
      payload: {
        category: "TRANSPORTATION",
        epistemicStatus: "CONFIRMED",
      },
    };

    const barResult = await careLoopEventBus.publish(barEvent);
    expect(barResult.status).toBe("PROCESSED");

    const caseAfterBar = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterBar.status).toBe("BARRIER_IDENTIFIED");

    // ------------------------------------------------------------------------
    // Step 4: ProviderFound -> advances to INTERVENTION_IN_PROGRESS
    // ------------------------------------------------------------------------
    const provEvent: CareLoopEvent<"ProviderFound"> = {
      eventId: `evt-prov-${Date.now()}`,
      eventType: "ProviderFound",
      idempotencyKey: `idem-prov-${Date.now()}`,
      tenantId,
      caseId: testCaseId,
      timestamp: new Date(),
      correlationId: `corr-evt-3`,
      actor: { type: "AGENT", id: "ProviderAgent" },
      payload: {
        providerId: "prov-west",
        providerName: "West Behavioral Clinic",
        specialty: "Psychiatry",
        matchScore: 94,
        verifiedSlotsCount: 2,
        acceptingNewPatients: true,
      },
    };

    const provResult = await careLoopEventBus.publish(provEvent);
    expect(provResult.status).toBe("PROCESSED");

    const caseAfterProv = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterProv.status).toBe("INTERVENTION_IN_PROGRESS");

    // ------------------------------------------------------------------------
    // Step 5: AppointmentScheduled -> advances to APPOINTMENT_SCHEDULED
    // ------------------------------------------------------------------------
    const schedEvent: CareLoopEvent<"AppointmentScheduled"> = {
      eventId: `evt-sched-${Date.now()}`,
      eventType: "AppointmentScheduled",
      idempotencyKey: `idem-sched-${Date.now()}`,
      tenantId,
      caseId: testCaseId,
      timestamp: new Date(),
      correlationId: `corr-evt-4`,
      actor: { type: "AGENT", id: "SchedulingAgent" },
      payload: {
        appointmentId: `appt-${Date.now()}`,
        providerId: "prov-west",
        scheduledStartAt: new Date(Date.now() + 86400000).toISOString(),
        modality: "TELEHEALTH",
      },
    };

    const schedResult = await careLoopEventBus.publish(schedEvent);
    expect(schedResult.status).toBe("PROCESSED");

    const caseAfterSched = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterSched.status).toBe("APPOINTMENT_SCHEDULED");

    // ------------------------------------------------------------------------
    // Step 6: MemberResponded (CONFIRMED) -> advances to APPOINTMENT_CONFIRMED
    // ------------------------------------------------------------------------
    const confirmEvent: CareLoopEvent<"MemberResponded"> = {
      eventId: `evt-confirm-${Date.now()}`,
      eventType: "MemberResponded",
      idempotencyKey: `idem-confirm-${Date.now()}`,
      tenantId,
      caseId: testCaseId,
      timestamp: new Date(),
      correlationId: `corr-evt-5`,
      actor: { type: "HUMAN", role: "MEMBER" },
      payload: {
        memberId: testMemberId,
        channel: "SMS",
        responseIntent: "CONFIRMED",
        bodySnippet: "Confirmed! I will attend.",
      },
    };

    const confirmResult = await careLoopEventBus.publish(confirmEvent);
    expect(confirmResult.status).toBe("PROCESSED");

    const caseAfterConfirm = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterConfirm.status).toBe("APPOINTMENT_CONFIRMED");

    // ------------------------------------------------------------------------
    // Step 7: AppointmentCompleted -> advances to APPOINTMENT_COMPLETED
    // ------------------------------------------------------------------------
    const compEvent: CareLoopEvent<"AppointmentCompleted"> = {
      eventId: `evt-comp-${Date.now()}`,
      eventType: "AppointmentCompleted",
      idempotencyKey: `idem-comp-${Date.now()}`,
      tenantId,
      caseId: testCaseId,
      timestamp: new Date(),
      correlationId: `corr-evt-6`,
      actor: { type: "SYSTEM" },
      payload: {
        appointmentId: `appt-done`,
        providerId: "prov-west",
        completedAt: new Date().toISOString(),
        attendanceVerified: true,
      },
    };

    const compResult = await careLoopEventBus.publish(compEvent);
    expect(compResult.status).toBe("PROCESSED");

    const caseAfterComp = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterComp.status).toBe("APPOINTMENT_COMPLETED");

    // ------------------------------------------------------------------------
    // Step 8: ClaimReceived -> advances to VERIFIED
    // ------------------------------------------------------------------------
    const claimEvent: CareLoopEvent<"ClaimReceived"> = {
      eventId: `evt-claim-${Date.now()}`,
      eventType: "ClaimReceived",
      idempotencyKey: `idem-claim-${Date.now()}`,
      tenantId,
      caseId: testCaseId,
      timestamp: new Date(),
      correlationId: `corr-evt-7`,
      actor: { type: "SYSTEM" },
      payload: {
        claimId: `clm-${Date.now()}`,
        procedureCode: "90834",
        serviceDate: "2026-11-20",
        providerNpi: "1234567893",
        claimStatus: "PAID",
      },
    };

    const claimResult = await careLoopEventBus.publish(claimEvent);
    expect(claimResult.status).toBe("PROCESSED");

    const caseAfterClaim = await prisma.case.findUniqueOrThrow({ where: { id: testCaseId } });
    expect(caseAfterClaim.status).toBe("VERIFIED");
  });
});
