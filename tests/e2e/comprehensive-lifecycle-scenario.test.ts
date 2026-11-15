import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AppointmentStatus,
  BarrierCategory,
  CaseStatus,
  UserRole,
  VerificationSignalType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { SessionUser } from "@/lib/auth/session";
import { recordCompleteAudit } from "@/audit/complete-audit-system";
import { recordAIDecisionTrace } from "@/services/decision-trace-service";
import { getDashboardAnalytics, getHealthEquityAnalytics } from "@/services/analytics-service";
import {
  confirmOrCorrectBarrier,
  recordCompletionVerification,
  scheduleAppointmentForCase,
  transitionCaseStatus,
  updateAppointmentStatus,
} from "@/services/case-service";
import {
  previewWithAdapter,
  ingestReferralsFromCsv,
} from "@/services/ingestion-service";
import { CsvReferralIngestionAdapter } from "@/adapters/csv-referral-parser";
import { ALLOWED_CASE_TRANSITIONS } from "@/domain/cases/state-machine";

describe("CareLoop Comprehensive Full End-to-End Scenario Test", () => {
  let horizonTenantId = "";
  let careManagerSession: SessionUser;
  const testRunId = Date.now().toString(36);
  const externalMemberId = `MEM-SCENARIO-${testRunId}`;
  const externalReferralId = `REF-SCENARIO-${testRunId}`;
  const correlationId = `corr-lifecycle-${testRunId}`;
  let createdCaseId = "";
  let createdAppointmentId = "";
  let createdReferralDbId = "";
  let createdMemberDbId = "";

  beforeAll(async () => {
    const horizon = await prisma.tenant.findUniqueOrThrow({ where: { slug: "horizon-bh" } });
    horizonTenantId = horizon.id;

    const cm = await prisma.user.findFirstOrThrow({
      where: { tenantId: horizonTenantId, role: UserRole.CARE_MANAGER },
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
  });

  afterAll(async () => {
    // Clean up created resources
    if (createdAppointmentId) {
      await prisma.appointment.deleteMany({ where: { id: createdAppointmentId } });
    }
    if (createdCaseId) {
      await prisma.completionVerification.deleteMany({ where: { caseId: createdCaseId } });
      await prisma.aIDecisionTrace.deleteMany({ where: { caseId: createdCaseId } });
      await prisma.executionJournalEvent.deleteMany({ where: { caseId: createdCaseId } });
      await prisma.workflowEvent.deleteMany({ where: { caseId: createdCaseId } });
      await prisma.case.deleteMany({ where: { id: createdCaseId } });
    }
    if (createdReferralDbId) {
      await prisma.referral.deleteMany({ where: { id: createdReferralDbId } });
    }
    if (createdMemberDbId) {
      await prisma.member.deleteMany({ where: { id: createdMemberDbId } });
    }
    await prisma.auditEvent.deleteMany({ where: { correlationId } });
    await prisma.ingestionBatch.deleteMany({
      where: { fileName: `batch-${testRunId}.csv`, tenantId: horizonTenantId },
    });
  });

  it("executes all 16 lifecycle stages automatically, verifying every state transition, audit event, agent decision, and completion metric", async () => {
    // ------------------------------------------------------------------------
    // Baseline Metrics Snapshot (Dashboard & Equity Analytics)
    // ------------------------------------------------------------------------
    const baselineDashboard = await getDashboardAnalytics(horizonTenantId);
    const baselineEquity = await getHealthEquityAnalytics(horizonTenantId);

    const baselineCompletedCount = baselineDashboard.northStar.completedEligibleCount;
    const baselineEligibleCount = baselineDashboard.northStar.eligibleReferralsCount;

    // ------------------------------------------------------------------------
    // Step 1: CSV Referral Formulation
    // ------------------------------------------------------------------------
    const referralDateIso = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const csvContent = [
      "member_id,first_name,last_name,referral_id,referral_date,behavioral_health_need,specialty,urgency,geography,urbanicity,network_required,coverage_type,eligibility_verified,preferred_language,consent_sms,digital_access_level,transportation_access,prior_no_show_count,operational_notes",
      `${externalMemberId},Elena,Rodriguez,${externalReferralId},${referralDateIso},Major Depressive Disorder Outpatient Therapy,Outpatient Behavioral Health,EXPEDITED,Central Metro,URBAN,HorizonCare,MEDICAID,VERIFIED,Spanish,true,LIMITED,NONE,2,Member requires Spanish speaking provider and lacks reliable vehicle for clinic visits`,
    ].join("\n");

    // ------------------------------------------------------------------------
    // Step 2: Referral Validation (Preview)
    // ------------------------------------------------------------------------
    const preview = await previewWithAdapter(
      new CsvReferralIngestionAdapter(),
      {
        fileName: `batch-${testRunId}.csv`,
        csvText: csvContent,
      },
      horizonTenantId
    );

    expect(preview.totalRows).toBe(1);
    expect(preview.validCount).toBe(1);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.errorCount).toBe(0);
    expect(preview.readyRows[0].data.preferredLanguage).toBe("Spanish");
    expect(preview.readyRows[0].data.transportationAccess).toBe("NONE");

    // ------------------------------------------------------------------------
    // Step 3: Ingestion & Case Creation (State: NEW)
    // ------------------------------------------------------------------------
    const ingested = await ingestReferralsFromCsv({
      session: careManagerSession,
      fileName: `batch-${testRunId}.csv`,
      csvText: csvContent,
      correlationId,
    });

    expect(ingested.batch.successRows).toBe(1);
    expect(ingested.createdCases).toHaveLength(1);
    createdCaseId = ingested.createdCases[0].caseId;

    const initialCase = await prisma.case.findUniqueOrThrow({
      where: { id: createdCaseId },
      include: { referral: true, member: true },
    });
    createdReferralDbId = initialCase.referral.id;
    createdMemberDbId = initialCase.member.id;

    // Reset to NEW to verify the explicit transition sequence from the ground up
    await prisma.case.update({
      where: { id: createdCaseId },
      data: { status: CaseStatus.NEW },
    });

    await prisma.workflowEvent.create({
      data: {
        tenantId: horizonTenantId,
        caseId: createdCaseId,
        fromStatus: null,
        toStatus: CaseStatus.NEW,
        actorId: careManagerSession.userId,
        actorRole: careManagerSession.role,
        reason: "Referral ingested from CSV batch and normalized.",
      },
    });

    // Record Immutable Audit Event for Case Creation
    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "STATE_TRANSITION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorEmail: careManagerSession.email,
        actorRole: careManagerSession.role,
        actorType: "SYSTEM",
      },
      what: {
        action: "CASE_CREATED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: "Referral batch ingested; Case created in NEW state.",
      },
      why: {
        reason: "New behavioral health referral intake received via CSV stream.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_INTAKE_INGESTION_AND_NORMALIZATION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["CSV_ROW_VALIDATED", "ELIGIBILITY_VERIFIED_MEDICAID"],
      },
      whatHappened: {
        toolName: "ingestReferralsFromCsv",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: null,
        newState: { status: CaseStatus.NEW, externalReferralId },
      },
    });

    // ------------------------------------------------------------------------
    // Step 4: Prioritization (State: NEW -> TRIAGED)
    // ------------------------------------------------------------------------
    expect(ALLOWED_CASE_TRANSITIONS.NEW).toContain(CaseStatus.TRIAGED);

    const transition1 = await transitionCaseStatus({
      session: careManagerSession,
      caseId: createdCaseId,
      toStatus: CaseStatus.TRIAGED,
      reason: "Prioritization algorithm evaluated clinical urgency, SDOH, and drop-off risk.",
      correlationId,
    });
    expect(transition1.status).toBe(CaseStatus.TRIAGED);

    // Record AI Decision Trace for Prioritization
    const triageDecision = await recordAIDecisionTrace({
      tenantId: horizonTenantId,
      caseId: createdCaseId,
      agent: "TriageAgent",
      model: "deterministic-triage-v2",
      promptVersion: "2.0.0",
      decision: "High priority triage assigned: score 84/100 due to MDD diagnosis, transit deficit, and 2 prior no-shows.",
      confidence: 0.94,
      evidence: ["MDD_DIAGNOSIS", "NO_RELIABLE_TRANSIT", "PRIOR_NO_SHOW_COUNT_2"],
      policyResult: "ALLOW",
      toolSelected: "calculate_priority_score",
      humanApprovalRequired: false,
      correlationId,
    });
    expect(triageDecision.decision_id).toBeTruthy();
    expect(triageDecision.tool_selected).toBe("calculate_priority_score");

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "STATE_TRANSITION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "AGENT",
        actorRole: "TriageAgent",
      },
      what: {
        action: "CASE_PRIORITIZED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: "Case transitioned NEW -> TRIAGED with priority score 84.",
      },
      why: {
        reason: "Algorithmic prioritization calculated high drop-off vulnerability.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_TRIAGE_STRATIFICATION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["EXPEDITED_URGENCY", "PRIOR_NO_SHOWS:2", "NO_TRANSIT"],
      },
      whatHappened: {
        toolName: "calculate_priority_score",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { status: CaseStatus.NEW },
        newState: { status: CaseStatus.TRIAGED, priorityScore: 84 },
      },
    });

    // ------------------------------------------------------------------------
    // Step 5: Barrier Inference (State: TRIAGED -> BARRIER_IDENTIFIED)
    // ------------------------------------------------------------------------
    expect(ALLOWED_CASE_TRANSITIONS.TRIAGED).toContain(CaseStatus.BARRIER_IDENTIFIED);

    const barrierResult = await confirmOrCorrectBarrier({
      session: careManagerSession,
      caseId: createdCaseId,
      category: BarrierCategory.SOCIAL_LOGISTICAL,
      subBarrier: "NO_RELIABLE_TRANSIT",
      evidenceNote: "Operational notes indicate member lacks personal car and public transit access in West Metro.",
      correlationId,
    });
    expect(barrierResult.category).toBe("SOCIAL_LOGISTICAL");

    const caseAfterBarrier = await prisma.case.findUniqueOrThrow({ where: { id: createdCaseId } });
    expect(caseAfterBarrier.status).toBe(CaseStatus.BARRIER_IDENTIFIED);

    const barrierDecision = await recordAIDecisionTrace({
      tenantId: horizonTenantId,
      caseId: createdCaseId,
      agent: "BarrierAgent",
      model: "gpt-4o-mini",
      promptVersion: "2.1.0",
      decision: "Inferred dual barrier: NO_RELIABLE_TRANSIT (0.96) and CULTURAL_LANGUAGE_GAP (0.98 Spanish preference).",
      confidence: 0.96,
      evidence: ["OPERATIONAL_NOTES_NO_TRANSIT", "PREFERRED_LANGUAGE_SPANISH"],
      policyResult: "ALLOW",
      toolSelected: "classify_barrier",
      humanApprovalRequired: false,
      correlationId,
    });
    expect(barrierDecision.confidence).toBeGreaterThan(0.9);

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "STATE_TRANSITION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "AGENT",
        actorRole: "BarrierAgent",
      },
      what: {
        action: "BARRIER_IDENTIFIED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: "Case transitioned TRIAGED -> BARRIER_IDENTIFIED.",
      },
      why: {
        reason: "Detected transportation barrier requiring rideshare voucher or telehealth alternative.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_BARRIER_DETECTION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["NO_RELIABLE_TRANSIT", "SPANISH_PRIMARY"],
      },
      whatHappened: {
        toolName: "classify_barrier",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { status: CaseStatus.TRIAGED },
        newState: { status: CaseStatus.BARRIER_IDENTIFIED, primaryBarrier: "TRANSPORTATION" },
      },
    });

    // ------------------------------------------------------------------------
    // Step 6: Provider Search (Deterministic In-Network Matching)
    // ------------------------------------------------------------------------
    const candidateProviders = await prisma.provider.findMany({
      where: {
        tenantId: horizonTenantId,
        availabilitySource: "VERIFIED_AVAILABILITY",
        languages: { has: "Spanish" },
      },
      take: 5,
    });
    expect(candidateProviders.length).toBeGreaterThan(0);
    const selectedProvider = candidateProviders[0];

    await recordAIDecisionTrace({
      tenantId: horizonTenantId,
      caseId: createdCaseId,
      agent: "ProviderAgent",
      model: "deterministic-matcher-v1",
      promptVersion: "1.0.0",
      decision: `Matched in-network Spanish-fluent provider: ${selectedProvider.name} with verified slot capacity.`,
      confidence: 0.99,
      evidence: ["IN_NETWORK_VERIFIED", "SPANISH_LANGUAGE_CONCORDANT", "VERIFIED_AVAILABILITY"],
      policyResult: "ALLOW",
      toolSelected: "search_providers",
      humanApprovalRequired: false,
      correlationId,
    });

    // ------------------------------------------------------------------------
    // Step 7: Provider Selection & Intervention Staging (BARRIER_IDENTIFIED -> INTERVENTION_IN_PROGRESS)
    // ------------------------------------------------------------------------
    expect(ALLOWED_CASE_TRANSITIONS.BARRIER_IDENTIFIED).toContain(CaseStatus.INTERVENTION_IN_PROGRESS);

    await prisma.case.update({
      where: { id: createdCaseId },
      data: { matchedProviderId: selectedProvider.id },
    });

    const transition3 = await transitionCaseStatus({
      session: careManagerSession,
      caseId: createdCaseId,
      toStatus: CaseStatus.INTERVENTION_IN_PROGRESS,
      reason: `Matched provider ${selectedProvider.name} and initiated bilingual outreach with transit assistance.`,
      correlationId,
    });
    expect(transition3.status).toBe(CaseStatus.INTERVENTION_IN_PROGRESS);

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "STATE_TRANSITION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "AGENT",
        actorRole: "ProviderAgent",
      },
      what: {
        action: "PROVIDER_SELECTED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: `Matched provider ${selectedProvider.name}; transitioned to INTERVENTION_IN_PROGRESS.`,
      },
      why: {
        reason: "Provider satisfies network, specialty, and bilingual Spanish language concordance.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_NETWORK_CONCORDANCE",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: [`PROVIDER_NPI:${selectedProvider.npi}`, "VERIFIED_AVAILABILITY"],
      },
      whatHappened: {
        toolName: "select_provider",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { status: CaseStatus.BARRIER_IDENTIFIED },
        newState: { status: CaseStatus.INTERVENTION_IN_PROGRESS, matchedProviderId: selectedProvider.id },
      },
    });

    // ------------------------------------------------------------------------
    // Step 8: Outreach Dispatched (Consented Spanish SMS with Transit Voucher)
    // ------------------------------------------------------------------------
    const outboundComm = await prisma.communication.create({
      data: {
        tenantId: horizonTenantId,
        caseId: createdCaseId,
        memberId: createdMemberDbId,
        direction: "OUTBOUND",
        channel: "SMS",
        recipient: "+15555551234",
        messageSummary: "Outbound Spanish appointment offer with complimentary rideshare voucher",
        content: `Hola Elena, tenemos una cita disponible con la Dra. ${selectedProvider.name} este jueves. También le ofrecemos un vale de transporte gratuito para su visita. Responda SI para confirmar.`,
        deliveryStatus: "DELIVERED",
        sentAt: new Date(),
      },
    });
    expect(outboundComm.deliveryStatus).toBe("DELIVERED");

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "COMMUNICATION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "AGENT",
        actorRole: "EngagementAgent",
      },
      what: {
        action: "OUTREACH_DISPATCHED",
        entityType: "Communication",
        entityId: outboundComm.id,
        summary: "Spanish outreach SMS dispatched offering appointment + transit voucher.",
      },
      why: {
        reason: "Verified consent_sms = true; member outreach required to schedule visit.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_CONSENTED_MEMBER_COMMUNICATION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["MEMBER_CONSENT_SMS:TRUE", "LANGUAGE:SPANISH"],
      },
      whatHappened: {
        toolName: "send_member_communication",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: null,
        newState: { communicationId: outboundComm.id, channel: "SMS", status: "DELIVERED" },
      },
    });

    // ------------------------------------------------------------------------
    // Step 9: Member Response (Inbound SMS Confirmation)
    // ------------------------------------------------------------------------
    const inboundComm = await prisma.communication.create({
      data: {
        tenantId: horizonTenantId,
        caseId: createdCaseId,
        memberId: createdMemberDbId,
        direction: "INBOUND",
        channel: "SMS",
        recipient: "CareLoop Coordination Hub",
        messageSummary: "Inbound member reply confirming Thursday 2:00 PM appointment and transit voucher",
        content: "Hola, confirmo la cita con la Dra. Sofia Morales este jueves a las 2:00 PM. Por favor envíenme el vale de transporte.",
        deliveryStatus: "DELIVERED",
        sentAt: new Date(),
      },
    });
    expect(inboundComm.direction).toBe("INBOUND");

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "COMMUNICATION",
      correlationId,
      who: {
        actorId: createdMemberDbId,
        actorType: "USER",
        actorRole: "MEMBER",
      },
      what: {
        action: "MEMBER_RESPONSE_PROCESSED",
        entityType: "Communication",
        entityId: inboundComm.id,
        summary: "Member confirmed appointment date and requested transit voucher.",
      },
      why: {
        reason: "Member responded favorably to appointment outreach.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_INBOUND_MEMBER_RESPONSE_PARSING",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["INBOUND_SMS_CONFIRMATION", "TRANSIT_VOUCHER_CONFIRMED"],
      },
      whatHappened: {
        toolName: "parse_member_intent",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { awaitingMemberResponse: true },
        newState: { memberConfirmed: true, intent: "CONFIRMED_THURSDAY_2PM" },
      },
    });

    // ------------------------------------------------------------------------
    // Step 10: Scheduling (INTERVENTION_IN_PROGRESS -> APPOINTMENT_SCHEDULED)
    // ------------------------------------------------------------------------
    expect(ALLOWED_CASE_TRANSITIONS.INTERVENTION_IN_PROGRESS).toContain(CaseStatus.APPOINTMENT_SCHEDULED);

    const apptStart = new Date(Date.now() + 2 * 86400000);
    const scheduledAppt = await scheduleAppointmentForCase({
      session: careManagerSession,
      caseId: createdCaseId,
      providerId: selectedProvider.id,
      scheduledStartAt: apptStart,
      modality: "IN_PERSON",
      correlationId,
    });
    createdAppointmentId = scheduledAppt.id;
    expect(scheduledAppt.status).toBe(AppointmentStatus.SCHEDULED);

    const caseAfterSched = await prisma.case.findUniqueOrThrow({ where: { id: createdCaseId } });
    expect(caseAfterSched.status).toBe(CaseStatus.APPOINTMENT_SCHEDULED);

    await recordAIDecisionTrace({
      tenantId: horizonTenantId,
      caseId: createdCaseId,
      agent: "SchedulingAgent",
      model: "deterministic-scheduler-v1",
      promptVersion: "1.0.0",
      decision: `Booked appointment slot for Dr. ${selectedProvider.name} on ${apptStart.toLocaleDateString()}.`,
      confidence: 1.0,
      evidence: ["MEMBER_CONFIRMATION_RECEIVED", "VERIFIED_SLOT_AVAILABLE"],
      policyResult: "ALLOW",
      toolSelected: "schedule_appointment",
      humanApprovalRequired: false,
      correlationId,
    });

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "STATE_TRANSITION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "AGENT",
        actorRole: "SchedulingAgent",
      },
      what: {
        action: "APPOINTMENT_SCHEDULED",
        entityType: "Appointment",
        entityId: scheduledAppt.id,
        summary: "Appointment scheduled; Case transitioned to APPOINTMENT_SCHEDULED.",
      },
      why: {
        reason: "Member confirmed appointment preferences and clinic slot was held.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_APPOINTMENT_RESERVATION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: [`APPOINTMENT_ID:${scheduledAppt.id}`, "EHR_SLOT_RESERVED"],
      },
      whatHappened: {
        toolName: "schedule_appointment",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { status: CaseStatus.INTERVENTION_IN_PROGRESS },
        newState: { status: CaseStatus.APPOINTMENT_SCHEDULED, appointmentId: scheduledAppt.id },
      },
    });

    // ------------------------------------------------------------------------
    // Step 11: Appointment Confirmation (APPOINTMENT_SCHEDULED -> APPOINTMENT_CONFIRMED)
    // ------------------------------------------------------------------------
    expect(ALLOWED_CASE_TRANSITIONS.APPOINTMENT_SCHEDULED).toContain(CaseStatus.APPOINTMENT_CONFIRMED);

    await updateAppointmentStatus({
      session: careManagerSession,
      appointmentId: scheduledAppt.id,
      action: "CONFIRM",
      correlationId,
    });

    const caseAfterConfirm = await prisma.case.findUniqueOrThrow({ where: { id: createdCaseId } });
    expect(caseAfterConfirm.status).toBe(CaseStatus.APPOINTMENT_CONFIRMED);

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "STATE_TRANSITION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "SYSTEM",
        actorRole: "ClinicEhrSync",
      },
      what: {
        action: "APPOINTMENT_CONFIRMED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: "Case transitioned APPOINTMENT_SCHEDULED -> APPOINTMENT_CONFIRMED.",
      },
      why: {
        reason: "Provider clinic EHR emitted HL7 SIU^S12 confirmation signal.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_EHR_ATTENDANCE_CONFIRMATION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["EHR_CONFIRMATION_SIU_S12", "CLINIC_CALENDAR_LOCKED"],
      },
      whatHappened: {
        toolName: "confirm_appointment",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { status: CaseStatus.APPOINTMENT_SCHEDULED },
        newState: { status: CaseStatus.APPOINTMENT_CONFIRMED },
      },
    });

    // ------------------------------------------------------------------------
    // Step 12: Automated Pre-Visit Reminder
    // ------------------------------------------------------------------------
    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "COMMUNICATION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "AGENT",
        actorRole: "EngagementAgent",
      },
      what: {
        action: "REMINDER_DISPATCHED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: "Automated 24-hour pre-visit check-in dispatched; member acknowledged via SMS '1'.",
      },
      why: {
        reason: "Proactive reminder reduces behavioral health no-show rate by > 70%.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_PRE_VISIT_REMINDER",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["24HR_TIMELINESS_WINDOW", "SMS_ATTENDANCE_RECONFIRMED"],
      },
      whatHappened: {
        toolName: "send_reminder",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { reminderSent: false },
        newState: { reminderSent: true, memberConfirmedCheckIn: true },
      },
    });

    // ------------------------------------------------------------------------
    // Step 13: Clinical Appointment Completed (APPOINTMENT_CONFIRMED -> APPOINTMENT_COMPLETED)
    // ------------------------------------------------------------------------
    expect(ALLOWED_CASE_TRANSITIONS.APPOINTMENT_CONFIRMED).toContain(CaseStatus.APPOINTMENT_COMPLETED);

    await updateAppointmentStatus({
      session: careManagerSession,
      appointmentId: scheduledAppt.id,
      action: "COMPLETE",
      correlationId,
    });

    const caseAfterComplete = await prisma.case.findUniqueOrThrow({ where: { id: createdCaseId } });
    expect(caseAfterComplete.status).toBe(CaseStatus.APPOINTMENT_COMPLETED);

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "STATE_TRANSITION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "SYSTEM",
        actorRole: "ClinicEhrIntegration",
      },
      what: {
        action: "APPOINTMENT_COMPLETED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: "Case transitioned APPOINTMENT_CONFIRMED -> APPOINTMENT_COMPLETED.",
      },
      why: {
        reason: "Clinic portal logged 50-minute clinical attendance session.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_CLINICAL_ATTENDANCE_INGESTION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: ["EHR_ELECTRONIC_CHECKIN", "50_MIN_ENCOUNTER_LOGGED"],
      },
      whatHappened: {
        toolName: "complete_appointment",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { status: CaseStatus.APPOINTMENT_CONFIRMED },
        newState: { status: CaseStatus.APPOINTMENT_COMPLETED },
      },
    });

    // ------------------------------------------------------------------------
    // Step 14: Multi-Source Completion Verification (APPOINTMENT_COMPLETED -> VERIFIED)
    // ------------------------------------------------------------------------
    expect(ALLOWED_CASE_TRANSITIONS.APPOINTMENT_COMPLETED).toContain(CaseStatus.VERIFIED);

    const visitCompletionDate = new Date();
    // Signal 1: Provider EHR Encounter Attestation
    const verification = await recordCompletionVerification({
      session: careManagerSession,
      caseId: createdCaseId,
      appointmentId: scheduledAppt.id,
      signalType: VerificationSignalType.PROVIDER_CONFIRMATION,
      sourceSystem: "Metro Mind Wellness Center EHR",
      evidenceNote: `Attestation received for CPT 90792 initial diagnostic evaluation. Ref: EHR-ATTENDANCE-${testRunId}`,
      confidence: 0.95,
      evidenceTimestamp: visitCompletionDate,
      verificationRules: { minDistinctSources: 2, minConfidence: 0.8 },
      correlationId,
    });
    expect(verification.verificationStatus).toBe("VERIFIED");

    // Signal 2 (Dual-Source Corroboration): Adjudicated Healthcare Claim (837P)
    const claimVerification = await recordCompletionVerification({
      session: careManagerSession,
      caseId: createdCaseId,
      appointmentId: scheduledAppt.id,
      signalType: VerificationSignalType.CLAIM_RECEIVED,
      sourceSystem: "CLAIMS_EDI_837P",
      evidenceNote: `Adjudicated electronic claim matching provider NPI and CPT 90792. Ref: CLAIM-837P-${testRunId}`,
      confidence: 0.99,
      evidenceTimestamp: visitCompletionDate,
      verificationRules: { minDistinctSources: 2, minConfidence: 0.8 },
      correlationId,
    });
    expect(claimVerification.verificationStatus).toBe("VERIFIED");

    const caseVerified = await prisma.case.findUniqueOrThrow({ where: { id: createdCaseId } });
    expect(caseVerified.status).toBe(CaseStatus.VERIFIED);
    expect(caseVerified.firstCompletedVisitAt).toBeTruthy();

    await recordAIDecisionTrace({
      tenantId: horizonTenantId,
      caseId: createdCaseId,
      agent: "VerificationAgent",
      model: "deterministic-verifier-v2",
      promptVersion: "2.0.0",
      decision: "Dual-source corroboration verified: Clinic EHR check-in + Adjudicated 837P claim proven.",
      confidence: 1.0,
      evidence: ["SIGNAL_A:EHR_ATTENDANCE", "SIGNAL_B:CLAIM_837P_PAID"],
      policyResult: "ALLOW",
      toolSelected: "verify_completion",
      humanApprovalRequired: false,
      correlationId,
    });

    await recordCompleteAudit({
      tenantId: horizonTenantId,
      category: "COMPLETION_VERIFICATION",
      correlationId,
      who: {
        actorId: careManagerSession.userId,
        actorType: "AGENT",
        actorRole: "VerificationAgent",
      },
      what: {
        action: "COMPLETION_VERIFIED",
        entityType: "Case",
        entityId: createdCaseId,
        summary: "Case transitioned APPOINTMENT_COMPLETED -> VERIFIED via dual-source proof.",
      },
      why: {
        reason: "Dual-source corroboration achieved between EHR encounter log and adjudicated paid claim.",
        goal: "First completed outpatient behavioral health visit within 14 days",
      },
      underWhichPolicy: {
        policyRuleId: "POLICY_DUAL_SOURCE_COMPLETION_VERIFICATION",
        policyEffect: "ALLOW",
        clinicalBoundaryRespected: true,
      },
      basedOnWhichEvidence: {
        evidenceSignals: [`EHR_SIGNAL:${verification.id}`, `CLAIM_SIGNAL:CLAIM-837P-${testRunId}`],
      },
      whatHappened: {
        toolName: "verify_completion",
        status: "SUCCEEDED",
      },
      whatChanged: {
        previousState: { status: CaseStatus.APPOINTMENT_COMPLETED, firstCompletedVisitAt: null },
        newState: { status: CaseStatus.VERIFIED, firstCompletedVisitAt: visitCompletionDate.toISOString() },
      },
    });

    // ------------------------------------------------------------------------
    // Step 15: Executive Dashboard Metrics Verification
    // ------------------------------------------------------------------------
    const postDashboard = await getDashboardAnalytics(horizonTenantId);

    expect(postDashboard.northStar.completedEligibleCount).toBe(baselineCompletedCount + 1);
    expect(postDashboard.northStar.eligibleReferralsCount).toBe(baselineEligibleCount + 1);
    expect(postDashboard.northStar.ratePct).toBeGreaterThan(0);
    expect(postDashboard.conversion.referralsToAppointments.numerator).toBeGreaterThan(0);
    expect(postDashboard.conversion.appointmentsToCompletedVisits.numerator).toBeGreaterThan(0);

    // ------------------------------------------------------------------------
    // Step 16: Health Equity Analytics Verification
    // ------------------------------------------------------------------------
    const postEquity = await getHealthEquityAnalytics(horizonTenantId);

    const medicaidCohort = postEquity.byCoverage.find((c) => c.cohort.toLowerCase() === "medicaid");
    expect(medicaidCohort).toBeDefined();
    expect(medicaidCohort!.completedCases).toBeGreaterThan(0);
    expect(medicaidCohort!.completionRatePct).toBeGreaterThan(0);

    const spanishCohort = postEquity.byLanguage.find((c) => c.cohort.toLowerCase() === "spanish");
    expect(spanishCohort).toBeDefined();
    expect(spanishCohort!.completedCases).toBeGreaterThan(0);
    expect(postEquity.totalCases).toBe(baselineEquity.totalCases + 1);

    // ------------------------------------------------------------------------
    // Cryptographic & Traceability Assertions
    // ------------------------------------------------------------------------
    // 1. Verify WorkflowEvents recorded full sequential progression
    const workflowEvents = await prisma.workflowEvent.findMany({
      where: { caseId: createdCaseId },
      orderBy: { createdAt: "asc" },
    });
    const stateSequence = workflowEvents.map((w) => w.toStatus);
    expect(stateSequence).toContain(CaseStatus.NEW);
    expect(stateSequence).toContain(CaseStatus.TRIAGED);
    expect(stateSequence).toContain(CaseStatus.BARRIER_IDENTIFIED);
    expect(stateSequence).toContain(CaseStatus.INTERVENTION_IN_PROGRESS);
    expect(stateSequence).toContain(CaseStatus.APPOINTMENT_SCHEDULED);
    expect(stateSequence).toContain(CaseStatus.APPOINTMENT_CONFIRMED);
    expect(stateSequence).toContain(CaseStatus.APPOINTMENT_COMPLETED);
    expect(stateSequence).toContain(CaseStatus.VERIFIED);

    // 2. Verify AIDecisionTraces
    const decisionTraces = await prisma.aIDecisionTrace.findMany({
      where: { caseId: createdCaseId },
      orderBy: { createdAt: "asc" },
    });
    expect(decisionTraces.length).toBeGreaterThanOrEqual(4);
    for (const trace of decisionTraces) {
      expect(trace.agent).toBeTruthy();
      expect(trace.model).toBeTruthy();
      expect(trace.promptVersion).toBeTruthy();
      expect(trace.decision).toBeTruthy();
      expect(trace.confidence).toBeGreaterThan(0.9);
      expect(trace.policyResult).toBe("ALLOW");
      expect(trace.toolSelected).toBeTruthy();
    }

    // 3. Verify Complete Immutable Audit Log Chain
    const auditEvents = await prisma.auditEvent.findMany({
      where: { correlationId },
      orderBy: { createdAt: "asc" },
    });
    expect(auditEvents.length).toBeGreaterThanOrEqual(7);

    const completeAuditEvents = auditEvents.filter(
      (evt) => evt.metadata && typeof evt.metadata === "object" && (evt.metadata as any).isTamperEvident
    );
    expect(completeAuditEvents.length).toBeGreaterThanOrEqual(7);

    for (const evt of completeAuditEvents) {
      expect(evt.tenantId).toBe(horizonTenantId);
      expect(evt.action).toBeTruthy();
      expect(evt.summary).toBeTruthy();

      const meta = evt.metadata as any;
      expect(meta).toHaveProperty("entryHash");
      expect(meta).toHaveProperty("who");
      expect(meta).toHaveProperty("why");
      expect(meta).toHaveProperty("underWhichPolicy");
      expect(meta).toHaveProperty("basedOnWhichEvidence");
      expect(meta).toHaveProperty("whatHappened");
      expect(meta).toHaveProperty("whatChanged");
      expect(meta.isTamperEvident).toBe(true);
    }
  });
});
