import { describe, expect, it } from "vitest";
import { CaseStatus, VerificationSignalType } from "@prisma/client";
import { buildCaseMemory, sanitizeToolParameters } from "@/domain/cases/case-memory";
import {
  CASE_CONTEXT_VERSION,
  caseContextAssembler,
  type CaseContext,
} from "@/domain/cases/context-assembler";

describe("Structured Case Memory (No Unrestricted LLM Transcripts)", () => {
  it("strips disallowed raw LLM chat transcripts and redacts PHI/secrets from tool parameters", () => {
    const cleaned = sanitizeToolParameters({
      caseId: "case-1",
      transcript: "User: hello\nAssistant: ...",
      chatHistory: [{ role: "user", content: "secret" }],
      messages: ["msg1"],
      rawResponse: "{...}",
      ssn: "123-45-6789",
      specialty: "Outpatient Counseling",
    });

    expect(cleaned.transcript).toBeUndefined();
    expect(cleaned.chatHistory).toBeUndefined();
    expect(cleaned.messages).toBeUndefined();
    expect(cleaned.rawResponse).toBeUndefined();
    expect(cleaned.ssn).toBe("[REDACTED_PHI_OR_SECRET]");
    expect(cleaned.specialty).toBe("Outpatient Counseling");
  });

  it("compiles complete structured memory across member, referral, barriers, actions, tool calls, humans, and outcome evidence", () => {
    const memory = buildCaseMemory({
      id: "case-mem-1",
      goal: "Complete the member's Outpatient Counseling referral through a verified first visit.",
      status: CaseStatus.VERIFIED,
      assignedTo: { id: "u-cm", name: "Elena Vance", role: "CARE_MANAGER" },
      member: {
        preferredLanguage: "Spanish",
        geography: "Central Metro",
        urbanicity: "URBAN",
        preferredContactChannel: "PHONE",
        preferredTimeWindow: "AFTERNOON",
        preferredModality: "TELEHEALTH",
        digitalAccessLevel: "MEDIUM",
        transportationAccess: "LIMITED",
        priorNoShowCount: 1,
        consentOutreach: true,
        consentSms: false,
        consents: [
          {
            purpose: "CARE_OUTREACH",
            granted: true,
            channel: "PHONE",
            grantedAt: "2026-11-01T10:00:00.000Z",
          },
        ],
      },
      referral: {
        specialty: "Outpatient Counseling",
        behavioralHealthNeed: "Depression follow-up",
        networkRequired: "Horizon Medicaid",
        referralDate: "2026-11-01T08:00:00.000Z",
        sourceSystem: "EPIC_REFERRAL_FEED",
        referringProviderName: "Metro Community Clinic",
        urgency: "EXPEDITED",
        status: "TRIAGED",
        eligibilityVerified: "VERIFIED",
      },
      barriers: [
        {
          category: "COMMUNICATION",
          subBarrier: "language",
          epistemicStatus: "FACT",
          confidence: 0.91,
          evidenceSignals: ["preferredLanguage=Spanish"],
          source: "DETERMINISTIC_RULES",
          confirmedByHuman: true,
          confirmedById: "u-cm",
          reviewStatus: "CONFIRMED",
          reviewNotes: "Confirmed Spanish preference with member.",
          reviewedAt: "2026-11-02T09:00:00.000Z",
          detectedAt: "2026-11-01T09:00:00.000Z",
        },
      ],
      aiRecommendations: [
        {
          operation: "CLASSIFY_BARRIER",
          status: "ACCEPTED",
          providerName: "DeterministicAIProvider",
          modelVersion: "test-v1",
          inputContext: {
            specialty: "Outpatient Counseling",
            transcript: "MUST_BE_STRIPPED",
          },
          resultingAction: "STAGED_BARRIER_INFERENCE:COMMUNICATION/language",
          humanReviewerId: "u-cm",
          humanReviewer: { id: "u-cm", name: "Elena Vance", role: "CARE_MANAGER" },
          reviewedAt: "2026-11-02T09:00:00.000Z",
          createdAt: "2026-11-01T09:00:00.000Z",
        },
      ],
      interventions: [
        {
          type: "LANGUAGE_COMPATIBLE_PROVIDER_SEARCH",
          status: "COMPLETED",
          executionMode: "HUMAN_ASSISTED",
          assignedOwnerId: "u-cm",
          assignedOwner: { id: "u-cm", name: "Elena Vance", role: "CARE_MANAGER" },
          approvedAt: "2026-11-02T09:08:00.000Z",
          notes: "Approved Spanish-language match.",
          createdAt: "2026-11-02T09:05:00.000Z",
          updatedAt: "2026-11-02T12:00:00.000Z",
          outcomes: [
            {
              outcomeStatus: "RESOLVED",
              barriersResolved: true,
              recordedAt: "2026-11-02T12:00:00.000Z",
            },
          ],
        },
      ],
      appointments: [
        {
          id: "appt-1",
          status: "COMPLETED",
          scheduledStartAt: "2026-11-05T14:00:00.000Z",
          availabilitySourceAtBooking: "VERIFIED_AVAILABILITY",
          provider: { name: "Dra. Sofia Morales" },
        },
      ],
      verifications: [
        {
          signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
          verified: true,
          verificationStatus: "VERIFIED",
          sourceSystem: "CLINIC_PORTAL",
          verifiedAt: "2026-11-05T15:30:00.000Z",
        },
        {
          signalType: VerificationSignalType.CLAIM_RECEIVED,
          verified: true,
          verificationStatus: "VERIFIED",
          sourceSystem: "PAYER_CLAIMS",
          verifiedAt: "2026-11-07T08:00:00.000Z",
        },
        {
          signalType: VerificationSignalType.MEMBER_CONFIRMATION,
          verified: true,
          verificationStatus: "VERIFIED",
          sourceSystem: "MEMBER_PORTAL",
          verifiedAt: "2026-11-06T10:00:00.000Z",
        },
      ],
      workflowEvents: [
        {
          eventType: "CASE_CREATED",
          fromStatus: null,
          toStatus: CaseStatus.NEW,
          actorId: "u-ops",
          actorRole: "OPERATIONS",
          reason: "Referral ingested",
          createdAt: "2026-11-01T08:01:00.000Z",
        },
      ],
      caseNotes: [
        {
          category: "COORDINATION",
          content: "Member confirmed afternoon telehealth preference.",
          author: { id: "u-cm", name: "Elena Vance", role: "CARE_MANAGER" },
          createdAt: "2026-11-02T09:10:00.000Z",
        },
      ],
      auditEvents: [],
    });

    expect(memory.canonical_storage_policy).toBe(
      "STRUCTURED_RELATIONAL_ONLY_NO_RAW_LLM_TRANSCRIPTS"
    );
    expect(memory.member_facts.language).toBe("Spanish");
    expect(memory.member_facts.consent_status.consent_outreach).toBe(true);
    expect(memory.member_facts.consent_status.consent_sms).toBe(false);
    expect(memory.referral_facts.originating_organization).toBe("Metro Community Clinic");
    expect(memory.barrier_observations[0]?.barrier).toBe("COMMUNICATION: language");
    expect(memory.tool_calls[0]?.tool).toBe("ai.classify_barrier");
    expect(memory.tool_calls[0]?.parameters.transcript).toBeUndefined();
    expect(memory.tool_calls[0]?.authorization.humanApproved).toBe(true);
    expect(memory.human_interactions.length).toBeGreaterThanOrEqual(3);
    expect(memory.outcome_evidence.appointment).toHaveLength(1);
    expect(memory.outcome_evidence.provider_confirmation).toHaveLength(1);
    expect(memory.outcome_evidence.claim_signal).toHaveLength(1);
    expect(memory.outcome_evidence.member_confirmation).toHaveLength(1);
  });

  it("assembles minimum-necessary, PHI-minimized, relevance-ranked, versioned CaseContext", () => {
    const ctx: CaseContext = caseContextAssembler.assemble(
      {
        id: "case-ctx-1",
        status: CaseStatus.INTERVENTION_RECOMMENDED,
        riskLevel: "HIGH",
        priorityScore: 86,
        humanReviewRequired: true,
        matchedProviderId: "prov-1",
        verifiedAvailableSlotsCount: 2,
        member: {
          firstName: "Maria",
          lastName: "Rodriguez",
          email: "maria.rodriguez@example.com",
          phone: "555-019-2834",
          dob: "1984-05-12",
          ssn: "123-45-6789",
          preferredLanguage: "Spanish",
          urbanicity: "RURAL",
          preferredContactChannel: "PHONE",
          digitalAccessLevel: "LOW",
          transportationAccess: "NONE",
          consentOutreach: true,
          consentSms: false,
          priorNoShowCount: 2,
        },
        referral: {
          behavioralHealthNeed: "Outpatient Behavioral Health",
          specialty: "OUTPATIENT_THERAPY",
          urgency: "URGENT",
          networkRequired: "Horizon PPO",
          eligibilityVerified: "VERIFIED",
        },
        barriers: [
          {
            category: "ADMINISTRATIVE",
            subBarrier: "Resolved intake paperwork",
            epistemicStatus: "FACT",
            confirmedByHuman: true,
            resolved: true,
            confidence: 0.99,
            evidenceSignals: ["intake_complete"],
          },
          {
            category: "ACCESS",
            subBarrier: "Waitlist delay",
            epistemicStatus: "INFERENCE",
            confirmedByHuman: false,
            resolved: false,
            confidence: 0.65,
            evidenceSignals: ["directory_wait=28d"],
          },
          {
            category: "SOCIAL_LOGISTICAL",
            subBarrier: "Transportation barrier",
            epistemicStatus: "FACT",
            confirmedByHuman: true,
            resolved: false,
            confidence: 0.95,
            evidenceSignals: ["transportation_access=NONE"],
          },
        ],
        interventions: [
          {
            id: "int-1",
            type: "TRANSPORTATION_ASSIST",
            status: "RECOMMENDED",
            createdAt: "2026-11-10T10:00:00.000Z",
          },
          {
            id: "int-2",
            type: "SMS_REMINDER",
            status: "COMPLETED",
            createdAt: "2026-11-01T10:00:00.000Z",
            outcomes: [{ outcomeStatus: "SUCCEEDED" }],
          },
        ],
        appointments: [
          {
            id: "appt-1",
            status: "CONFIRMED",
            scheduledStartAt: "2026-11-15T14:00:00.000Z",
          },
        ],
        verifications: [
          {
            id: "ver-1",
            signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
            verified: true,
            verificationStatus: "VERIFIED",
            verifiedAt: "2026-11-11T12:00:00.000Z",
          },
        ],
      },
      { maxBarriers: 2, maxActions: 2, maxEvidenceRefs: 2 }
    );

    // Versioning & deterministic hash
    expect(ctx.contextVersion).toBe(CASE_CONTEXT_VERSION);
    expect(ctx.contextHash).toHaveLength(64);

    // PHI minimization: no direct identifiers leaked into assembled context
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain("Maria");
    expect(serialized).not.toContain("Rodriguez");
    expect(serialized).not.toContain("maria.rodriguez@example.com");
    expect(serialized).not.toContain("555-019-2834");
    expect(serialized).not.toContain("123-45-6789");

    // Context filtering: resolved barrier excluded by default
    expect(ctx.barriers).toHaveLength(2);
    expect(ctx.barriers.some((b) => b.resolved)).toBe(false);

    // Relevance ranking: confirmed FACT barrier ranks ahead of unconfirmed INFERENCE barrier
    expect(ctx.barriers[0]?.category).toBe("SOCIAL_LOGISTICAL");
    expect(ctx.barriers[1]?.category).toBe("ACCESS");

    // Evidence references & human tasks
    expect(ctx.evidence.evidenceRefs).toHaveLength(2);
    expect(ctx.evidence.evidenceRefs[0]?.verified).toBe(true);
    expect(ctx.humanTasks.pendingBarrierConfirmations).toBe(1);
    expect(ctx.humanTasks.pendingInterventionApprovals).toBe(1);
    expect(ctx.policy.riskTier).toBe("HIGH");
    expect(ctx.policy.humanReviewRequired).toBe(true);
  });
});
