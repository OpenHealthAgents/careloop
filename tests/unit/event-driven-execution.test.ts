import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  careLoopEventBus,
  CareLoopEvent,
  eventIdempotencyStore,
} from "@/lib/events";

describe("Event-Driven Execution Unit Tests — 12 Events, Idempotency & Deterministic Transitions", () => {
  const tenantId = "tenant-event-unit";
  const caseId = "case-unit-101";

  beforeEach(() => {
    eventIdempotencyStore.clear();
  });

  // --------------------------------------------------------------------------
  // 1. All 12 Healthcare Events
  // --------------------------------------------------------------------------
  describe("12 Healthcare Domain Events", () => {
    it("handles ReferralCreated and proposes deterministic transition from NEW to TRIAGED", async () => {
      const event: CareLoopEvent<"ReferralCreated"> = {
        eventId: "evt-ref-create",
        eventType: "ReferralCreated",
        idempotencyKey: "idem-ref-create-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-1",
        actor: { type: "SYSTEM" },
        payload: {
          referralId: "ref-1",
          memberId: "mem-1",
          specialty: "Psychiatry",
          urgency: "HIGH",
          priorityScore: 85,
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "NEW",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.replayed).toBe(false);
      expect(result.reactions.length).toBeGreaterThan(0);
      expect(result.reactions[0].agentName).toBe("ReferralAgent");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.from).toBe("NEW");
      expect(result.deterministicStateTransition?.to).toBe("TRIAGED");
    });

    it("handles ReferralUpdated and notifies subscribing agents", async () => {
      const event: CareLoopEvent<"ReferralUpdated"> = {
        eventId: "evt-ref-upd",
        eventType: "ReferralUpdated",
        idempotencyKey: "idem-ref-upd-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-2",
        actor: { type: "HUMAN", id: "cm-1" },
        payload: {
          referralId: "ref-1",
          memberId: "mem-1",
          updatedFields: ["priorityScore", "urgency"],
          newValues: { priorityScore: 95, urgency: "CRITICAL" },
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "TRIAGED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.reactions[0].agentName).toBe("ReferralAgent");
      expect(result.reactions[0].reaction).toContain("priorityScore, urgency");
    });

    it("handles ProviderFound and advances state to INTERVENTION_IN_PROGRESS", async () => {
      const event: CareLoopEvent<"ProviderFound"> = {
        eventId: "evt-prov-found",
        eventType: "ProviderFound",
        idempotencyKey: "idem-prov-found-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-3",
        actor: { type: "AGENT", id: "ProviderAgent" },
        payload: {
          providerId: "prov-10",
          providerName: "Dr. Sarah Chen, MD",
          specialty: "Psychiatry",
          matchScore: 92,
          verifiedSlotsCount: 4,
          acceptingNewPatients: true,
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "BARRIER_IDENTIFIED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.from).toBe("BARRIER_IDENTIFIED");
      expect(result.deterministicStateTransition?.to).toBe("INTERVENTION_IN_PROGRESS");
    });

    it("handles ProviderUnavailable and flags network capacity deficit", async () => {
      const event: CareLoopEvent<"ProviderUnavailable"> = {
        eventId: "evt-prov-unavail",
        eventType: "ProviderUnavailable",
        idempotencyKey: "idem-prov-unavail-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-4",
        actor: { type: "AGENT", id: "ProviderAgent" },
        payload: {
          providerId: "prov-11",
          specialty: "Child Psychiatry",
          reason: "NO_SLOTS",
          alternativesFoundCount: 0,
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "BARRIER_IDENTIFIED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect((result.reactions[0].output as any).networkDeficit).toBe(true);
    });

    it("handles MemberResponded with CONFIRMED and advances to APPOINTMENT_CONFIRMED", async () => {
      const event: CareLoopEvent<"MemberResponded"> = {
        eventId: "evt-mem-resp",
        eventType: "MemberResponded",
        idempotencyKey: "idem-mem-resp-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-5",
        actor: { type: "HUMAN", role: "MEMBER" },
        payload: {
          memberId: "mem-1",
          channel: "SMS",
          responseIntent: "CONFIRMED",
          bodySnippet: "Yes, I will attend the appointment at 2pm tomorrow.",
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "APPOINTMENT_SCHEDULED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.from).toBe("APPOINTMENT_SCHEDULED");
      expect(result.deterministicStateTransition?.to).toBe("APPOINTMENT_CONFIRMED");
    });

    it("handles AppointmentScheduled and advances state to APPOINTMENT_SCHEDULED", async () => {
      const event: CareLoopEvent<"AppointmentScheduled"> = {
        eventId: "evt-appt-sched",
        eventType: "AppointmentScheduled",
        idempotencyKey: "idem-appt-sched-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-6",
        actor: { type: "AGENT", id: "SchedulingAgent" },
        payload: {
          appointmentId: "appt-99",
          providerId: "prov-10",
          scheduledStartAt: "2026-11-20T14:00:00Z",
          modality: "TELEHEALTH",
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "INTERVENTION_IN_PROGRESS",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.to).toBe("APPOINTMENT_SCHEDULED");
    });

    it("handles AppointmentCancelled and triggers rescheduling outreach review", async () => {
      const event: CareLoopEvent<"AppointmentCancelled"> = {
        eventId: "evt-appt-cancel",
        eventType: "AppointmentCancelled",
        idempotencyKey: "idem-appt-cancel-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-7",
        actor: { type: "HUMAN", role: "MEMBER" },
        payload: {
          appointmentId: "appt-99",
          providerId: "prov-10",
          cancelledBy: "MEMBER",
          cancellationReason: "Transportation conflict",
          requiresRescheduling: true,
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "APPOINTMENT_SCHEDULED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect((result.reactions[0].output as any).requiresRescheduling).toBe(true);
    });

    it("handles AppointmentCompleted and initiates completion verification", async () => {
      const event: CareLoopEvent<"AppointmentCompleted"> = {
        eventId: "evt-appt-comp",
        eventType: "AppointmentCompleted",
        idempotencyKey: "idem-appt-comp-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-8",
        actor: { type: "SYSTEM" },
        payload: {
          appointmentId: "appt-99",
          providerId: "prov-10",
          completedAt: "2026-11-20T15:00:00Z",
          attendanceVerified: true,
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "APPOINTMENT_CONFIRMED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.to).toBe("APPOINTMENT_COMPLETED");
    });

    it("handles ClaimReceived and transitions verified cases to VERIFIED", async () => {
      const event: CareLoopEvent<"ClaimReceived"> = {
        eventId: "evt-claim-rcvd",
        eventType: "ClaimReceived",
        idempotencyKey: "idem-claim-rcvd-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-9",
        actor: { type: "SYSTEM" },
        payload: {
          claimId: "clm-555",
          procedureCode: "90834",
          serviceDate: "2026-11-20",
          providerNpi: "1234567893",
          claimStatus: "PAID",
          paidAmount: 140.0,
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "APPOINTMENT_COMPLETED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.to).toBe("VERIFIED");
    });

    it("handles HumanApprovalGranted and resumes paused actions", async () => {
      const event: CareLoopEvent<"HumanApprovalGranted"> = {
        eventId: "evt-appr-grant",
        eventType: "HumanApprovalGranted",
        idempotencyKey: "idem-appr-grant-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-10",
        actor: { type: "HUMAN", id: "cm-supervisor" },
        payload: {
          approvalId: "appr-77",
          action: "human_intervention_approval",
          approvedById: "cm-supervisor",
          approvedAt: new Date().toISOString(),
          comments: "Approved peer support navigation intervention.",
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "INTERVENTION_RECOMMENDED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.to).toBe("INTERVENTION_IN_PROGRESS");
    });

    it("handles HumanApprovalRejected and halts high-risk execution", async () => {
      const event: CareLoopEvent<"HumanApprovalRejected"> = {
        eventId: "evt-appr-rej",
        eventType: "HumanApprovalRejected",
        idempotencyKey: "idem-appr-rej-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-11",
        actor: { type: "HUMAN", id: "cm-supervisor" },
        payload: {
          approvalId: "appr-77",
          action: "human_intervention_approval",
          rejectedById: "cm-supervisor",
          rejectedAt: new Date().toISOString(),
          rejectionReason: "Intervention exceeds authorized member benefit scope.",
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "INTERVENTION_RECOMMENDED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect((result.reactions[0].output as any).approved).toBe(false);
      // Rejection does not propose an illegal transition
      expect(result.deterministicStateTransition).toBeUndefined();
    });

    it("handles BarrierUpdated and transitions status to BARRIER_IDENTIFIED", async () => {
      const event: CareLoopEvent<"BarrierUpdated"> = {
        eventId: "evt-bar-upd",
        eventType: "BarrierUpdated",
        idempotencyKey: "idem-bar-upd-1",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-12",
        actor: { type: "AGENT", id: "BarrierAgent" },
        payload: {
          barrierId: "bar-1",
          category: "TRANSPORTATION",
          epistemicStatus: "CONFIRMED",
          confirmedByHuman: true,
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "TRIAGED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      expect(result.deterministicStateTransition?.applied).toBe(true);
      expect(result.deterministicStateTransition?.from).toBe("TRIAGED");
      expect(result.deterministicStateTransition?.to).toBe("BARRIER_IDENTIFIED");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Idempotency Guarantees
  // --------------------------------------------------------------------------
  describe("Idempotency Guarantees", () => {
    it("safely suppresses duplicate events with identical idempotencyKey", async () => {
      const sharedKey = "idem-duplicate-test-key";
      const event: CareLoopEvent<"ReferralCreated"> = {
        eventId: "evt-first-delivery",
        eventType: "ReferralCreated",
        idempotencyKey: sharedKey,
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-idem-1",
        actor: { type: "SYSTEM" },
        payload: {
          referralId: "ref-dup",
          memberId: "mem-dup",
          specialty: "Psychiatry",
          urgency: "ROUTINE",
          priorityScore: 50,
        },
      };

      // First publication: processes normally
      const firstResult = await careLoopEventBus.publish(event, {
        currentCaseStatus: "NEW",
        skipDbPersistence: true,
      });
      expect(firstResult.status).toBe("PROCESSED");
      expect(firstResult.replayed).toBe(false);

      // Second publication with SAME idempotencyKey: must be marked duplicate
      const duplicateEvent: CareLoopEvent<"ReferralCreated"> = {
        ...event,
        eventId: "evt-second-redelivery", // Even with different delivery ID!
      };

      const secondResult = await careLoopEventBus.publish(duplicateEvent, {
        currentCaseStatus: "NEW",
        skipDbPersistence: true,
      });
      expect(secondResult.status).toBe("DUPLICATE_IGNORED");
      expect(secondResult.replayed).toBe(true);
      expect(secondResult.idempotencyKey).toBe(sharedKey);
    });

    it("generates deterministic collision-resistant idempotency keys", () => {
      const key1 = eventIdempotencyStore.generateKey(tenantId, "ReferralCreated", "ref-100", 1);
      const key2 = eventIdempotencyStore.generateKey(tenantId, "ReferralCreated", "ref-100", 1);
      const key3 = eventIdempotencyStore.generateKey(tenantId, "ReferralCreated", "ref-100", 2);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toMatch(/^evt-[a-f0-9]{24}$/);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Deterministic State Transitions
  // --------------------------------------------------------------------------
  describe("Deterministic State Transitions", () => {
    it("STRICTLY REJECTS illegal transitions proposed by events", async () => {
      // Subscribe an agent proposing an illegal leap from BLOCKED directly to VERIFIED
      const unsubscribe = careLoopEventBus.subscribe("ClaimReceived", async () => ({
        agentName: "RogueAgent",
        reaction: "Proposing illegal leap from BLOCKED to VERIFIED",
        success: true,
        proposedTransition: {
          from: "BLOCKED",
          to: "VERIFIED",
          reason: "Bypassing intermediate steps",
        },
      }));

      const event: CareLoopEvent<"ClaimReceived"> = {
        eventId: "evt-illegal-hop",
        eventType: "ClaimReceived",
        idempotencyKey: "idem-illegal-hop",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-illegal",
        actor: { type: "SYSTEM" },
        payload: {
          claimId: "clm-illegal",
          procedureCode: "90834",
          serviceDate: "2026-11-20",
          providerNpi: "1234567893",
          claimStatus: "PAID",
        },
      };

      // Case is currently BLOCKED
      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "BLOCKED",
        skipDbPersistence: true,
      });

      expect(result.status).toBe("PROCESSED");
      // State transition MUST be rejected by the deterministic state machine
      expect(result.deterministicStateTransition?.applied).toBe(false);
      expect(result.deterministicStateTransition?.reason).toContain("Deterministic rejection");

      unsubscribe();
    });

    it("allows custom agent subscriptions without corrupting existing handlers", async () => {
      const customHandler = vi.fn().mockResolvedValue({
        agentName: "CustomAuditorAgent",
        reaction: "Custom audit recorded",
        success: true,
      });

      const unsubscribe = careLoopEventBus.subscribe("AppointmentScheduled", customHandler);

      const event: CareLoopEvent<"AppointmentScheduled"> = {
        eventId: "evt-custom-sub",
        eventType: "AppointmentScheduled",
        idempotencyKey: "idem-custom-sub",
        tenantId,
        caseId,
        timestamp: new Date(),
        correlationId: "corr-custom",
        actor: { type: "AGENT" },
        payload: {
          appointmentId: "appt-cust",
          providerId: "prov-1",
          scheduledStartAt: "2026-11-25T10:00:00Z",
          modality: "IN_PERSON",
        },
      };

      const result = await careLoopEventBus.publish(event, {
        currentCaseStatus: "INTERVENTION_IN_PROGRESS",
        skipDbPersistence: true,
      });

      expect(customHandler).toHaveBeenCalledTimes(1);
      const customReaction = result.reactions.find((r) => r.agentName === "CustomAuditorAgent");
      expect(customReaction).toBeDefined();

      unsubscribe();
    });
  });
});
