import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AvailabilitySource,
  CaseStatus,
  RiskLevel,
  UserRole,
  VerificationSignalType,
  VerificationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  evaluateVerificationSignal,
  isVisitCompletionSignal,
  resolveVerificationRules,
} from "@/domain/completion/verifier";
import { recordCompletionVerification } from "@/services/case-service";
import { SessionUser } from "@/lib/auth/session";

describe("Appointment & Completion Verification — Evidence-Based Signals & Configurable Rules", () => {
  let tenantId = "";
  let session: SessionUser;
  let memberId = "";
  let referralId = "";
  let caseId = "";
  let appointmentId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    tenantId = horizon.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId, role: UserRole.CARE_MANAGER },
    });
    session = {
      userId: cm.id,
      tenantId,
      tenantSlug: horizon.slug,
      email: cm.email,
      name: cm.name,
      role: cm.role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const provider = await prisma.provider.findFirstOrThrow({
      where: { tenantId, availabilitySource: AvailabilitySource.VERIFIED_AVAILABILITY },
    });

    const suffix = Date.now();
    const member = await prisma.member.create({
      data: {
        tenantId,
        externalMemberId: `MEM-VER-${suffix}`,
        firstName: "David",
        lastName: "Chen",
        preferredLanguage: "English",
        geography: "Central Metro",
      },
    });
    memberId = member.id;

    const referral = await prisma.referral.create({
      data: {
        tenantId,
        memberId,
        externalReferralId: `REF-VER-${suffix}`,
        referralDate: new Date(),
        behavioralHealthNeed: "Outpatient Therapy",
        specialty: "Behavioral Health",
        geography: "Central Metro",
        networkRequired: "Horizon PPO",
      },
    });
    referralId = referral.id;

    const careCase = await prisma.case.create({
      data: {
        tenantId,
        memberId,
        referralId,
        status: CaseStatus.APPOINTMENT_CONFIRMED,
        riskLevel: RiskLevel.MEDIUM,
        priorityScore: 55,
      },
    });
    caseId = careCase.id;

    const appt = await prisma.appointment.create({
      data: {
        tenantId,
        caseId,
        memberId,
        providerId: provider.id,
        scheduledStartAt: new Date(Date.now() - 3_600_000),
        modality: "TELEHEALTH",
        status: "CONFIRMED",
        availabilitySourceAtBooking: AvailabilitySource.VERIFIED_AVAILABILITY,
      },
    });
    appointmentId = appt.id;
  });

  afterAll(async () => {
    if (caseId) {
      await prisma.completionVerification.deleteMany({ where: { caseId } });
      await prisma.workflowEvent.deleteMany({ where: { caseId } });
      await prisma.appointment.deleteMany({ where: { caseId } });
      await prisma.case.deleteMany({ where: { id: caseId } });
    }
    if (referralId) {
      await prisma.referral.deleteMany({ where: { id: referralId } });
    }
    if (memberId) {
      await prisma.member.deleteMany({ where: { id: memberId } });
    }
  });

  it("never marks a referral completed merely because a message was sent or appointment was requested/scheduled/confirmed", () => {
    expect(isVisitCompletionSignal("MESSAGE_SENT")).toBe(false);
    expect(isVisitCompletionSignal("APPOINTMENT_REQUESTED")).toBe(false);
    expect(isVisitCompletionSignal(VerificationSignalType.APPOINTMENT_SCHEDULED)).toBe(false);
    expect(isVisitCompletionSignal(VerificationSignalType.APPOINTMENT_CONFIRMED)).toBe(false);

    const scheduledEval = evaluateVerificationSignal({
      signalType: VerificationSignalType.APPOINTMENT_SCHEDULED,
      confidence: 0.99,
    });
    expect(scheduledEval.provesCareCompleted).toBe(false);

    const confirmedEval = evaluateVerificationSignal({
      signalType: VerificationSignalType.APPOINTMENT_CONFIRMED,
      confidence: 0.99,
    });
    expect(confirmedEval.provesCareCompleted).toBe(false);

    // Even if tenant settings try to allow APPOINTMENT_SCHEDULED, resolveVerificationRules strips it
    const rules = resolveVerificationRules({
      verificationRules: {
        acceptedCompletionSignals: [
          VerificationSignalType.APPOINTMENT_SCHEDULED,
          VerificationSignalType.CLAIM_RECEIVED,
        ],
      },
    });
    expect(rules.acceptedCompletionSignals).not.toContain(
      VerificationSignalType.APPOINTMENT_SCHEDULED
    );
    expect(rules.acceptedCompletionSignals).toContain(VerificationSignalType.CLAIM_RECEIVED);
  });

  it("enforces configurable verification rules (minConfidence & minDistinctSources) and records source, timestamp, confidence, and verification_type", async () => {
    // 1. Confidence below configurable threshold (0.90) does not complete care
    const lowConf = await recordCompletionVerification({
      session,
      caseId,
      appointmentId,
      signalType: VerificationSignalType.MEMBER_CONFIRMATION,
      sourceSystem: "MEMBER_PORTAL",
      evidenceNote: "Member tapped attended in portal",
      confidence: 0.85,
      verificationRules: { minConfidence: 0.9 },
    });
    expect(lowConf.verified).toBe(false);
    expect(lowConf.verificationStatus).toBe(VerificationStatus.INSUFFICIENT_EVIDENCE);

    let c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.status).toBe(CaseStatus.APPOINTMENT_CONFIRMED);

    // 2. Require 2 distinct verified sources: 1st source records VERIFIED signal but keeps case unverified
    const firstSource = await recordCompletionVerification({
      session,
      caseId,
      appointmentId,
      signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
      sourceSystem: "EHR_ADT",
      evidenceNote: "Provider EHR check-out confirmed attendance",
      confidence: 0.95,
      verificationRules: { minDistinctSources: 2, minConfidence: 0.8 },
    });
    expect(firstSource.signalType).toBe(VerificationSignalType.PROVIDER_CONFIRMATION);
    expect(firstSource.sourceSystem).toBe("EHR_ADT");
    expect(firstSource.confidence).toBe(0.95);
    expect(firstSource.verifiedAt).toBeInstanceOf(Date);

    c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.status).toBe(CaseStatus.APPOINTMENT_CONFIRMED);

    // 3. 2nd distinct verified source satisfies minDistinctSources=2 and transitions case to VERIFIED
    const secondSource = await recordCompletionVerification({
      session,
      caseId,
      appointmentId,
      signalType: VerificationSignalType.CLAIM_RECEIVED,
      sourceSystem: "CLAIMS_EDI_837",
      evidenceNote: "837P outpatient therapy claim adjudicated",
      confidence: 0.99,
      verificationRules: { minDistinctSources: 2, minConfidence: 0.8 },
    });
    expect(secondSource.signalType).toBe(VerificationSignalType.CLAIM_RECEIVED);
    expect(secondSource.sourceSystem).toBe("CLAIMS_EDI_837");

    c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.status).toBe(CaseStatus.VERIFIED);
    expect(c.firstCompletedVisitAt).not.toBeNull();
  });
});
